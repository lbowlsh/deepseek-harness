/**
 * git domain contract. Read-only Git history projection for the browser:
 * the host runs `git` in the workspace root and returns typed commit data.
 * No protocol version: client and host ship together.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One commit row of the history graph. */
export interface GitCommit {
  /** Full object hash. */
  hash: string
  /** Parent hashes (empty for a root commit). */
  parents: string[]
  /** Author name. */
  authorName: string
  /** Author email. */
  authorEmail: string
  /** Author date, strict ISO-8601. */
  authorDate: string
  /** Commit date, strict ISO-8601. */
  commitDate: string
  /** Subject line (first line of the message). */
  subject: string
  /** Raw ref decorations at this commit (branch/tag/HEAD names). */
  refs: string[]
}

/** git.log response value. */
export interface GitLogValue {
  /** Absolute repository root discovered by `git rev-parse --show-toplevel`. */
  repoRoot: string
  /** False when the workspace is not inside a Git work tree (or has no commits). */
  repo: boolean
  /** Commits in reverse-chronological order. */
  commits: GitCommit[]
  /** True when the host cut the list at its bound. */
  truncated: boolean
}

/** One changed file of a commit. */
export interface GitDiffFile {
  /** Status letter(s) from `git show --name-status` (M/A/D/R/C/T). */
  status: string
  /** Repo-relative file path. */
  path: string
}

/** git.show response value. */
export interface GitShowValue {
  /** The shown commit's hash. */
  hash: string
  /** Subject line. */
  subject: string
  /** Full body (subject excluded). */
  body: string
  /** Changed files with their status. */
  files: GitDiffFile[]
}

/** git.fileDiff response value. */
export interface GitFileDiffValue {
  /** The commit's hash. */
  hash: string
  /** The file path. */
  path: string
  /** Unified patch text for that file (may be empty for binary files). */
  patch: string
}

/** git.refs response value. */
export interface GitRefsValue {
  /** Current HEAD branch short name (empty when detached). */
  head: string
  /** Branch short names. */
  branches: string[]
  /** Tag short names. */
  tags: string[]
}

/** Git-domain unary methods (the map keys git.* of RpcMethodMap). */
export interface GitApi {
  /** List the commit DAG of the workspace repository, newest first. */
  log(request: RpcRequest<{ maxCount?: number }>): Promise<RpcResponse<GitLogValue>>
  /** Show one commit's message and changed-file list. */
  show(request: RpcRequest<{ hash: string }>): Promise<RpcResponse<GitShowValue>>
  /** Show the unified patch of one file within one commit. */
  fileDiff(request: RpcRequest<{ hash: string; path: string }>): Promise<RpcResponse<GitFileDiffValue>>
  /** List branches, tags, and the current HEAD. */
  refs(request: RpcRequest<{}>): Promise<RpcResponse<GitRefsValue>>
}
