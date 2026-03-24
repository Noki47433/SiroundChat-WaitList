# How Generation Works Now (Generation-Time Only)

This document describes the deterministic `v0_like` generation pipeline used by the website generator.

## Feature Flag
- Route: `/Users/kyro/Downloads/next/app/api/builder/generate/route.ts`
- Flag: `SIROUNDCHAT_V0LIKE_GENERATOR`
  - Default: ON in development, OFF in production
  - Override: set to `1/true/on` or `0/false/off`

## Stages
1. Stage 0 — Prompt intake (`intake.ts`)
- Input: raw prompt + request metadata
- Output: strict `IntakeBrief`
- Behavior: deterministic parsing with optional strict-JSON LLM assist and mandatory fallback

2. Stage 1 — Plan generation (`plan.ts`)
- Output: strict `WebsitePlan` JSON
- Constraints: section allowlist, deterministic order, CTA/copy/media defaults, no unverifiable claims
- Determinism: hash-seeded variant and token choices

3. Stage 2 — Validation (`validate.ts`)
- Schema gate (`schema.ts`)
- Business rules:
  - order enforcement (only `features <-> feature_spotlight` swap tolerated)
  - CTA consistency guardrails
  - pricing/metrics inclusion rules
  - banned CTA labels unless explicitly requested

4. Stage 3 — Registry rendering (`registry.ts` + `render.ts`)
- Render from section registry templates only
- No model calls
- Output: deterministic generated file list (including `app/page.tsx`)

5. Stage 4 — Token clamp checks (`tokens.ts` + `index.ts`)
- Enforce allowed token classes for spacing/layout/typography/gaps

6. Stage 5 — Final output assembly (`render.ts`)
- Output includes generated files + compatibility `SiteDocument` for existing storage path

7. Stage 6 — Checks (`checks.ts`)
- Always: render smoke check + one-H1 guardrail
- Optional command checks (env-controlled): lint, typecheck, build

8. Stage 7 — Retry policy (`retry.ts` + `index.ts`)
- Stage-scoped retries only
- Max retries per stage: 2
- Max total retries: 4
- Retry feedback includes exact validation errors
- On terminal failure: structured error `{ stage, attempts, errors[], lastOutputSnippet? }`

## Files
- `/Users/kyro/Downloads/next/src/generation/v0_like/types.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/schema.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/intake.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/plan.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/validate.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/registry.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/tokens.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/render.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/checks.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/retry.ts`
- `/Users/kyro/Downloads/next/src/generation/v0_like/index.ts`

## How to Add a New Variant Safely
1. Add the variant to the section entry in `registry.ts`.
2. Update the section schema constraints in `schema.ts` if required.
3. Add deterministic render logic for that variant in `registry.ts`.
4. Add/extend tests in `scripts/test-v0-like.ts`.
5. Do not add new section types unless explicitly approved; keep allowlist finite.
