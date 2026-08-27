# Fault handling record: 2026-08-26 lbowl pre-existing doc-sync failures

English | [中文](README.zh.md)

This directory records one independent fault: the pre-existing `pnpm run doc-sync` gate failures on the `lbowl` branch, captured at commit `0ad9f0edbb` after the INC-2026-08-26-01 record landed. The fault is logged here; remediation is pending.

| Item | Value |
|---|---|
| Incident ID | INC-2026-08-26-02 |
| Date recorded | 2026-08-26 |
| Location | `lbowl` branch of deepseek-harness (none of the failures exists on `master`) |
| Scope | 7 doc-sync gates: markdown wrap, translation pairing, package README model experience, package README limitations, cordis catalog, client catalog, config catalog |
| Status | 🟡 OPEN — recorded, remediation pending |
| Relation | Independent of INC-2026-08-26-01 (tool emission hijack); the `incidents/` directory itself passes every applicable gate |

## Files

- [report-2026-08-26.md](report-2026-08-26.md) — the complete fault report (Chinese): per-gate violations, evidence, attribution, and per-item remediation.

## Conclusion summary

1. **Four failures come from one in-flight feature**: `packages/client/ui-git-history` (lbowl-local commit 2fbd4a0eff) ships a README that violates markdown wrap, bilingual pairing, model-experience, and known-limitations requirements at once.
2. **Three failures are stale generated catalogs**: `docs/subsystems/typert.md(.zh.md)`, `docs/config-catalog.md`, and `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` went stale after lbowl-local refactors (agent team renames) and upstream merges; regenerating each with its `gen-*` command fixes them.
3. **All seven are lbowl-local**: none exists on `origin/master` (47f943859b); the introducing commits 2fbd4a0eff, 70a3bf4554, and 50a953fef3 are lbowl-local, and the typert catalog staleness comes from lbowl source drift, not from master.
4. **Remediation is mechanical per item** (report §4); none of the failures is caused by the `incidents/` directory, which passes pairing, markdown wrap, and doc budgets.
