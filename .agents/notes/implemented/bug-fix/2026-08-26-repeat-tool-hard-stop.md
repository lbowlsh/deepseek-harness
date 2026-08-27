# Agent Note: repeat-tool-reminder hard stop (pre-dispatch circuit breaker)

Status: implemented

English | [中文](2026-08-26-repeat-tool-hard-stop.zh.md)

## Problem

The repeat-tool-reminder guard was advisory only: it injected escalating reminders at configured consecutive-repeat thresholds but never stopped the loop. Incident INC-2026-08-26-01 (tool emission hijack) recorded a kimi-coding/k3 session that emitted the same zero-argument MCP tool 23 times in a row; three reminders fired and the loop continued across turns until the agent switched channels by itself. Deepseek-model sessions with the same tool surface never reproduced the loop, so the defect is model-level — the harness cannot fix the generation, but it can stop the loop it observes.

## Decision

Add an opt-in hard circuit breaker to `@deepseek-ai/dsh-repeat-tool-reminder`: config `hardStop: { enabled, at }` (defaults `false` / `10`; `at` validated as an integer >= 2 at load, fail-loud). When enabled, the guard's own `tools/pre-execute` listener denies — before dispatch, so the tool body never runs — the tracked call whose consecutive identical run would reach `at`, and every further identical attempt stays denied until the agent changes tool or arguments. The deny reason becomes the call's error result (`Error: repeat-tool-reminder hard stop: ...`), bounded by the existing `argumentsPreviewChars` preview. Denied calls still pass `tools/post-execute`, where the existing `observe` advance keeps the chain counting — the breaker holds without a second counter, and the chain advance stays single-sourced in post-execute (`nextCount` only reads).

The default remains advisory: shipped defaults are unchanged, so no existing transcript or configuration changes behavior.

## Alternatives considered

- **Post-execute block at a high threshold** — rejected: the tool body has already run by post-execute, so a write-tool loop (the incident's feared variant) would keep writing; pre-execute denial prevents the N-th execution entirely.
- **A separate guard package** — rejected: the chain, tracking predicates, canonicalization, and reset semantics already live here; a second package would duplicate them.
- **Hard stop always on** — rejected: it changes shipped behavior for every deployment and can deny legitimate slow idempotent polls; opt-in keeps the advisory default and lets each deployment choose the trade-off.
- **A hard context reset instead of denial** — rejected: resetting or rewriting context is a loop-level intervention this guard does not own; a denial with a standalone correction signal is the minimal contract.

## Consequences

- Loop cost is bounded by `at` identical calls per chain run instead of unbounded; the incident's 23-call loop would have stopped at the configured `at` with zero additional executions.
- Deployments that enable the breaker accept denying legitimate idempotent polls past `at`; the pressure valves are `at`/`thresholds`/`exclude`.
- The denial text is new model-visible output, covered by the package's real-loop tests (a mock adapter drives an assembled agent loop; assertions pin the error text and prove the body never runs).
- `hardStop` joins the config catalog (regenerated with this change) and the package README bilingual pair.

## Related

- [Incident INC-2026-08-26-01 report](../../../../incidents/2026-08-26-tool-emission-hijack/report-2026-08-26.md)
