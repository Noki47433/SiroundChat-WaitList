import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "v0-sdk";
import type { SiteDocument } from "@/lib/website-builder/types";
import type {
  StudioGenerationSpec,
  StudioProviderMetadata,
  StudioRefinementPlan
} from "@/lib/website-studio/schema";
import { buildStudioProviderPrompt } from "@/lib/website-studio/spec-builder";
import {
  buildStudioSiteDocumentSkeleton,
  buildV0InitialGenerationMessage,
  buildV0RefinementMessage,
  buildV0StudioSystemPrompt,
  normalizeV0SiteDocument,
  parseV0SiteDocumentCandidate,
  resolveStudioGenerationControls,
  V0_SITE_DOCUMENT_FILE,
  V0_STUDIO_SPEC_FILE
} from "@/lib/website-studio/v0";

export type StudioProviderResult = {
  ok: boolean;
  metadata: StudioProviderMetadata;
  prompt: string;
  siteDocument?: SiteDocument;
  rawOutput?: unknown;
  warnings?: string[];
};

export type StudioGenerateInitialSiteInput = {
  spec: StudioGenerationSpec;
  legacyPayload?: unknown;
};

export type StudioRefineSiteInput = {
  spec: StudioGenerationSpec;
  currentDocument: SiteDocument;
  refinement: StudioRefinementPlan;
};

export type StudioRegenerateSectionInput = StudioRefineSiteInput & {
  sectionId: string;
};

export interface WebsiteGenerationProvider {
  readonly metadata: StudioProviderMetadata;
  generateInitialSite(input: StudioGenerateInitialSiteInput): Promise<StudioProviderResult>;
  refineSite(input: StudioRefineSiteInput): Promise<StudioProviderResult>;
  regenerateSection(input: StudioRegenerateSectionInput): Promise<StudioProviderResult>;
}

type StudioProviderRequestKind =
  | "initial_generation"
  | "site_refinement"
  | "section_regeneration";

const V0_MODEL_ID = "v0-pro";
const V0_RESPONSE_MODE = "sync" as const;
const V0_TIMEOUT_MS = 45_000;
const V0_REQUEST_TIMEOUT_MS = 20_000;
const V0_POLL_INTERVAL_MS = 1_500;
const V0_RECENT_RESULT_TTL_MS = 20_000;

const inFlightV0Requests = new Map<string, Promise<StudioProviderResult>>();
const recentV0Results = new Map<string, { expiresAt: number; result: StudioProviderResult }>();

const getV0ApiKey = () => {
  const apiKey = process.env.V0_API_KEY?.trim();
  return apiKey ? apiKey : null;
};

const currentProviderMetadata = (
  pipeline?: string | null,
  reason?: string | null
): StudioProviderMetadata => ({
  provider: "siroundchat-current",
  status: "active",
  mode: "current-pipeline",
  configured: true,
  model: null,
  pipeline: pipeline ?? "existing-builder-generate",
  reason:
    reason ??
    "Using the existing SiroundChat generation pipeline behind the Studio provider boundary."
});

const mockProviderMetadata = (): StudioProviderMetadata => ({
  provider: "siroundchat-mock",
  status: "mock",
  mode: "mock-local",
  configured: true,
  model: null,
  pipeline: "mock-local",
  reason: "Local mock provider for development and contract tests."
});

const unavailableV0Metadata = (
  reason?: string | null,
  details: { requestFingerprint?: string | null; resultSource?: StudioProviderMetadata["resultSource"] } = {}
): StudioProviderMetadata => ({
  provider: "v0",
  status: getV0ApiKey() ? "planned" : "unavailable",
  mode: getV0ApiKey() ? "v0-sdk-live" : "v0-adapter-stub",
  configured: Boolean(getV0ApiKey()),
  model: V0_MODEL_ID,
  pipeline: "v0-sdk",
  requestFingerprint: details.requestFingerprint ?? null,
  resultSource: details.resultSource ?? null,
  responseMode: V0_RESPONSE_MODE,
  reason:
    reason ??
    (getV0ApiKey()
      ? "v0 is configured, but the live request did not complete."
      : "V0_API_KEY is not configured. Falling back to the current SiroundChat generation pipeline.")
});

const liveV0Metadata = (
  kind: StudioProviderRequestKind,
  details: {
    chatId?: string | null;
    versionId?: string | null;
    webUrl?: string | null;
    demoUrl?: string | null;
    screenshotUrl?: string | null;
    fileNames?: string[];
    reason?: string | null;
    requestFingerprint?: string | null;
    resultSource?: StudioProviderMetadata["resultSource"];
  } = {}
): StudioProviderMetadata => ({
  provider: "v0",
  status: "active",
  mode: "v0-sdk-live",
  configured: true,
  model: V0_MODEL_ID,
  pipeline: "v0-sdk",
  requestFingerprint: details.requestFingerprint ?? null,
  resultSource: details.resultSource ?? "fresh",
  requestKind: kind,
  responseMode: V0_RESPONSE_MODE,
  chatId: details.chatId ?? null,
  versionId: details.versionId ?? null,
  webUrl: details.webUrl ?? null,
  demoUrl: details.demoUrl ?? null,
  screenshotUrl: details.screenshotUrl ?? null,
  fileNames: details.fileNames,
  reason: details.reason ?? "Live v0 provider completed through the official v0-sdk."
});

const isReadableStreamLike = (value: unknown): value is ReadableStream<Uint8Array> =>
  typeof value === "object" &&
  value !== null &&
  "getReader" in value &&
  typeof (value as { getReader?: unknown }).getReader === "function";

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === "object") {
    const maybeApiError = (error as { error?: { message?: string } }).error?.message;
    if (typeof maybeApiError === "string" && maybeApiError.trim()) {
      return maybeApiError.trim();
    }
    const maybeMessage = (error as { message?: string }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }
  return "Unknown provider error";
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  return Promise.race([
    promise,
    sleep(timeoutMs).then(() => {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`);
    })
  ]);
};

const createRequestFingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);

const getRecentV0Result = (requestFingerprint: string) => {
  const entry = recentV0Results.get(requestFingerprint);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    recentV0Results.delete(requestFingerprint);
    return null;
  }
  return entry.result;
};

const rememberRecentV0Result = (
  requestFingerprint: string,
  result: StudioProviderResult
) => {
  recentV0Results.set(requestFingerprint, {
    expiresAt: Date.now() + V0_RECENT_RESULT_TTL_MS,
    result
  });
};

const setResultSource = (
  result: StudioProviderResult,
  source: NonNullable<StudioProviderMetadata["resultSource"]>
): StudioProviderResult => ({
  ...result,
  metadata: {
    ...result.metadata,
    resultSource: source
  }
});

const logStudioV0Event = (
  level: "info" | "error",
  event: string,
  payload: Record<string, unknown>
) => {
  const logger = level === "error" ? console.error : console.info;
  logger(`[studio:v0] ${event}`, payload);
};

type V0Chat = Awaited<ReturnType<ReturnType<typeof createClient>["chats"]["getById"]>>;

const waitForCompletedChat = async (
  client: ReturnType<typeof createClient>,
  initialChat: V0Chat
): Promise<V0Chat> => {
  let chat = initialChat;
  const startedAt = Date.now();

  while (Date.now() - startedAt < V0_TIMEOUT_MS) {
    const latestVersion = chat.latestVersion;
    const status = latestVersion?.status;
    if (status === "completed" && (latestVersion?.files?.length ?? 0) > 0) {
      return chat;
    }
    if (status === "failed") {
      throw new Error("v0 returned a failed version status.");
    }
    await sleep(V0_POLL_INTERVAL_MS);
    chat = await withTimeout(
      client.chats.getById({ chatId: chat.id }),
      V0_REQUEST_TIMEOUT_MS,
      "v0 chat getById"
    );
  }

  throw new Error("v0 generation timed out before a completed version was available.");
};

const findSiteDocumentFile = (
  files: Array<{ name: string; content: string }>
): { file: { name: string; content: string } | null; warning?: string } => {
  const exact = files.find(
    (file) => file.name === V0_SITE_DOCUMENT_FILE && file.content.trim().length > 0
  );
  if (exact) return { file: exact };

  const fallback = files.find(
    (file) =>
      file.name.endsWith(".json") &&
      file.name !== V0_STUDIO_SPEC_FILE &&
      file.content.trim().length > 0
  );
  if (fallback) {
    return {
      file: fallback,
      warning: `v0 did not return ${V0_SITE_DOCUMENT_FILE}; used ${fallback.name} instead.`
    };
  }

  return { file: null };
};

class CurrentWebsiteGenerationProvider implements WebsiteGenerationProvider {
  readonly metadata: StudioProviderMetadata;

  constructor(metadata: StudioProviderMetadata = currentProviderMetadata()) {
    this.metadata = metadata;
  }

  async generateInitialSite(input: StudioGenerateInitialSiteInput): Promise<StudioProviderResult> {
    return {
      ok: true,
      metadata: this.metadata,
      prompt: buildStudioProviderPrompt(input.spec),
      warnings: [
        "Initial rendering is still delegated to the existing SiroundChat generate route for compatibility."
      ]
    };
  }

  async refineSite(input: StudioRefineSiteInput): Promise<StudioProviderResult> {
    return {
      ok: true,
      metadata: this.metadata,
      prompt: buildStudioProviderPrompt(input.spec),
      siteDocument: input.currentDocument,
      warnings: ["Refinement is applied by scoped SiroundChat patch routes, not unrestricted provider rewrites."]
    };
  }

  async regenerateSection(input: StudioRegenerateSectionInput): Promise<StudioProviderResult> {
    return {
      ok: true,
      metadata: this.metadata,
      prompt: buildStudioProviderPrompt(input.spec),
      siteDocument: input.currentDocument,
      warnings: [`Section ${input.sectionId} is regenerated through the strict section patch route.`]
    };
  }
}

class MockWebsiteGenerationProvider implements WebsiteGenerationProvider {
  readonly metadata = mockProviderMetadata();

  async generateInitialSite(input: StudioGenerateInitialSiteInput): Promise<StudioProviderResult> {
    return {
      ok: true,
      metadata: this.metadata,
      prompt: buildStudioProviderPrompt(input.spec),
      rawOutput: {
        message: "Mock provider accepted the Studio spec. No live generation was performed."
      }
    };
  }

  async refineSite(input: StudioRefineSiteInput): Promise<StudioProviderResult> {
    return {
      ok: true,
      metadata: this.metadata,
      prompt: buildStudioProviderPrompt(input.spec),
      siteDocument: input.currentDocument
    };
  }

  async regenerateSection(input: StudioRegenerateSectionInput): Promise<StudioProviderResult> {
    return {
      ok: true,
      metadata: this.metadata,
      prompt: buildStudioProviderPrompt(input.spec),
      siteDocument: input.currentDocument
    };
  }
}

class V0WebsiteGenerationProvider implements WebsiteGenerationProvider {
  readonly metadata: StudioProviderMetadata;

  constructor() {
    this.metadata = unavailableV0Metadata();
  }

  private async runRequest({
    spec,
    baseDocument,
    kind,
    message,
    refinement
  }: {
    spec: StudioGenerationSpec;
    baseDocument: SiteDocument;
    kind: StudioProviderRequestKind;
    message: string;
    refinement?: StudioRefinementPlan | null;
  }): Promise<StudioProviderResult> {
    const apiKey = getV0ApiKey();
    const prompt = buildStudioProviderPrompt(spec);
    const requestFingerprint = createRequestFingerprint({
      kind,
      siteId: spec.siteId,
      businessId: spec.businessId,
      spec,
      refinement: refinement
        ? {
            request: refinement.request,
            scope: refinement.scope,
            target: refinement.target
          }
        : null,
      baseDocument
    });

    if (!apiKey) {
      return {
        ok: false,
        metadata: unavailableV0Metadata(undefined, { requestFingerprint }),
        prompt,
        warnings: [
          "V0_API_KEY is missing. The live v0 provider stayed inactive and the current generator remains the fallback."
        ]
      };
    }

    const recentResult = getRecentV0Result(requestFingerprint);
    if (recentResult) {
      logStudioV0Event("info", "reuse_recent", {
        requestKind: kind,
        requestFingerprint,
        siteId: spec.siteId,
        businessId: spec.businessId
      });
      return setResultSource(recentResult, "reused_recent");
    }

    const existingInFlight = inFlightV0Requests.get(requestFingerprint);
    if (existingInFlight) {
      logStudioV0Event("info", "reuse_inflight", {
        requestKind: kind,
        requestFingerprint,
        siteId: spec.siteId,
        businessId: spec.businessId
      });
      const reused = await existingInFlight;
      return setResultSource(reused, "reused_inflight");
    }

    const requestPromise = (async (): Promise<StudioProviderResult> => {
      const startedAt = Date.now();
      const controls = resolveStudioGenerationControls({
        spec,
        baseDocument,
        refinement: refinement
          ? {
              scope: refinement.scope,
              request: refinement.request
            }
          : null
      });

      try {
        const client = createClient({ apiKey });
        logStudioV0Event("info", "start", {
          requestKind: kind,
          requestFingerprint,
          siteId: spec.siteId,
          businessId: spec.businessId
        });

        const chat = await withTimeout(
          client.chats.init({
            type: "files",
            chatPrivacy: "private",
            metadata: {
              source: "siroundchat-studio",
              vertical: spec.vertical,
              businessId: spec.businessId,
              siteId: spec.siteId,
              requestKind: kind,
              requestFingerprint
            },
            files: [
              {
                name: V0_STUDIO_SPEC_FILE,
                content: JSON.stringify(spec, null, 2),
                locked: true
              },
              {
                name: V0_SITE_DOCUMENT_FILE,
                content: JSON.stringify(baseDocument, null, 2),
                locked: false
              }
            ]
          }),
          V0_REQUEST_TIMEOUT_MS,
          "v0 chat init"
        );

        const sendResponse = await withTimeout(
          client.chats.sendMessage({
            chatId: chat.id,
            message,
            system: buildV0StudioSystemPrompt(),
            modelConfiguration: {
              modelId: V0_MODEL_ID,
              imageGenerations: controls.allowImageGeneration,
              thinking: false
            },
            responseMode: V0_RESPONSE_MODE
          }),
          V0_REQUEST_TIMEOUT_MS,
          "v0 chat sendMessage"
        );

        if (isReadableStreamLike(sendResponse)) {
          throw new Error("v0 returned an unexpected streaming response for a sync request.");
        }

        const completedChat = await waitForCompletedChat(client, sendResponse as V0Chat);
        const files = completedChat.latestVersion?.files ?? [];
        const fileMatch = findSiteDocumentFile(files);

        if (!fileMatch.file) {
          throw new Error("v0 completed without returning a usable JSON site document artifact.");
        }

        const candidate = parseV0SiteDocumentCandidate(fileMatch.file.content);
        if (
          typeof candidate !== "object" ||
          candidate === null ||
          !("pages" in candidate) ||
          !Array.isArray((candidate as { pages?: unknown }).pages)
        ) {
          throw new Error("v0 returned a malformed site document payload.");
        }

        const siteDocument = normalizeV0SiteDocument({
          spec,
          baseDocument,
          candidate,
          refinement: refinement
            ? {
                scope: refinement.scope,
                target: refinement.target
              }
            : null
        });

        const metadata = liveV0Metadata(kind, {
          chatId: completedChat.id,
          versionId: completedChat.latestVersion?.id ?? null,
          webUrl: completedChat.webUrl ?? null,
          demoUrl: completedChat.latestVersion?.demoUrl ?? null,
          screenshotUrl: completedChat.latestVersion?.screenshotUrl ?? null,
          fileNames: files.map((file) => file.name),
          requestFingerprint,
          resultSource: "fresh",
          reason: fileMatch.warning
            ? `Live v0 provider completed through the official v0-sdk. ${fileMatch.warning}`
            : undefined
        });

        const result: StudioProviderResult = {
          ok: true,
          metadata,
          prompt,
          siteDocument,
          rawOutput: {
            chatId: completedChat.id,
            versionId: completedChat.latestVersion?.id ?? null,
            webUrl: completedChat.webUrl ?? null,
            demoUrl: completedChat.latestVersion?.demoUrl ?? null,
            screenshotUrl: completedChat.latestVersion?.screenshotUrl ?? null,
            fileNames: files.map((file) => file.name),
            artifactFile: fileMatch.file.name,
            controls,
            durationMs: Date.now() - startedAt
          },
          warnings: fileMatch.warning ? [fileMatch.warning] : undefined
        };

        logStudioV0Event("info", "success", {
          requestKind: kind,
          requestFingerprint,
          siteId: spec.siteId,
          businessId: spec.businessId,
          chatId: completedChat.id,
          versionId: completedChat.latestVersion?.id ?? null,
          durationMs: Date.now() - startedAt
        });

        rememberRecentV0Result(requestFingerprint, result);
        return result;
      } catch (error) {
        const messageText = getErrorMessage(error);
        const result: StudioProviderResult = {
          ok: false,
          metadata: unavailableV0Metadata(`Live v0 provider failed: ${messageText}`, {
            requestFingerprint,
            resultSource: "fresh"
          }),
          prompt,
          rawOutput: {
            error: messageText,
            requestKind: kind,
            controls,
            durationMs: Date.now() - startedAt
          },
          warnings: [`Live v0 provider failed: ${messageText}`]
        };

        logStudioV0Event("error", "failure", {
          requestKind: kind,
          requestFingerprint,
          siteId: spec.siteId,
          businessId: spec.businessId,
          durationMs: Date.now() - startedAt,
          message: messageText
        });

        rememberRecentV0Result(requestFingerprint, result);
        return result;
      } finally {
        inFlightV0Requests.delete(requestFingerprint);
      }
    })();

    inFlightV0Requests.set(requestFingerprint, requestPromise);
    return requestPromise;
  }

  async generateInitialSite(input: StudioGenerateInitialSiteInput): Promise<StudioProviderResult> {
    const baseDocument = buildStudioSiteDocumentSkeleton(input.spec);
    const controls = resolveStudioGenerationControls({
      spec: input.spec,
      baseDocument,
      refinement: null
    });
    return this.runRequest({
      spec: input.spec,
      baseDocument,
      kind: "initial_generation",
      message: buildV0InitialGenerationMessage(input.spec, controls)
    });
  }

  async refineSite(input: StudioRefineSiteInput): Promise<StudioProviderResult> {
    if (!input.refinement.providerAllowed) {
      return {
        ok: false,
        metadata: unavailableV0Metadata("This refinement scope is not allowed through the provider boundary."),
        prompt: buildStudioProviderPrompt(input.spec),
        siteDocument: input.currentDocument,
        warnings: ["The requested refinement scope is intentionally handled by SiroundChat, not the provider."]
      };
    }

    return this.runRequest({
      spec: input.spec,
      baseDocument: input.currentDocument,
      kind: "site_refinement",
      message: buildV0RefinementMessage({
        spec: input.spec,
        refinement: input.refinement,
        controls: resolveStudioGenerationControls({
          spec: input.spec,
          baseDocument: input.currentDocument,
          refinement: {
            scope: input.refinement.scope,
            request: input.refinement.request
          }
        })
      }),
      refinement: input.refinement
    });
  }

  async regenerateSection(input: StudioRegenerateSectionInput): Promise<StudioProviderResult> {
    if (!input.refinement.providerAllowed) {
      return {
        ok: false,
        metadata: unavailableV0Metadata("This section request is not allowed through the provider boundary."),
        prompt: buildStudioProviderPrompt(input.spec),
        siteDocument: input.currentDocument,
        warnings: ["The requested section change is intentionally handled by SiroundChat patching, not the provider."]
      };
    }

    return this.runRequest({
      spec: input.spec,
      baseDocument: input.currentDocument,
      kind: "section_regeneration",
      message: buildV0RefinementMessage({
        spec: input.spec,
        refinement: input.refinement,
        sectionId: input.sectionId,
        controls: resolveStudioGenerationControls({
          spec: input.spec,
          baseDocument: input.currentDocument,
          refinement: {
            scope: input.refinement.scope,
            request: input.refinement.request
          }
        })
      }),
      refinement: input.refinement
    });
  }
}

export const createStudioGenerationProvider = (providerName?: string | null): WebsiteGenerationProvider => {
  const requested = (providerName ?? process.env.SIROUNDCHAT_STUDIO_GENERATION_PROVIDER ?? "auto")
    .trim()
    .toLowerCase();

  if (requested === "mock" || requested === "siroundchat-mock") {
    return new MockWebsiteGenerationProvider();
  }

  if (requested === "current" || requested === "siroundchat-current") {
    return new CurrentWebsiteGenerationProvider();
  }

  if (requested === "v0") {
    return new V0WebsiteGenerationProvider();
  }

  if (getV0ApiKey()) {
    return new V0WebsiteGenerationProvider();
  }

  return new CurrentWebsiteGenerationProvider(
    currentProviderMetadata(
      "existing-builder-generate",
      "V0_API_KEY is missing. Using the existing SiroundChat generation pipeline through the Studio provider boundary."
    )
  );
};

export const getCurrentStudioProviderMetadata = (pipeline?: string | null) =>
  currentProviderMetadata(pipeline);
