# @deepseek-ai/dsh-client-ui-git-history

Read-only Git history viewer for the web GUI: a sidebar footer action opens a
frame-wide overlay that renders the workspace repository's commit DAG (SVG
lanes), a commit list, and a commit-detail pane with per-file patches. Data is
served by the host `git` API domain (added to `@deepseek-ai/dsh-host-apiproxy`),
which runs `git` in the deployment workspace root.

## Surfaces

- `sidebar.footer.action` (`id: 'git-history'`) — the toggle beside Settings.
- `shell.overlay` (`id: 'git-history'`) — the overlay panel. One shared store
  handle (`createGitHistoryStore`) drives open/close and commit selection.

## Model Experience

None — this is a browser-side viewer; it contributes no tool, prompt section,
or event to a model request. It reads the host over the shared connection's
`git.log` / `git.show` / `git.fileDiff` / `git.refs` endpoints.

#### KV Cache effect

None; the package neither assembles nor sends a provider request.
