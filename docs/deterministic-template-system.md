# Deterministic Template System

This module implements the PDF blueprint as fixed rails for:

- `restaurant`
- `dental`
- `service` (barbershop, beauty salon, nail salon)
- `real_estate`

## Non-negotiable constraints

- Fixed section order per template.
- No extra sections.
- Max two allowed variants per variant-enabled section.
- Hard copy-length caps in schema validation.
- Strict image ratio enums per field.
- One primary CTA intent per template invariant.
- Tailwind guardrail tokens only for spacing/width checks.
- Layout is system-controlled; JSON provides content only.

## Files

- Contracts: `lib/deterministic-templates/contracts.ts`
- JSON schemas + Zod schemas: `lib/deterministic-templates/schemas.ts`
- Prompt contracts: `lib/deterministic-templates/prompts.ts`
- Guardrail validators: `lib/deterministic-templates/validate.ts`
- Generation contract assembly: `lib/deterministic-templates/generation.ts`
- Fixed-order renderer components: `components/deterministic-templates/renderer.tsx`
- Tests: `scripts/test-deterministic-templates.ts`
