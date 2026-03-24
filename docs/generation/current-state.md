# Current Website Generation State

## Entrypoint
- `POST /api/builder/generate` in `/Users/kyro/Downloads/next/app/api/builder/generate/route.ts`

## Current path (before v0_like branch)
1. Parse payload with `PayloadSchema`
2. Build `GenerationIntake`
3. Resolve policy via `getGenerationPolicy`
4. Build candidate plans via `buildGenerationPlanCandidates`
5. For each candidate:
   - `buildSkeleton`
   - `fillSkeletonSections`
   - `validateSiteDocument`
   - `regenerateFailingSections` (if needed)
   - `applyDeterministicImages`
   - `validateSiteDocument` again
   - fallback disable of optional failing sections
   - score via `computeWebsiteQualityScore`
6. Pick best candidate and convert via `toLegacySiteDocument`
7. Validate with `SiteDocumentSchema`
8. Persist to `builder_sites.site_document`

## Model call locations
- Plan JSON helper: `/Users/kyro/Downloads/next/lib/builder/generation/plan.ts`
- Section content generation: `/Users/kyro/Downloads/next/lib/builder/generation/fill.ts`
- Strict JSON helper: `/Users/kyro/Downloads/next/lib/builder/generation/llm.ts`

## Current output format
- Persisted legacy `SiteDocument` object (`builder_sites.site_document`)

## Current validation
- `GenerationSiteDocumentSchema` + business checks in `/Users/kyro/Downloads/next/lib/builder/generation/validate.ts`
- Final persistence gate in `/Users/kyro/Downloads/next/lib/website-builder/schema.ts`
