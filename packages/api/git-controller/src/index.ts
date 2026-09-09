/**
 * Read-only Git history Remote owner for the browser. The host runs `git` in
 * the deployment workspace root and returns typed commit data: the commit
 * DAG, one commit's message and file list, one file's unified patch, and the
 * branch/tag/HEAD decoration set. Every `git` process routes through the
 * managed subprocess seam, which scrubs credential-shaped environment names
 * from the child and terminates a still-running tree at service disposal.
 * The domain is read-only by construction: each call hard-codes the exact
 * `git` subcommands it runs, so no client input reaches a write command.
 * @module @deepseek-ai/dsh-api-git-controller
 */

import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessOutputReader, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  GitCommit, GitDiffFile, GitFileDiffValue, GitLogValue, GitRefsValue, GitShowValue,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `git` Remote namespace. */
    gitController: GitController
  }
}

/** In-memory tail cap for one `git` invocation's stdout (the old `execFile` `maxBuffer` bound). */
const GIT_STDOUT_MAX_BYTES = 64 * 1024 * 1024
/** In-memory tail cap for stderr, enough to form a failure message. */
const GIT_STDERR_MAX_BYTES = 1024 * 1024
/** SIGTERM → SIGKILL escalation window for a managed `git` process tree. */
const GIT_GRACE_MS = 10_000
/** Default commit-list bound when the caller sends no `maxCount`. */
const DEFAULT_LOG_MAX_COUNT = 300

/** Recover one collected stream's complete text, reading its spill file when the tail lost its head. */
async function fullCollectedText(reader: SubprocessOutputReader): Promise<string> {
  const read = reader.readFrom(0)
  if (!read.lossy) return read.text
  if (read.spillPath === undefined) {
    throw new Error('git output exceeded the retained buffer and its spill file was discarded')
  }
  return readFile(read.spillPath, 'utf8')
}

/** The stderr tail, enough to form a failure message (the spill head is not needed). */
function stderrText(reader: SubprocessOutputReader | undefined): string {
  return reader?.readFrom(0).text ?? ''
}

/**
 * Run `git` in a working directory and return its full utf8 stdout.
 *
 * Routing through the managed subprocess seam instead of spawning `git`
 * directly buys two guarantees for free: credential-shaped environment names
 * are scrubbed from the child, and a still-running tree is terminated and
 * joined when the subprocess service disposes.
 * @param ctx - host context providing the subprocess service.
 * @param cwd - working directory (the deployment workspace root).
 * @param args - `git` argv (the `git` binary is implicit).
 * @returns full stdout (spill-recovered when the tail window truncated).
 * @throws when the subprocess service is absent or `git` exits non-zero.
 */
async function runGit(ctx: Context, cwd: string, args: string[]): Promise<string> {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) {
    throw new Error('git api requires the subprocess service; load @deepseek-ai/dsh-subprocess-local')
  }
  const spec: SubprocessSpawnSpec = {
    argv: ['git', ...args],
    cwd,
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: GIT_STDOUT_MAX_BYTES, spill: { maxBytes: GIT_STDOUT_MAX_BYTES } },
      stderr: { maxBytes: GIT_STDERR_MAX_BYTES },
    },
    graceMs: GIT_GRACE_MS,
  }
  const handle = subprocess.spawn(spec)
  const outcome = await handle.done
  if (outcome.exitCode !== 0) {
    const detail = stderrText(handle.collected.stderr).trim()
    throw new Error(detail.length > 0 ? detail : `git exited with code ${String(outcome.exitCode)}`)
  }
  const stdout = handle.collected.stdout
  if (stdout === undefined) {
    throw new Error('subprocess implementation dropped the collected stdout stream')
  }
  return fullCollectedText(stdout)
}

/** One `git log` row, NUL-separated fields on one line. */
function parseCommitLine(line: string): GitCommit {
  const [hash, parents, authorName, authorEmail, authorDate, commitDate, refs, subject] = line.split('\0')
  return {
    hash: hash ?? '',
    parents: (parents ?? '').split(' ').filter(parent => parent.length > 0),
    authorName: authorName ?? '',
    authorEmail: authorEmail ?? '',
    authorDate: authorDate ?? '',
    commitDate: commitDate ?? '',
    subject: subject ?? '',
    refs: (refs ?? '').split(', ').filter(ref => ref.length > 0),
  }
}

/**
 * Host service backing the generated `ctx.remote.git` namespace. The service
 * owns no mutable state; the workspace root is fixed at construction, so a
 * deployment answers for exactly one repository tree.
 */
export class GitController extends TypertRemoteService {
  /**
   * Register the git namespace and pin the deployment workspace root.
   * @param ctx - host context providing the subprocess service.
   * @param cwd - directory `git` starts from (defaults to the process cwd).
   */
  constructor(ctx: Context, cwd: string = process.cwd()) {
    super(ctx, 'gitController', { namespace: 'git' })
    this.cwd = cwd
  }

  private readonly cwd: string

  /**
   * List the commit DAG of the workspace repository, newest first.
   * @param maxCount - commit-list bound (default 300).
   * @returns the repository facts and commits; `repo: false` when the workspace is not inside a Git work tree.
   * @throws RemoteError when `git log` itself fails.
   */
  @Remote
  async log(maxCount?: number): Promise<GitLogValue> {
    let repoRoot: string
    try {
      repoRoot = (await runGit(this.ctx, this.cwd, ['rev-parse', '--show-toplevel'])).trim()
    } catch {
      // Not inside a work tree: report it rather than erroring, so the
      // client can render the empty state instead of a transport failure.
      return { repoRoot: this.cwd, repo: false, commits: [], truncated: false }
    }
    try {
      await runGit(this.ctx, repoRoot, ['rev-parse', '--verify', 'HEAD'])
    } catch {
      // Inside a work tree with no commits yet (HEAD unborn).
      return { repoRoot, repo: true, commits: [], truncated: false }
    }
    const bound = maxCount ?? DEFAULT_LOG_MAX_COUNT
    try {
      const out = await runGit(this.ctx, repoRoot, [
        'log', `-n${bound}`,
        '--format=%H%x00%P%x00%an%x00%ae%x00%aI%x00%cI%x00%D%x00%s',
      ])
      const commits = out.split('\n').filter(line => line.length > 0).map(parseCommitLine)
      return { repoRoot, repo: true, commits, truncated: commits.length >= bound }
    } catch (error: unknown) {
      throw new RemoteError('git/log-failed', failureMessage('git log', error), {}, { cause: error })
    }
  }

  /**
   * Show one commit's message and changed-file list.
   * @param hash - commit to show.
   * @returns the commit hash, subject, body, and changed files.
   * @throws RemoteError when `git show` fails.
   */
  @Remote
  async show(hash: string): Promise<GitShowValue> {
    try {
      const [msg, nameStatus] = await Promise.all([
        runGit(this.ctx, this.cwd, ['show', '-s', '--format=%H%x00%s%x00%b', hash]),
        runGit(this.ctx, this.cwd, ['show', '--format=', '--name-status', hash]),
      ])
      const [commitHash, subject, body] = msg.split('\0')
      const files: GitDiffFile[] = nameStatus.split('\n').filter(line => line.length > 0).map((line) => {
        const [status, ...rest] = line.split('\t')
        return { status: status ?? '', path: rest.join('\t') }
      })
      return { hash: commitHash ?? hash, subject: subject ?? '', body: body ?? '', files }
    } catch (error: unknown) {
      throw new RemoteError('git/show-failed', failureMessage('git show', error), {}, { cause: error })
    }
  }

  /**
   * Show the unified patch of one file within one commit.
   * @param hash - commit to diff.
   * @param path - repo-relative file path.
   * @returns the unified patch text (may be empty for binary files).
   * @throws RemoteError when `git show` fails.
   */
  @Remote
  async fileDiff(hash: string, path: string): Promise<GitFileDiffValue> {
    try {
      const patch = await runGit(this.ctx, this.cwd, [
        'show', '--format=', '--no-color', '--patch', hash, '--', path,
      ])
      return { hash, path, patch }
    } catch (error: unknown) {
      throw new RemoteError('git/file-diff-failed', failureMessage('git fileDiff', error), {}, { cause: error })
    }
  }

  /**
   * List branches, tags, and the current HEAD.
   * @returns the head branch short name (empty when detached), branch short names, and tag short names.
   * @throws RemoteError when `git for-each-ref` fails.
   */
  @Remote
  async refs(): Promise<GitRefsValue> {
    try {
      const head = await runGit(this.ctx, this.cwd, ['symbolic-ref', '--short', '-q', 'HEAD'])
        .then(out => out.trim())
        .catch(() => '')
      const out = await runGit(this.ctx, this.cwd, [
        'for-each-ref', '--format=%(refname:short)%x00%(objecttype)', 'refs/heads', 'refs/tags',
      ])
      const branches: string[] = []
      const tags: string[] = []
      for (const line of out.split('\n').filter(entry => entry.length > 0)) {
        const [name, type] = line.split('\0')
        if (type === 'tag') tags.push(name ?? '')
        else branches.push(name ?? '')
      }
      return { head, branches, tags }
    } catch (error: unknown) {
      throw new RemoteError('git/refs-failed', failureMessage('git refs', error), {}, { cause: error })
    }
  }
}

/** One failure message naming the git verb and carrying the underlying error text. */
function failureMessage(verb: string, error: unknown): string {
  return `${verb} failed: ${error instanceof Error ? error.message : String(error)}`
}

export default GitController
