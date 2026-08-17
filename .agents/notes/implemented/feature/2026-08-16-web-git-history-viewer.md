# Agent Note: Web git history viewer

Status: implemented

English | [中文](2026-08-16-web-git-history-viewer.zh.md)

## Problem

DSH is a coding agent that works inside the user's Git workspace, but the Web GUI had no way to show that workspace's history — commit DAG, branches, tags, per-file diffs. Reviewing what the agent (or a collaborator) changed required leaving the GUI for the command line. The browser cannot read the workspace filesystem directly, so the data has to come from the host.

## Decision

Shipped a read-only Git history viewer in two halves: a `git.*` API domain on the host and a `@deepseek-ai/dsh-client-ui-git-history` client plugin.

The host domain (`git.log` / `git.show` / `git.fileDiff` / `git.refs`) runs `git` in the deployment workspace root and returns typed data — commit rows, name-status file lists, unified patches, and branch/tag refs — parsed from `git`'s NUL-separated output behind Zod schemas. It is read-only by construction: the domain hardcodes the `git` subcommands it accepts, so no client input can reach a write command. Execution now goes through the managed subprocess seam (see the [subprocess-seam note](../architecture/2026-08-17-git-domain-subprocess-seam.md)).

The client plugin contributes a sidebar footer action (`sidebar.footer.action`, id `git-history`) that opens a frame-wide `shell.overlay` (id `git-history`) rendering the commit DAG as SVG lanes, a commit list, and a commit-detail pane with per-file patches. One shared `createGitHistoryStore()` handle drives open/close and commit selection across both entries. The client reads the host over the shared connection's existing RPC carrier — no new transport.

Wiring follows the client-plugin checklist's three registration surfaces: the `tsconfig.client.json` aggregate reference, the `web-app` bundle `cordis.patch.yml` `dsh.client` row, and the `web-app` `package.json` dependency.

## Alternatives considered

- **Reuse the shell/bash capability**: rejected — bash runs in the sandbox against the model's workspace view rather than the host deployment root, and returns raw text; the viewer needs structured, typed data over the existing RPC carrier.
- **A generic host "run command" endpoint**: rejected — a narrow, read-only `git` domain is a far smaller attack surface than arbitrary command execution, and it gives the client a typed contract instead of unparsed text to re-parse in the browser.
- **Parse `.git` in the browser**: rejected — the browser has no access to the workspace filesystem; the data must be read host-side.

## Consequences

- The viewer is pure presentation: it contributes no tool, prompt section, or session event, so it can never enter the model-visible surface or the session log.
- The host domain is read-only and bounded: commit list length is capped (`maxCount`, default 300), and output buffering is the subprocess seam's bound (64 MiB tail plus spill — see the subprocess-seam note).
- A workspace that is not a Git repo, or whose HEAD is unborn, degrades to the client's empty state rather than an error, matching the viewer's purpose as an optional aid.
- The domain is part of the shared `ApiProxy`/`IApiClient` contract and the client/handler test fakes, so it rides the existing contract and test surface instead of a bespoke channel. The `git` domain carries no protocol version because client and host ship together in this fork.
- Deferred: the host domain still lives inside `api-proxy.ts`; moving it to a standalone Typert Remote package would shrink the apiproxy conflict surface at the cost of a new package plus a remotes mount.
