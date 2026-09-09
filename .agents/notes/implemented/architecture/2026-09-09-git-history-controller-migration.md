# Agent Note: Git history controller migrates to its own Typert Remote package

Status: implemented

English | [中文](2026-09-09-git-history-controller-migration.zh.md)

## Problem

The [Web git-history viewer](../feature/2026-08-16-web-git-history-viewer.md) backend — the fork-local `git.*` host domain — lived inside the host `apiproxy` package, a surface upstream never merged. Upstream migrated apiproxy's RPCs onto Typert Remotes and removed the package on 2026-08-27; the fork's 2026-09-09 upstream sync merge deleted the directory wholesale, taking the git domain and its fork-local subprocess-seam edits with it. The routing decision recorded in the [subprocess seam note](2026-08-17-git-domain-subprocess-seam.md) needed a home that is not a resurrected apiproxy.

## Decision

The git domain ships as `@deepseek-ai/dsh-api-git-controller`, an `api`-group controller package beside the other Remote-owning controllers. `GitController` subclasses `TypertRemoteService` with four read-only unary `@Remote` methods — `log`, `show`, `fileDiff`, and `refs`; the wire vocabulary is defined in the package, and the generator-emitted `zod` schemas are published runtime files behind the `./typert` host contributor and `./remote` client entry. The remotes gateway (`@deepseek-ai/dsh-api-remotes`) mounts the Remote contribution so the assembly exposes `ctx.remote.git`; the web-app bundle registers the plugin and the `ui-git-history` client overlay that consumes the namespace. Every `git` spawn still routes through `ctx.subprocess` with scrubbed credential-shaped environment and tree termination at disposal, per the [seam note](2026-08-17-git-domain-subprocess-seam.md).

This executes FORK-PLAN Backlog #5 — moving the git domain into an independent Typert Remote package mounted by one-line registrations — under the `api` group's controller naming convention.

## Alternatives considered

- **Host the domain in a fork-local `apiproxy` clone**: rejected — upstream removed the package deliberately, and a resurrected aggregate would restore the fork's largest conflict surface for one read-only domain.
- **Fold the controller into the remotes gateway package**: rejected — the gateway is the client-facing Remote assembly, while a subprocess-running controller belongs on the host; the `api` group separates those faces into distinct packages.
- **Wait for an upstream git Remote**: rejected — the viewer is fork-only (see the [feature note](../feature/2026-08-16-web-git-history-viewer.md)), so no upstream migration target exists to wait for.

## Consequences

- The fork's conflict surface shrinks from edits inside `apiproxy` to dependency rows and one-line registrations in the gateway and the web-app bundle.
- The package declares `zod` as a runtime dependency: the generated schemas import it from published files, and an undeclared runtime dependency surfaces only after a from-scratch install.
- The seam note now names this package as the domain's home; the routing decision it records is unchanged.
- Per the [targeted method calls note](2026-08-02-typert-remote-method-calls.md), each `@Remote` method remains a typed client call with no protocol version, because client and host ship together.
