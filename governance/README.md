# Governance

English | [中文](README.zh.md)

This directory holds the fork workflow governance rules for this repository: how the `lbowl` work branch, the fork's `master` mirror, and upstream stay in sync while local fixes, fault records, and governance documents coexist without polluting `master`.

## Files

- [repo-sync.md](repo-sync.md) — repository update discipline (Chinese): topology, three disciplines, red lines, standard command sequences, and conflict handling.
- [agent-run-health-probe.md](agent-run-health-probe.md) — agent run health discipline (Chinese): mandatory write-path health probe, model/session switch on recurrence, and the enabled deployment guardrails.
- [guardrail-smoke-check.md](guardrail-smoke-check.md) — guardrail acceptance procedure (Chinese): the hardStop and spill self-checks with pass/fail criteria.

## Core disciplines

1. All local work (fixes, fault records, governance docs) lands on `lbowl` only and pushes to `origin/lbowl`; nothing is committed to `master`.
2. Upstream sync is merge-forward: merge `upstream/master` into `lbowl`, resolve conflicts locally, then push `lbowl`.
3. The fork's `master` is a pure mirror: `git merge --ff-only upstream/master` is the only operation allowed there — the mechanical guard against pollution.
