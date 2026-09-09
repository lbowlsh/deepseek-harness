---
description: "Read-only Git history Remote for the deployment workspace repository, for users and maintainers choosing, mounting, or debugging the git namespace."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-git-controller

English | [中文](README.zh.md)

## Summary

This package serves read-only Git history to the browser: the host runs `git` in the deployment workspace root and returns typed commit data through the generated `ctx.remote.git` namespace. Four unary calls cover the viewer's needs — the commit DAG, one commit's message and changed-file list, one file's unified patch, and the branch/tag/HEAD decoration set. Every `git` process routes through the managed subprocess seam, which scrubs credential-shaped environment names from the child and terminates a still-running tree at service disposal.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin on the Host when a client needs repository history. The `dsh` web-app bundle enables it; the browser half `@deepseek-ai/dsh-client-ui-git-history` consumes the namespace it registers.

### Calling the namespace

The client calls four methods through the assembly's `ctx.remote.git`:

```ts
await ctx.remote.git.log(200)        // commit DAG, newest first
await ctx.remote.git.show(hash)      // message and changed-file list
await ctx.remote.git.fileDiff(hash, path) // unified patch of one file
await ctx.remote.git.refs()          // branches, tags, and HEAD
```

Every call returns a `RemoteResult`; the failure carries a `git/*` code and the underlying `git` stderr text in its message.

### When to choose it

Choose it when a Client surface shows repository structure — a commit graph, a file's history, a ref list — for the deployment workspace. Avoid it when the directory is not pinned at construction: the service answers for exactly one root, fixed when the controller is created (the deployment process cwd by default).

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains how the controller runs `git` and parses its output; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The controller is built on four commitments:

- **Read-only by construction.** Each call hard-codes the exact `git` subcommands it runs, so no client input reaches a write command. The only client-supplied values are a count bound, a commit hash, and a repo-relative path — all passed as `git` arguments after the fixed verb.
- **Managed subprocesses only.** `git` spawns through `ctx.subprocess` (`@deepseek-ai/dsh-subprocess-local` in the composed app), never `node:child_process`: credential-shaped environment names are scrubbed from the child, and a still-running tree is terminated and joined when the service disposes.
- **Full-output collection.** A 64 MiB stdout tail with spill-file recovery returns complete `log` output; a 1 MiB stderr tail is enough to form a failure message. Spawn, exit, and parse failures surface as typed `RemoteError`s, never raw throws.
- **Not-a-repo is data, not failure.** A workspace outside a work tree answers `repo: false`; an unborn HEAD answers an empty commit list — the client renders an empty state instead of a transport failure.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | The controller: `TypertRemoteService` subclass with four `@Remote` methods |
| [`src/types.ts`](src/types.ts) | Wire vocabulary: commit/show/file-diff/refs values and the `git/*` failure codes |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [api group map](../README.md) — the controller packages beside this one and the Remote layer they form.
- [remote-method-calls Agent Note](../../../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.md) — how `@Remote` methods become typed client calls.
- [git-controller Agent Note](../../../.agents/notes/implemented/architecture/2026-09-09-git-history-controller-migration.md) — the migration of the git domain from the former host api-proxy into this package.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

These limits define when this controller is a poor fit. They are current package constraints, not a task backlog.

- **One pinned root** — the controller answers for the directory fixed at construction; per-session or per-workspace roots are not supported.
- **History bound only by count** — `log` cuts at its bound and reports `truncated`; pagination, path filters, and author filters are not implemented.
- **Patch text only** — `fileDiff` returns unified patch text; binary files yield an empty patch with no notice.
- **No ref mutations** — the namespace is strictly read-only; checkouts, branch operations, and fetch never exist here.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and directions that are not decided. It is explicitly non-authoritative — shipped behavior, limits, and accepted rationale live in the sections above, the package code, and the linked Agent Notes.

The [git-history feature note](../../../.agents/notes/implemented/feature/2026-08-16-web-git-history-viewer.md) records the original two-half design under the former `apiproxy` package; the [migration note](../../../.agents/notes/implemented/architecture/2026-09-09-git-history-controller-migration.md) records the move onto Typert Remote after the apiproxy removal upstream.

</details>
