# Fault handling record: 2026-08-26 tool emission hijack (session-level generation layer)

English | [中文](README.zh.md)

This directory is an independent fault-handling record in `incidents/`: the complete report and conclusions for an agent-run-side tool emission fault (DeepSeek Harness + kimi-coding/k3). The original incident-freeze document stays in the external Atomos_Workflow_Database project (`docs/incident-analysis-tool-emission-hijack-2026-08-26.md`); this directory holds the independent verification and the corrected conclusions.

| Item | Value |
|---|---|
| Incident ID | INC-2026-08-26-01 |
| Date | 2026-08-26 (one same-pattern recurrence found on 2026-08-25) |
| Faulty session | `session-ef1d28fd-2a15-4c1e-9b83-8eaccffcf81b` (S3a quote lineitem derived-override Stage-1 run, working directory Atomos_Workflow_Database) |
| Model / provider | kimi-coding / k3 (the two other recurring sessions used the same model) |
| Nature | Generation-layer tool-selection defect (model-level), not an MCP platform defect, not a harness adapter defect |
| Status | ✅ fix confirmed and deployment guardrails accepted — hard stop (`c993b39509`), smoke check passed 2026-08-27 |

## Files

- [report-2026-08-26.md](report-2026-08-26.md) — the complete fault report and verification conclusions (Chinese): fact baseline, independent forensic evidence, corrected root cause, disposition status, governance recommendations, and the evidence asset list.

## Conclusion summary

1. **The symptom is real**: the faulty session emitted intended tool calls as the read-only `mcp__shangJi__entity_field_policy_resource_list` (arguments always `{}`) 23 times — the original document's "14+" understates it. The harness repeated-call guard fired exactly 3 reminders (thresholds [3,5,8]); the loop survived turns 3→4; the model's own `tool-call-delta` chunk stream proves the emission came from the generation layer, ruling out transport corruption and adapter renaming.
2. **The platform is innocent, zero mis-writes hold**: during the fault window the platform only received the session's intended `debug_sql` writes (C2 rule-set retirement + 4 schema changes + faithfully backfilled audit events seq 17–20).
3. **Two corrections to the original document**: a) it was not "a single affected session" — the same loop recurred in 3 kimi-k3 sessions (25 / 18 / 23 calls) with zero recurrence in deepseek-model sessions; b) the H1 "recently legitimately called" premise fails — in the faulty session the tool's first appearance was the loop itself. The leading root cause is revised to a **kimi-coding/k3 model-level tool-call selection defect: collapse onto a zero-required-argument tool plus self-locking**.
4. **Disposition**: Stage-1 (C2/C3a-d) verified landed; Stage-2 C1 (override guard + line_amount derivation) landed the same day at 17:22 CST through a healthy channel (`c6d8cdbf` now contains the guard); C4 and probes V0-V6 remain open. The deployed guardrails passed the 2026-08-27 acceptance smoke check (`governance/guardrail-smoke-check.md`): the 9th consecutive identical `bash` call was denied before dispatch with the hard-stop error, and a 20,001-byte `cat` result was capped to a 16 KiB inline preview with the remainder retrievable from the spill artifact path.
