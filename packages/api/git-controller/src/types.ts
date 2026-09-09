/**
 * git Remote namespace wire vocabulary. Read-only Git history projection for
 * the browser: the host runs `git` in the deployment workspace root and
 * returns typed commit data. No protocol version: client and host ship
 * together.
 */

import type {} from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** `git log` failed after the repository probes succeeded. */
    'git/log-failed': Record<string, never>
    /** `git show` failed. */
    'git/show-failed': Record<string, never>
    /** `git show --patch` for one file failed. */
    'git/file-diff-failed': Record<string, never>
    /** `git for-each-ref` failed. */
    'git/refs-failed': Record<string, never>
  }
}

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
