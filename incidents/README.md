# Incidents index

English | [中文](README.zh.md)

This directory holds operational fault-handling records for agent-run-side incidents. This index lists every record and its remediation status; each record lives in its own dated directory with a bilingual README and a complete report.

| ID | Title | Date | Status | Record |
|---|---|---|---|---|
| INC-2026-08-26-01 | Tool emission hijack (session-level generation layer) | 2026-08-26 | 🟡 未确认修复 | [2026-08-26-tool-emission-hijack](2026-08-26-tool-emission-hijack/README.md) |
| INC-2026-08-26-02 | lbowl pre-existing doc-sync failures | 2026-08-26 | 🟡 未确认修复 | [2026-08-26-lbowl-doc-sync-failures](2026-08-26-lbowl-doc-sync-failures/README.md) |

## Status vocabulary

- 🟡 **未确认修复 (fix not yet confirmed)** — the record is logged and the investigation may already be closed, but remediation has not landed or has not been verified.
- ✅ **已确认修复 (fix confirmed)** — remediation landed and was verified; the row names the fixing commit or session.

## Adding a record

- Create a dated directory `incidents/<date>-<slug>/` with the complete report and a bilingual `README` pair registered through `verify-translation-pairing --write`.
- Assign the next `INC-<date>-NN` ID and add one row to this index in the same change.
- Update the row's status when remediation lands; keep the fault record itself in place.
