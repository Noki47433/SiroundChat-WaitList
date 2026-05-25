---
name: project-website-builder-arch
description: SiroundChat website builder/editor architecture — two paths, AI edit engine, v0 provider setup
metadata:
  type: project
---

SiroundChat has TWO distinct website editor paths:

1. **Integrated Template Path** (`/editor/[siteId]/generate` → `GenerationScreen`)
   - Used for restaurants and new integrated templates (evasion, essence, hously, food-truck)
   - AI edits via `POST /api/builder/studio-edit` (1670 lines)
   - Has `PromptInputBox` with activity log
   - Uses v0 provider (`lib/website-studio/providers.ts`) + GPT-4o/mini

2. **Legacy Document Path** (`/editor/[siteId]` → `EditorShell`)
   - Used for legacy `SiteDocument` sites (non-restaurant or non-integrated-template)
   - AI edits via `AiToolsPanel` component
   - Previously used 4 separate endpoints

**Key data model**: `SiteDocument` (pages → sections → elements/content)
- Table: `builder_sites` with `site_document` JSONB column
- Auth: `getOwnedBuilderSite()` checks `owner_user_id` or `business_id` ownership
- Billing: `getBusinessEntitlementAccess(businessId, "website_builder")` 

**AI infrastructure available**:
- `lib/ai/retrieve.ts` — `retrieveRelevantChunks()` — semantic vector search over business docs
- `lib/ai/rag.ts` — `buildRagContext()` — builds RAG text for chatbot
- `lib/website-studio/refinement.ts` — `classifyStudioRefinementRequest()` — keyword-based scope classifier
- `lib/builder/generation/patch.ts` — `buildSectionPatch()` — GPT-4o-mini content patcher
- `lib/website-studio/providers.ts` — v0 SDK integration + fallback providers

**What was built (2026-05-24)**:
- `lib/website-builder/ai/intent-classifier.ts` — AI-powered edit intent classifier (14 types)
- `lib/website-builder/ai/knowledge-retrieval.ts` — KB retrieval for website editing + data sufficiency check
- `app/api/builder/ai-edit/route.ts` — New unified AI edit endpoint for legacy path
- `app/editor/[siteId]/components/panels/AiToolsPanel.tsx` — Enhanced with new routing, progress states, missing data UX

**Why:** editor was restaurant-only, no KB integration, no page addition, no intent classification, no data sufficiency checks.
**How to apply:** Legacy editor path uses `/api/builder/ai-edit`; integrated template path still uses `/api/builder/studio-edit`.
