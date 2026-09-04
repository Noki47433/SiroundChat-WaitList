"use client";

/**
 * The AI website designer — the approved V2 interaction, wired to the real pipeline.
 *
 * Shape, unchanged from the approved prototype:
 *   · one short request to begin
 *   · up to three clarification cards, each skippable
 *   · then a conversation on the left and the website on the right, forever
 *   · every accepted change acknowledged in the conversation, with Undo
 *   · Publish always visible, always the owner's decision
 *
 * What it deliberately is not: a settings panel. The Site Spec exposes a lot of
 * structure, and none of it is turned into a control here. If an owner wants
 * something changed, they say so.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "@/components/site-spec/studio/studio.module.css";

type Question = {
  topic: string;
  question: string;
  sub: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  defaultOptionId: string;
};

type Answer = { topic: string; optionId: string; answerLabel: string; chosenForYou: boolean };

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Set on an assistant turn that changed the site, enabling Undo. */
  undoToVersionId?: string | null;
  undone?: boolean;
};

type VersionRow = {
  id: string;
  number: number;
  label: string | null;
  source: string;
  createdAt: string;
};

type Phase = "loading" | "create" | "clarify" | "working" | "editing";

export function WebsiteStudioClient({ siteId, slug }: { siteId: string; slug: string | null }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [request, setRequest] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [state, setState] = useState<{
    hasUnpublishedChanges: boolean;
    publishedVersionId: string | null;
    draftVersionId: string | null;
  } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  /**
   * One key for one generation attempt, held across the clarification round trip
   * so that answering three questions is still a single claimed request.
   */
  const generationRequestId = useRef<string>("");

  const refreshPreview = useCallback(() => setPreviewKey((key) => key + 1), []);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/site-spec/state?siteId=${siteId}`);
    if (!response.ok) {
      setPhase("create");
      return;
    }
    const data = await response.json();
    setVersions(data.versions ?? []);
    setState(data.state ?? null);
    setPhase(data.spec ? "editing" : "create");
  }, [siteId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, questions]);

  const say = (role: Turn["role"], text: string, extra: Partial<Turn> = {}) =>
    setTurns((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, role, text, ...extra }
    ]);

  /**
   * Every mutating call names the draft it was composed against, and carries a
   * key that identifies this submission.
   *
   * The version claim is what stops a second tab (or a slow request that got
   * overtaken) from quietly discarding a change the owner already accepted — the
   * server refuses rather than stacking the edit on top. The key is what stops a
   * retry or an impatient second click from spending a second model call.
   */
  const draftVersionId = state?.draftVersionId ?? null;
  const newRequestId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  /** A conflict is not an error to retry — it means reload and look again. */
  const handleConflict = useCallback(
    async (data: { reply?: string; error?: string }) => {
      say(
        "assistant",
        data.reply ?? "Your website changed somewhere else. Reload to see where it is now."
      );
      await loadState();
      refreshPreview();
    },
    [loadState, refreshPreview]
  );

  // ── creating ──────────────────────────────────────────────────────────
  const begin = async (proceed: boolean, withAnswers: Answer[]) => {
    setBusy(true);
    try {
      const response = await fetch("/api/site-spec/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          request,
          answers: withAnswers,
          proceed,
          baseVersionId: draftVersionId,
          requestId: generationRequestId.current
        })
      });
      const data = await response.json();

      if (response.status === 409) {
        await handleConflict(data);
        setPhase("editing");
        return;
      }

      if (data.status === "needs_clarification") {
        setQuestions(data.questions ?? []);
        setPhase("clarify");
        return;
      }
      if (data.status === "generated") {
        say("assistant", data.reply);
        setQuestions([]);
        await loadState();
        refreshPreview();
        setPhase("editing");
        return;
      }
      say("assistant", data.reply ?? data.error ?? "That didn't work. Try again?");
      setPhase(questions.length ? "clarify" : "create");
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    if (!request.trim() || busy) return;
    generationRequestId.current = newRequestId();
    say("user", request.trim());
    setPhase("working");
    await begin(false, []);
  };

  const answerQuestion = async (question: Question, optionId: string | null) => {
    const option = question.options.find((candidate) => candidate.id === optionId);
    const chosen = option ?? question.options.find((o) => o.id === question.defaultOptionId) ?? question.options[0];
    const answer: Answer = {
      topic: question.topic,
      optionId: chosen.id,
      answerLabel: chosen.label,
      chosenForYou: !option
    };
    const next = [...answers, answer];
    setAnswers(next);

    const remaining = questions.filter((candidate) => candidate.topic !== question.topic);
    setQuestions(remaining);
    if (remaining.length === 0) {
      setPhase("working");
      await begin(true, next);
    }
  };

  const skipAll = async () => {
    setQuestions([]);
    setPhase("working");
    await begin(true, answers);
  };

  // ── editing ───────────────────────────────────────────────────────────
  const sendEdit = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setMessage("");
    say("user", text);
    setBusy(true);
    try {
      const response = await fetch("/api/site-spec/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          message: text,
          baseVersionId: draftVersionId,
          requestId: newRequestId(),
          history: turns.slice(-6).map((turn) => ({ role: turn.role, content: turn.text }))
        })
      });
      const data = await response.json();
      if (response.status === 409) {
        await handleConflict(data);
        return;
      }
      say("assistant", data.reply ?? data.error ?? "I couldn't do that.", {
        undoToVersionId: data.changed ? data.undoToVersionId : null
      });
      if (data.changed) {
        await loadState();
        refreshPreview();
      }
    } finally {
      setBusy(false);
    }
  };

  const undo = async (turnId: string, versionId: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/site-spec/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, versionId, baseVersionId: draftVersionId })
      });
      const data = await response.json();
      if (response.status === 409 && data.error === "version_conflict") {
        await handleConflict(data);
        return;
      }
      if (response.ok) {
        setTurns((current) =>
          current.map((turn) => (turn.id === turnId ? { ...turn, undone: true, undoToVersionId: null } : turn))
        );
        say("assistant", data.reply ?? "Put that back.");
        await loadState();
        refreshPreview();
      } else {
        say("assistant", data.error ?? "I couldn't undo that.");
      }
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/site-spec/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The version the owner is actually looking at, not "whatever the draft
        // is by the time this lands" — publishing is too consequential to be
        // resolved server-side against a draft that may have moved.
        body: JSON.stringify({ siteId, versionId: draftVersionId ?? undefined })
      });
      const data = await response.json();
      say("assistant", data.reply ?? data.error ?? "Couldn't publish.");
      await loadState();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (versionId: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/site-spec/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, versionId, baseVersionId: draftVersionId })
      });
      const data = await response.json();
      say("assistant", response.ok ? (data.reply ?? "Put that back.") : (data.error ?? "Couldn't do that."));
      if (response.ok) {
        await loadState();
        refreshPreview();
      }
      setHistoryOpen(false);
    } finally {
      setBusy(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────
  const previewSrc = `/s/${slug ?? ""}?preview=true&siteId=${siteId}&v=${previewKey}`;

  if (phase === "loading") {
    return <div className={styles.loading}>Opening your website…</div>;
  }

  if (phase === "create" || (phase === "working" && !turns.some((t) => t.role === "assistant"))) {
    return (
      <div className={styles.createStage}>
        <div className={styles.createInner}>
          <h1 className={styles.createTitle}>What should your website be?</h1>
          <p className={styles.createSub}>
            One sentence is enough. I already know your services, team, hours and location.
          </p>
          <div className={styles.composer}>
            <textarea
              className={styles.composerInput}
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="A dark, premium site for my barbershop."
              rows={3}
              disabled={phase === "working"}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void onCreate();
              }}
            />
            <button
              type="button"
              className={styles.primary}
              onClick={() => void onCreate()}
              disabled={!request.trim() || phase === "working"}
            >
              {phase === "working" ? "Designing…" : "Build it"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stage} data-device={device}>
      <div className={styles.conversation}>
        <div className={styles.turns} ref={conversationRef}>
          {turns.map((turn) => (
            <div key={turn.id} className={styles.turn} data-role={turn.role}>
              <div className={styles.bubble}>{turn.text}</div>
              {turn.undoToVersionId ? (
                <button
                  type="button"
                  className={styles.undo}
                  onClick={() => void undo(turn.id, turn.undoToVersionId!)}
                  disabled={busy}
                >
                  Undo
                </button>
              ) : null}
              {turn.undone ? <span className={styles.undone}>Undone</span> : null}
            </div>
          ))}

          {questions.length ? (
            <div className={styles.clarify}>
              <div className={styles.clarifyQuestion}>{questions[0].question}</div>
              <div className={styles.clarifySub}>{questions[0].sub}</div>
              <div className={styles.options}>
                {questions[0].options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.option}
                    onClick={() => void answerQuestion(questions[0], option.id)}
                    disabled={busy}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.skip} onClick={() => void skipAll()} disabled={busy}>
                Skip — you choose
              </button>
            </div>
          ) : null}

          {busy && phase !== "clarify" ? <div className={styles.thinking}>Working on it…</div> : null}
        </div>

        <div className={styles.composerRow}>
          <textarea
            className={styles.chatInput}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Make the headline shorter…"
            rows={2}
            disabled={busy || phase === "clarify"}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendEdit();
              }
            }}
          />
          <button
            type="button"
            className={styles.send}
            onClick={() => void sendEdit()}
            disabled={busy || !message.trim() || phase === "clarify"}
          >
            Send
          </button>
        </div>
      </div>

      <div className={styles.canvas}>
        <div className={styles.canvasBar}>
          <div className={styles.deviceToggle}>
            <button
              type="button"
              data-active={device === "desktop"}
              onClick={() => setDevice("desktop")}
              className={styles.deviceButton}
            >
              Desktop
            </button>
            <button
              type="button"
              data-active={device === "mobile"}
              onClick={() => setDevice("mobile")}
              className={styles.deviceButton}
            >
              Mobile
            </button>
          </div>

          <div className={styles.canvasActions}>
            <button type="button" className={styles.ghost} onClick={() => setHistoryOpen((open) => !open)}>
              History
            </button>
            <span className={styles.publishState}>
              {state?.publishedVersionId
                ? state.hasUnpublishedChanges
                  ? "Draft — not live yet"
                  : "Live"
                : "Not published"}
            </span>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void publish()}
              disabled={busy || (!state?.hasUnpublishedChanges && Boolean(state?.publishedVersionId))}
            >
              Publish
            </button>
          </div>
        </div>

        {historyOpen ? (
          <div className={styles.history}>
            {versions.map((version) => (
              <button
                key={version.id}
                type="button"
                className={styles.historyRow}
                onClick={() => void restore(version.id)}
                disabled={busy}
              >
                <span className={styles.historyLabel}>{version.label ?? `Version ${version.number}`}</span>
                <span className={styles.historyMeta}>
                  {version.source} · {new Date(version.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.frameWrap}>
          <iframe
            key={previewKey}
            className={styles.frame}
            src={previewSrc}
            title="Your website"
            data-device={device}
          />
        </div>
      </div>
    </div>
  );
}

export default WebsiteStudioClient;
