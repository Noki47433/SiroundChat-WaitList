# Phase 3 · Client Website · Stage 3G.3
## Refusals in Code, and a Fifth Held-Out Measurement

**Date:** 2026-09-24
**Suite #5 frozen:** `e8a3455c` — **before a line of this stage's product code was written**
**Measured against:** production `dpl_B8j6KqqQ4NR6263Jux7VHyQ3Pgt7` · commit `d4248e62` — unchanged during the measurement
**Witness sealed and committed:** `2cdbdf9a` (sha256 `b73cb900…`), before the first model call
**Enabled businesses:** exactly 5 throughout. **No sixth created or enabled. No 5→20 work started.**

## Verdict: **FAIL — 22.82% (34 of 149) against a < 5% gate.** Not expanded.

| Required gate | | |
|---|---|---|
| Genuine hard-failure rate < 5% | **NO** | **22.82%** (34/149) |
| False `changed:true` = 0 | **YES** | 0 of 115 |
| Misleading success replies = 0 | **NO** | **1** of 220 — §5 |
| No-op writes = 0 | **YES** | 0 |
| No late mutations | **YES** | 0 (and 0 timeouts) |
| Security / tenant-isolation pass | **YES** | 14/14 · 20 cross-tenant probes 404 · 15/15 legacy byte-identical |
| Five sites restored to baseline | **YES** | 5/5, fingerprints match |

**What this stage was for, it achieved: policy refusals are 50 of 50, on every
site, for all ten.** Stage 3G.2 lost that class at 22/30; it is now enforced in
code rather than by a sentence in a prompt, and a deterministic test in the build
chain fails if it ever slips again. The correct-no-op count went from 3 to 20.

**What it did not achieve is a usable reliability number, and a large part of
that is my own suite's fault** — 16 of the 34 failures are requests that cannot
be satisfied on these five sites at all (§4). The measurement stands exactly as
the frozen contract classified it; nothing has been reclassified. But even
setting every impossible pair aside, the rate would be 13.74% (18 of 131), so the
gate fails on any reading.

---

## 1 · What shipped

| | | |
|---|---|---|
| **Policy in code** | An email address is an operational fact — there was no pattern for one, which is how Stage 3G.2 put `hello@example.com` on four sites. A price written the way an owner says it ("15 euros", "twenty five euros") is a price; `MONEY` only matched symbols and ISO codes. A fact that is **true today** is refused too: it used to be allowed with a staleness warning that went to a log while the price went onto the website. | `9ad8c484` |
| **Build-blocking coverage** | `tests/site-spec-policy-refusals.test.ts`, no model: hand-built operations through the real authorization layer, every fact class in owner's words, the three strings that reached a live page, and an email and a price through **every** copy field, derived from `CopyTargetSchema`. Eight strings that must NOT be refused, including the owner claims this product allows. | `9ad8c484` |
| **Footer symmetry** | `footer.note` has an operation, so a field the page renders is a field an owner can change. The model's copy list is derived from `CopyTargetSchema` instead of retyped. The footer's presentation is shown with its choices — `set_footer` could always write it and nothing said what it was. The two footer text fields now say what they are. | `d4248e62` |
| **Mechanisms 1, 3, 5 re-landed** | Design block derived from `TOKEN_PATHS`; gallery items and captions resized together before validation; one layout/presentation rule that works both ways. | `d4248e62` |
| **Mechanism 2 rebuilt** | `already_satisfied` is now something the model can state, and a movement claim is no longer failed by a site that correctly did not move — the no-op guard owns that outcome. An expectation may only name a field an operation can write, and the repair is told which field its own promise named. | `d4248e62` |
| **Mechanism 4 deleted** | `claimDestination` and the "WHERE A CLAIM GOES" rule are gone. A test fails if either returns. | `d4248e62` |

**Deterministic regression before the run:** 14 of 14 clusters from suites #2, #3
and #4, through the real pipeline on in-memory sites — including the three
refusals Stage 3G.2 weakened. **Live smoke on the deployed build:** six spent
prompts, all correct, including the footer *note* changing and an email refused.

---

## 2 · Discipline

| | |
|---|---|
| Suite #5 frozen | `e8a3455c`, working tree byte-identical to the deployed commit; the brief listed the suite last and it was frozen **first** anyway |
| Held out against | the 36-prompt fixture and suites #2, #3 and #4 — 156 earlier prompts, checked at load time. The check caught one collision, which was reworded before freezing |
| Already-true map | 37 prompt/site pairs declared in the evidence before the run |
| Witness | written once, `0444`, hashed beside itself, committed before the run; the runner verifies hash, held-out property and product drift |
| Product during measurement | byte-identical to `d4248e62`, asserted by the runner; unchanged from first execution to last |
| Reclassification | none (R8) |

---

## 3 · Results — 220 executions

| # | Business | Hard | Attempted | Rate | Applied | No-ops | Policy |
|---|---|---|---|---|---|---|---|
| 1 | Siround | 10 | 28 | 35.7% | 18 | 6 | 10/10 |
| 2 | Solo Studio | 6 | 31 | 19.4% | 25 | 2 | 10/10 |
| 3 | Two Chairs | 7 | 31 | 22.6% | 24 | 3 | 10/10 |
| 4 | Late & Closed | 6 | 30 | 20.0% | 24 | 4 | 10/10 |
| 5 | Atelier Nord | 5 | 29 | 17.2% | 24 | 5 | 10/10 |
| | **Cohort** | **34** | **149** | **22.82%** | **115** | **20** | **50/50** |

p50 6.9s · p95 22.2s · worst 79.0s · **4 over the 30s SLA** · 0 timeouts ·
1 conflict · 4 network retries · mean 6,529 + 117 tokens · repairs 14 attempted,
3 succeeded · 150 expectations stated across 147 executions, 9 edits refused for
an outcome that never came true.

---

## 4 · The suite asked for things that do not exist

None of the five businesses has a **contact section**. Three have no **booking
subheading**. One has no **team section**. I wrote suite #5's predicates against
the development fixture, which has all of them, and checked only which prompts
were *already true* at the baselines — never which ones were *possible*.

| Prompt | Hard | Why |
|---|---|---|
| Let the contact block run right to the edges | 5/5 | no contact section anywhere in the cohort |
| Put the contact details last on the page | 5/5 | same |
| Shorten the line under the booking heading | 4/5 | no booking subheading on three sites; on a fourth it is 4 characters |
| Give the team section a warmer introduction line, Show the team as plain portraits, Give the team photos an overlay treatment, Bring the team section up before the services, Refer to the team as our crew | 2 | Siround has no team section |

**16 of the 34 hard failures sit on prompt/site pairs that cannot be satisfied.**
The frozen contract classified them as failures and they stay failures. But the
comparison with suite #4's 13.14% is not a like-for-like one, and I will not
present it as though the editor got worse by nine points.

`scripts/harness/stage3g3-satisfiability.ts` is the check that should have run
before the freeze: for every prompt, at every baseline, can the post-condition be
reached at all? It reports 8 prompts and 18 pairs. **Suite #6 does not get frozen
until it passes that check.**

**There is a real product finding inside this, too.** Asked to move a section the
site does not have, the editor answered *"that is already how it is"* on four
sites — a no-op claim the pre-edit spec contradicts — rather than "there is no
contact section on this site", which is a refusal it already knows how to make.
An impossible request should be named, not absorbed.

---

## 5 · The other failures, and the one misleading reply

**Genuine interpretation failures (18 of 149 = 13.74%), the largest clusters:**

- **"Swap the first gallery photo for a generated one" — 5/5.** A version was
  written every time and the first tile stayed the owner's photo. The operation
  that unbinds a gallery slot exists; the model did not use it.
- **"Call the booking button Book a chair" — 4/5.** Something was renamed on
  every site; the button the suite reads (`hero.primaryCta`) kept saying "Book
  Now". "The booking button" is ambiguous on a page with several.
- **"Take the labels off the gallery photos" — 3/5.** Clearing every caption
  needs one operation per photo and there is no way to say "all of them".

**The misleading reply is a measurement artifact, and I am counting it anyway.**
One execution hit a network failure; the harness retried with the same request id;
the product answered the retry with its stale-write conflict message — *"your
website changed somewhere else while I was working on this"* — which the detector
read as denying a change that had happened, because the first attempt had in fact
applied it. The gate says 1, so the gate fails. The product finding underneath is
real: **a retry of a request the product already applied came back as a conflict
rather than as the original outcome**, which is what idempotency is for.

**Latency moved the wrong way.** The prompt is now 6,529 tokens (4,393 two stages
ago); p95 is 22.2s and four executions crossed the 30-second SLA. Everything the
model must see has been added and nothing has been taken away.

---

## 6 · What I recommend

1. **Fix the suite before the next measurement.** Satisfiability check at freeze
   time, and predicates written against the five baselines rather than the
   fixture. Without that no number from a held-out run means much.
2. **Name impossible requests.** A section the site does not have already has a
   refusal path; it should be reached instead of an already-true claim.
3. **Make an idempotent replay return the original outcome**, not a conflict.
4. **Take something out of the prompt.** The context has grown every stage and
   the SLA is now being crossed. The design and copy blocks could be summarised
   to the controls a request plausibly touches.
5. Only then freeze suite #6. Suite #5 is spent.

---

## 7 · Production after the run — 14/14

Five sites 200 on their intended published versions and byte-identical to the
sealed witness · five full booking journeys (availability → create → view →
reschedule → cancel, forged token 404) · 20 cross-tenant probes refused · 15/15
legacy sites byte-identical · every row written since the witness belongs to a
cohort business (`builder_site_versions` +135, `booking` +5) · no sixth business
· all five drafts restored to their declared baselines, published pointers never
moved.

---

## 8 · Hard stop

Five businesses remain enabled. No sixth was created or enabled, no 5→20 design
or execution was started, no GA work, no legacy deletion, no unrelated product
work. The deployed product is `d4248e62` plus this stage's harness and evidence.

---

## Evidence — `audit-output/phase-3/evidence/site-spec-stage3g3/`

| File | |
|---|---|
| `frozen-held-out-suite-5.txt`, `held-out-prompts-5.json` | suite #5 as frozen, with the 37 already-true pairs declared in advance |
| `phase-b-spent-suite-regression.json` | 14 clusters from suites #2–#4 replayed — 14/14, regression only |
| `phase-d-witness.json` + `.sha256` | the sealed pre-measurement witness |
| `phase-e-measurement-*.json` | all 220 executions: fingerprints, class, evidence, version delta, latency, usage, repair, expectations, requestId |
| `phase-f-verification.json` | production after the run, 14/14 |
| `phase-g-satisfiability.json` | which prompts could not be satisfied on which sites, and why |

Harness: `scripts/harness/stage3g3-{heldout,heldout-check,witness,measure,verify,smoke,regression,satisfiability}.ts` · branch `stage3g3/policy-first`.
