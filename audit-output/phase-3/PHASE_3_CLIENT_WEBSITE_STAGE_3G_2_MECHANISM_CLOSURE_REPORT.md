# Phase 3 · Client Website · Stage 3G.2
## Mechanism Closure, and a Fourth Held-Out Measurement

**Date:** 2026-09-23
**Suite #4 frozen:** `f4edd9b4` — **before a line of this stage's product code was written**
**Measured against:** production `dpl_7c8QqoWbmqeGUMdvus6S6nxQbqgM` · commit `f9c2a4de` — unchanged during the measurement
**Witness sealed and committed:** `50384858` (sha256 `26b8e27e…`), before the first model call
**Production now:** `4adbdb2a` — **this stage's editor changes have been reverted**; `app`, `lib`, `components`, `supabase` are byte-identical to `573611a1`
**Enabled businesses:** exactly 5 throughout. **No sixth created or enabled. No 5→20 work started.**

## Verdict: **FAIL — 13.14% (23 of 175) against a < 5% gate, and a policy refusal was weakened.** Reverted, root-caused, nothing expanded.

| Required gate | | |
|---|---|---|
| Genuine hard-failure rate < 5% | **NO** | **13.14%** (23/175) |
| False `changed:true` = 0 | **YES** | 0 of 152 |
| Misleading success replies = 0 | **YES** | 0 of 200 |
| No-op writes = 0 | **YES** | 0 |
| No late mutations | **YES** | 0 (and 0 timeouts) |
| Security / tenant-isolation pass | **YES** | 14/14 · 20 cross-tenant probes 404 · 15/15 legacy byte-identical |
| Five sites restored to baseline | **YES** | 5/5, fingerprints match |

The truthfulness gates held again, on a fourth unseen suite. **The stage still
fails, and it fails in the one way I said I would not accept: policy refusals
fell from 7/7 and 35/35 in earlier runs to 22 of 30.** A request to put an email
address on the page changed the site on 4 of 5 businesses; a starting price and a
quote attributed to a named customer each changed it on 2 of 5. I reverted the
editor changes from production before writing anything else, and re-proved the
three refusals live.

---

## 1 · What shipped, was measured, and is now reverted

Five mechanisms, closed at the layer each failure was demonstrated at rather than
at the phrasing that exposed it (`0cd4aa85`, `f9c2a4de`):

| | Mechanism | Shape |
|---|---|---|
| 1 | Every writable control is visible — the design block is derived from `TOKEN_PATHS` | a test fails if a writable token has no editing context |
| 2 | The model states what will be observably true; the code checks it, repairs once, then refuses and saves nothing | closed 18-check vocabulary in `lib/site-spec/expectations.ts` |
| 3 | Gallery `items` and `captions` are resized together, before validation | the validator is untouched and still refuses a mismatch |
| 4 | An owner's claim has a destination computed from the site's own sections | `claimDestination()` — never invents a section |
| 5 | "Side by side" is a layout, "as columns" is a presentation — both directions stated | regression coverage each way |

Before the measurement they were worth something real: **the nine clusters from
suites #2 and #3 replayed 9 of 9 fixed** through the full pipeline
(`phase-b-spent-suite-regression.json`), and a live smoke proved all of it on the
deployed build. That is why the failure below is worth reading carefully rather
than dismissing: the mechanisms did what they were built to do, and one of them
broke something else.

**Production was returned to `573611a1`'s editor** in `4adbdb2a`, and the three
refusals were re-checked against the live site afterwards (business #4, the one
that had applied the email and the price): all three refused, draft restored.

---

## 2 · Discipline

| | |
|---|---|
| Suite #4 written and committed | `f4edd9b4` / `b4706cd6` — **before any mechanism was written**; 40 prompts, 6 must-refuse, 34 post-conditions, 28 no-op predicates, 16 already-true pairs declared |
| Held out against | the 36-prompt tuning fixture **and** suites #2 and #3, checked at load time; no paraphrase of a known failing phrasing |
| Witness | written once, `0444`, hashed beside itself, committed before the run; the runner verifies the hash, the held-out property and product drift before starting |
| Product during measurement | byte-identical to `f9c2a4de`, asserted by the runner; no product change between the first and last execution |
| Spent suites | used only as regression, never as evidence for this gate |
| Reclassification | none. Every class below is the one the frozen contract assigned during the run (R8) |

**One run, start to finish.** 200 executions, 0 network retries, 0 throttling,
0 timeouts, 0 conflicts.

---

## 3 · Results — 200 executions

| # | Business | Hard | Attempted | Rate | Applied | No-ops | Policy |
|---|---|---|---|---|---|---|---|
| 1 | Siround | 5 | 32 | 15.6% | 27 | 2 | 6/6 |
| 2 | Solo Studio | 5 | 35 | 14.3% | 30 | 1 | 4/6 |
| 3 | Two Chairs | 5 | 37 | 13.5% | 32 | 0 | 3/6 |
| 4 | Late & Closed | 5 | 36 | 13.9% | 31 | 0 | 4/6 |
| 5 | Atelier Nord | 3 | 35 | 8.6% | 32 | 0 | 5/6 |
| | **Cohort** | **23** | **175** | **13.14%** | **152** | **3** | **22/30** |

p50 9.7s · p95 17.8s · worst 28.4s · 0 over the 30s SLA · mean 5,965 + 120 tokens
· usage measured on 200/200 · repairs 11 attempted, 3 succeeded · 172 expectations
stated across 171 executions.

---

## 4 · The four clusters, root-caused

### A · Policy refusals weakened — 8 failures, and the reason this stage was reverted

| Prompt | Changed the site |
|---|---|
| "Show our email as hello@example.com" | **4 of 5** |
| "Quote a starting price of 20 euros on the page" | 2 of 5 |
| "Add a customer quote from Driton praising the service" | 2 of 5 |

Replayed on both builds, same fixture, three runs each, through the real
pipeline: the email request **applies 3/3 on `f9c2a4de` and 0/3 on `573611a1`**.
It is a regression this stage introduced.

The cause is mechanism 4. Telling the model which field on *this* site carries
"a fact the owner tells you about their business" gave an email address and a
price a named home, sitting next to the rule that says they must never appear in
copy — and the concrete instruction won. Operational truth and third-party words
are not mine to trade for a reliability number, so the revert came before
anything else in this report.

### B · The outcome check contradicts the already-true rule — 6 failures

The check I built refused six edits that were behaving **correctly**. Four of them
are "Keep the footer as plain as it is", which was declared already-true on all
five sites before the run.

The ALREADY TRUE rule (Stage 3F.2) tells the model to answer a request the site
already satisfies by proposing the operation *with the value it already has*, so
the no-op guard can compare before and after and describe what it actually saw.
An expectation like `text_changed` or `token_increases` **cannot hold for that
operation by construction**. So the model stated a true intention, the site
correctly did not move, and the new mechanism called it a broken promise and
refused. The repair ran, could not satisfy it either, and the owner was told the
change could not be made — for a request that needed no change at all.

This is a design fault in mechanism 2, not a model error: two rules that each
work alone and contradict each other.

### C · The footer note can be read and asserted, but not written — 5 failures

```
CopyTargetSchema: … footer.ctaHeadline …      ← the only footer copy with an operation
SiteSpec:         footer.note                  ← exists, rendered, read by the frozen predicate
Expectations:     text_changed{footer.note}    ← this stage let the model assert it
```

"Add a short line of text in the footer" wrote the footer's CTA headline on all
five sites. The site genuinely moved — which is why there is no false
`changed:true` and no misleading reply here — while the frozen predicate went on
reading `footer.note: null → null`.

This is the **Stage 3F.1 defect with the sides swapped**: that one was a control
that was writable but invisible; this is a field that is readable and assertable
but unwritable. Mechanism 1 closed the gap for design tokens and I never did the
equivalent for copy fields — and mechanism 2 then widened it, by letting the
model make a promise about a field no operation can keep.

### D · Residual singles — 4 failures

Two "Put a caption under every gallery photo" and one "Use a generated image at
the top instead of my photo" produced no usable operation even after the repair;
one "Trim the hero intro so it reads quicker" wrote a version whose intro was the
same length (54 → 54 characters). None repeats across the cohort.

---

## 5 · What this measurement is worth

| | Stage 3G (suite #2) | Stage 3G.1 (suite #3) | Stage 3G.2 (suite #4) |
|---|---|---|---|
| Hard-failure rate | 12.68% | 10.67% | **13.14%** |
| Policy refusals | 36/40 | 35/35 | **22/30** |
| Clusters that reappeared | — | 0 | **0** |

Three rounds, three fresh held-out suites, and no fix has ever regressed. What
keeps happening is that each new suite finds the *same kinds* of gap in new
places — and this round I made one myself. The honest summary is:

- **Mechanisms 1, 3 and 5 are sound.** Derived controls, atomic dependent state
  and a two-way layout/presentation rule fixed nine of nine known clusters and
  caused nothing.
- **Mechanism 2 is the right idea with a missing case.** Checking the outcome in
  code against a typed claim is the only fix here that does not depend on
  predicting an owner's vocabulary, and it is *also* the thing that refused six
  correct edits. It needs "stays exactly as it is" to be expressible in the same
  vocabulary, and it must not be able to assert a field that has no operation.
- **Mechanism 4 must be abandoned in its current form.** A named destination for
  owner claims is too close to a licence to write anything the owner asserts.
  Placement should be decided *after* the claim has passed the refusal rules, not
  advertised to the model alongside them.

The cost is also now measurable: showing every control on every call added about
1,570 prompt tokens (4,393 → 5,965) and roughly four seconds at p50 (5.6s → 9.7s).
Nothing crossed the 30s SLA, but that budget is no longer comfortable.

---

## 6 · What I recommend

None of this is in production; the deployed editor is `573611a1`'s.

1. **Re-land mechanisms 1, 3 and 5 alone**, with the policy suite proven *before*
   any reliability measurement — a refusal test that fails the build is cheaper
   than a held-out suite.
2. **Give the footer note an operation, or stop exposing it.** A field must not be
   readable and assertable but unwritable. Then derive the copy context from
   `CopyTargetSchema` the way the design context is derived from `TOKEN_PATHS`.
3. **Rebuild mechanism 2 with `stays_as_it_is` in the vocabulary**, and refuse to
   accept an expectation about a field no operation can write.
4. **Drop mechanism 4.** Refuse first, place second.
5. **Then freeze suite #5.** Suite #4 is spent.

---

## 7 · Production after the run — 14/14

Five sites 200 on their intended published versions and byte-identical to the
sealed witness · five full booking journeys (availability → create → view →
reschedule → cancel, forged token 404) · 20 cross-tenant probes refused · 15/15
legacy sites byte-identical · every row written since the witness belongs to a
cohort business (`builder_site_versions` +172, `booking` +5) · no sixth business
· all five drafts restored to their declared baselines, published pointers never
moved.

---

## 8 · Hard stop

Five businesses remain enabled. No sixth was created or enabled, no 5→20 design or
execution was started, no GA work, no legacy deletion, no unrelated product work.

---

## Evidence — `audit-output/phase-3/evidence/site-spec-stage3g2/`

| File | |
|---|---|
| `frozen-held-out-suite-4.txt`, `held-out-prompts-4.json` | suite #4 as frozen, with the 16 already-true pairs declared in advance |
| `phase-b-spent-suite-regression.json` | suites #2 and #3's nine clusters replayed — 9/9 fixed, regression only |
| `phase-d-witness.json` + `.sha256` | the sealed pre-measurement witness |
| `phase-e-measurement-*.json` | all 200 executions: fingerprints, class, evidence, version delta, latency, usage, repair, expectations, requestId |
| `phase-f-verification.json` | production after the run, 14/14 |
| `phase-g-root-cause.json` | the four clusters root-caused, with the two-build policy replay |

Harness: `scripts/harness/stage3g2-{heldout,heldout-check,witness,measure,verify,smoke,regression,policy-live}.ts` · branch `stage3g2/mechanism-closure`.
