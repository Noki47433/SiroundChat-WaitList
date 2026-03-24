import {
  FIXED_SECTION_ORDER,
  resolveDeterministicTemplate,
  type DeterministicTemplateId,
  type TemplateResolution
} from "@/lib/deterministic-templates/contracts";
import { getSystemPromptForTemplate } from "@/lib/deterministic-templates/prompts";
import { DeterministicJsonSchemas, type DeterministicPayload } from "@/lib/deterministic-templates/schemas";
import { validateDeterministicPayload } from "@/lib/deterministic-templates/validate";

export type GenerationContract<T extends DeterministicTemplateId = DeterministicTemplateId> = {
  template: T;
  serviceNiche: TemplateResolution["serviceNiche"];
  prompt: string;
  jsonSchema: Record<string, unknown>;
  fixedSectionOrder: readonly string[];
};

export const buildGenerationContract = (industryOrSubtype: string): GenerationContract => {
  const resolution = resolveDeterministicTemplate(industryOrSubtype);
  return {
    template: resolution.template,
    serviceNiche: resolution.serviceNiche,
    prompt: getSystemPromptForTemplate(resolution.template),
    jsonSchema: DeterministicJsonSchemas[resolution.template],
    fixedSectionOrder: FIXED_SECTION_ORDER[resolution.template]
  };
};

export const parseAndValidateGeneratedJson = <T extends DeterministicTemplateId>(
  template: T,
  rawJson: string
):
  | {
      ok: true;
      value: Extract<DeterministicPayload, { template: T }>;
      errors: [];
    }
  | {
      ok: false;
      errors: Array<{ path: string; code: string; message: string }>;
    } => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: "$",
          code: "invalid_json",
          message: "Model output is not valid JSON."
        }
      ]
    };
  }

  return validateDeterministicPayload(template, parsed);
};
