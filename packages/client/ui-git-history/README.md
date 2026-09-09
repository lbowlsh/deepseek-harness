---
description: "Git history graph overlay: read-only commit DAG, refs, and file diff for the workspace repository, for users and maintainers of the repository view."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-history

English | [中文](README.zh.md)

## Summary

This package renders the repository history of the deployment workspace in the Web GUI: a sidebar footer action (⑂) opens a frame-wide overlay that draws the commit DAG as SVG lanes beside a commit list, and a detail pane shows one commit's message, changed files, and per-file unified patch. Data comes from the host's `git` Remote namespace (`@deepseek-ai/dsh-api-git-controller`); the viewer is strictly read-only and never writes to the repository.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin alongside the runtime and the git controller; the ⑂ footer action then appears at the bottom of the sidebar. A click opens the overlay and loads the newest 200 commits plus the branch/tag/HEAD decoration set. Clicking a commit row moves the detail pane to that commit; clicking one of its changed files loads the file's patch inside the pane. The overlay closes on Escape-less backdrop click (the × button or the backdrop itself); the store keeps the panel open and the selected commit across sidebar collapses.

### When it is empty

A workspace outside a Git work tree shows "This directory is not a Git repository"; a work tree without commits shows "No commits yet". Both states are data answers from the controller, not failures.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package contributes two entries: `sidebar.footer.action` (`GitHistoryToggle`) and `shell.overlay` (`GitHistoryOverlay`), both bound to one shared viewing store (`createGitHistoryStore`) so the toggle and panel share the open/close and selection axes. The git calls arrive through the register-time inject face as four plain async callbacks over `ctx.remote.git`; components never see `ctx` or the Remote service object. The graph column layout assigns lanes oldest-first with greedy lane reuse and draws cubic-bezier child→parent connectors, so a merge renders as a proper fork/join even when parents are older than a sibling's tip. The detail pane loads `show` on selection and `fileDiff` lazily per clicked file.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the overlay is not enough. They move from the drawing to the data and the shell seams it uses.

- [git-controller](../../api/git-controller/README.md) — the Remote namespace this overlay reads.
- [Slots reference](../../../docs/subsystems/slots.md) — the slot composition this package registers into (`sidebar.footer.action`, `shell.overlay`).
- [Web client architecture](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.md) — how browser plugin rows load and register slots.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

These limits define when this overlay is a poor fit. They are current package constraints, not a task backlog.

- **One repository, newest 200 commits** — the graph shows the deployment workspace's repository only, truncated to the loaded page with no pagination control.
- **Read-only by design** — no checkout, branch, or write operations exist; the viewer never modifies the repository.
- **Patch preview only** — the file diff pane shows unified patch text without syntax highlighting or side-by-side rendering.
- **CSS palette not tokenized** — the overlay styles use literal colors rather than `--dsw-*` theme tokens; a theme change will not restyle the overlay.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and directions that are not decided. It is explicitly non-authoritative — shipped behavior, limits, and accepted rationale live in the sections above, the package code, and the linked Agent Notes.

The [git-history feature note](../../../.agents/notes/implemented/feature/2026-08-16-web-git-history-viewer.md) records the original design under the former apiproxy wiring; the [migration note](../../../.agents/notes/implemented/architecture/2026-09-09-git-history-controller-migration.md) records the move onto the Typert Remote assembly after the apiproxy removal upstream.

</details>
