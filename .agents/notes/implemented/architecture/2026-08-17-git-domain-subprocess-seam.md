# Agent Note: Git history API runs git through the subprocess seam

Status: implemented

English | [中文](2026-08-17-git-domain-subprocess-seam.zh.md)

## Problem

The `git.*` host API domain — the backend of the Web Git-history viewer — spawned `git` directly through `node:child_process` `execFile`. A raw spawn sidesteps the harness's subprocess seam, so the child inherited the full parent environment, including `DEEPSEEK_API_KEY` and other credential-shaped names, and a still-running `git` tree had no owner that would terminate and join it at service teardown.

## Decision

`git.*` now runs through the managed subprocess seam. `runGit` reads `ctx.get('subprocess')` — an optional service read, because the apiproxy does not declare `subprocess` as a required injection — and fails with a clear error when no provider is composed. It then `spawn`s `['git', ...args]` with collected stdout and stderr and a spill file; a non-zero exit becomes the git stderr tail as the error message, and stdout is recovered in full from the in-memory tail or, when that tail truncated, from the spill file.

Routing through the seam buys two guarantees for free: credential-shaped environment names are scrubbed from the child (`SENSITIVE_ENV_PATTERN` plus all `DSH_*`), and a still-running tree is terminated and joined when the subprocess service disposes. The apiproxy now depends on `@deepseek-ai/dsh-subprocess` for types and the `ctx.subprocess` Context merge only; the provider (`dsh-subprocess-local`) is already mounted by the base bundle.

## Alternatives considered

- **Keep `execFile` and scrub/terminate by hand**: rejected — that duplicates the seam's `scrubbedParentEnv` and tree-termination ladder inside the apiproxy, the exact code the seam exists to own.
- **Declare `subprocess` a required injection on `ApiProxyService`**: rejected — the gateway is composed without a subprocess provider in some hosts, and the git domain is an auxiliary read-only surface that can degrade; an optional `ctx.get` keeps the gateway loadable everywhere else.

## Consequences

- `git.*` children no longer inherit `DEEPSEEK_API_KEY` or any `DSH_*` fact, and cannot outlive the subprocess service's disposal.
- Output stays bounded: stdout retains a 64 MiB tail and spills the complete stream to a private temp file, which is read back for parsing; stderr keeps a 1 MiB tail for failure messages.
- The domain depends on the subprocess seam being composed. A host without it reports failing `git.*` calls; `git.log`'s not-a-repo probe swallows that failure into the empty state, matching the pre-existing "git is not installed" behavior.
