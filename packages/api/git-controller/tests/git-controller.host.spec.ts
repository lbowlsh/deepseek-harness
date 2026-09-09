/**
 * git Remote namespace: routing through the managed subprocess seam and
 * output parsing. The subprocess service is scripted, so no real `git` runs.
 */

import { describe, expect, it, vi } from 'vitest'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { SubprocessHandle, SubprocessOutputReader, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import GitController from '../src/index.ts'

function reader(text: string): SubprocessOutputReader {
  return { readFrom: () => ({ text, nextOffset: text.length, lossy: false }) }
}

interface ScriptedRun {
  stdout: string
  stderr?: string
  exitCode?: number
}

function makeHandle(run: ScriptedRun): SubprocessHandle {
  return {
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    collected: { stdout: reader(run.stdout), stderr: reader(run.stderr ?? '') },
    done: Promise.resolve({ exitCode: run.exitCode ?? 0, signal: null }),
    terminate: () => {},
    waitForExit: () => Promise.resolve(true),
  }
}

/** A subprocess service that routes `git` argv → scripted runs and records every spawn spec. */
function scriptedSubprocess(script: (args: string[]) => ScriptedRun) {
  const spawn = vi.fn((spec: SubprocessSpawnSpec): SubprocessHandle => {
    const [program, ...args] = spec.argv
    expect(program).toBe('git')
    return makeHandle(script(args))
  })
  return { spawn }
}

/** Mount the controller with a scripted subprocess service pinned to `/repo`. */
async function boot(script: (args: string[]) => ScriptedRun): Promise<{
  controller: GitController
  spawn: ReturnType<typeof scriptedSubprocess>['spawn']
}> {
  const ctx = new Context()
  const { spawn } = scriptedSubprocess(script)
  ctx.provide('subprocess', { spawn } as never)
  await ctx.plugin(GitController, '/repo')
  return { controller: ctx.gitController, spawn }
}

/** Mount the controller with a fixed handle returned for every spawn. */
async function bootFixed(handle: SubprocessHandle): Promise<GitController> {
  const ctx = new Context()
  ctx.provide('subprocess', { spawn: () => handle } as never)
  await ctx.plugin(GitController, '/repo')
  return ctx.gitController
}

describe('git Remote namespace', () => {
  it('publishes the four read-only methods from its own service key', async () => {
    const { controller } = await boot(() => ({ stdout: '' }))
    expect(controller.typertRemote.serviceKey).toBe('gitController')
    expect(controller.typertRemote.namespace).toBe('git')
    expect(remoteMethods(controller)).toEqual([
      { method: 'log', invocation: { kind: 'direct' } },
      { method: 'show', invocation: { kind: 'direct' } },
      { method: 'fileDiff', invocation: { kind: 'direct' } },
      { method: 'refs', invocation: { kind: 'direct' } },
    ])
  })

  it('log routes git through the subprocess seam and parses commit rows', async () => {
    const { controller, spawn } = await boot((args) => {
      const key = args.join(' ')
      if (key === 'rev-parse --show-toplevel') return { stdout: '/repo\n' }
      if (key === 'rev-parse --verify HEAD') return { stdout: 'abc\n' }
      return {
        stdout: [
          ['abc', 'def ghi', 'Alice', 'alice@x', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', 'HEAD -> master, origin/master', 'First'],
          ['def', '', 'Bob', 'bob@x', '2026-01-03T00:00:00Z', '2026-01-04T00:00:00Z', '', 'Second'],
        ].map(fields => fields.join('\x00')).join('\n'),
      }
    })

    const value = await controller.log(300)

    expect(value).toMatchObject({ repoRoot: '/repo', repo: true, truncated: false })
    expect(value.commits).toEqual([
      {
        hash: 'abc', parents: ['def', 'ghi'], authorName: 'Alice', authorEmail: 'alice@x',
        authorDate: '2026-01-01T00:00:00Z', commitDate: '2026-01-02T00:00:00Z',
        subject: 'First', refs: ['HEAD -> master', 'origin/master'],
      },
      {
        hash: 'def', parents: [], authorName: 'Bob', authorEmail: 'bob@x',
        authorDate: '2026-01-03T00:00:00Z', commitDate: '2026-01-04T00:00:00Z',
        subject: 'Second', refs: [],
      },
    ])
    const logCall = spawn.mock.calls.find(([spec]) => (spec.argv as string[])[1] === 'log')?.[0]
    expect(logCall).toMatchObject({ cwd: '/repo', argv: ['git', 'log', '-n300', expect.stringContaining('--format=')] })
  })

  it('log reports not-a-repo when the toplevel probe fails', async () => {
    const { controller } = await boot(() => ({ stdout: '', stderr: 'fatal: not a git repository', exitCode: 128 }))
    await expect(controller.log()).resolves.toEqual({ repoRoot: '/repo', repo: false, commits: [], truncated: false })
  })

  it('log reports an empty repo when HEAD is unborn', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return { stdout: '/repo\n' }
      return { stdout: '', stderr: 'fatal: bad revision', exitCode: 128 }
    })
    await expect(controller.log()).resolves.toEqual({ repoRoot: '/repo', repo: true, commits: [], truncated: false })
  })

  it('log maps a failing log invocation onto a git/log-failed RemoteError', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'log') return { stdout: '', stderr: 'fatal: bad object', exitCode: 128 }
      return { stdout: 'ok\n' }
    })
    await expect(controller.log()).rejects.toMatchObject({ code: 'git/log-failed' })
    await expect(controller.log()).rejects.toThrow(/git log failed/)
  })

  it('show parses the message and name-status files', async () => {
    const { controller } = await boot((args) => {
      if (args[1] === '-s') return { stdout: ['abc', 'Subject line', 'Body text'].join('\x00') }
      return { stdout: ['M\tfile.ts', 'A\tnew.ts'].join('\n') }
    })

    const value = await controller.show('abc')

    expect(value).toEqual({
      hash: 'abc', subject: 'Subject line', body: 'Body text',
      files: [{ status: 'M', path: 'file.ts' }, { status: 'A', path: 'new.ts' }],
    })
  })

  it('fileDiff returns the patch and refs parse branches, tags, and head', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'show') return { stdout: 'diff --git a/file.ts b/file.ts\n' }
      if (args[0] === 'symbolic-ref') return { stdout: 'main\n' }
      return { stdout: ['main\x00commit', 'feature/x\x00commit', 'v1.0\x00tag'].join('\n') }
    })

    await expect(controller.fileDiff('abc', 'file.ts'))
      .resolves.toEqual({ hash: 'abc', path: 'file.ts', patch: 'diff --git a/file.ts b/file.ts\n' })
    await expect(controller.refs()).resolves.toEqual({ head: 'main', branches: ['main', 'feature/x'], tags: ['v1.0'] })
  })

  it('refs treats a detached HEAD as an empty head', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'symbolic-ref') return { stdout: '', stderr: 'fatal: ref HEAD is not a symbolic ref', exitCode: 1 }
      return { stdout: '' }
    })

    await expect(controller.refs()).resolves.toEqual({ head: '', branches: [], tags: [] })
  })

  it('fileDiff maps a failing invocation onto a git/file-diff-failed RemoteError', async () => {
    const { controller } = await boot(() => ({ stdout: '', stderr: 'fatal: ambiguous argument', exitCode: 128 }))
    await expect(controller.fileDiff('nope', 'x.ts')).rejects.toMatchObject({ code: 'git/file-diff-failed' })
  })

  it('show and refs map failing invocations onto their RemoteError codes', async () => {
    const { controller } = await boot((args) => {
      if (args[1] === '-s') return { stdout: '', stderr: 'fatal: bad revision', exitCode: 128 }
      return { stdout: '', stderr: 'fatal: out of memory', exitCode: 128 }
    })
    await expect(controller.show('nope')).rejects.toMatchObject({ code: 'git/show-failed' })
    await expect(controller.refs()).rejects.toMatchObject({ code: 'git/refs-failed' })
  })

  it('reports an actionable error when the subprocess service is absent', async () => {
    const ctx = new Context()
    await ctx.plugin(GitController, '/repo')
    await expect(ctx.gitController.show('abc')).rejects.toThrow(/requires the subprocess service/)
  })

  it('falls back to the exit code when a failing git leaves no stderr', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'log') return { stdout: '', exitCode: 7 }
      return { stdout: 'ok\n' }
    })
    await expect(controller.log()).rejects.toThrow(/git exited with code 7/)
  })

  it('reports a dropped collected stdout stream as a failure', async () => {
    const controller = await bootFixed({
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stderr: reader('') },
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate: () => {},
      waitForExit: () => Promise.resolve(true),
    })
    await expect(controller.fileDiff('abc', 'file.ts')).rejects.toThrow(/dropped the collected stdout stream/)
  })

  it('reports a lost spill file when the collected tail dropped its head', async () => {
    const lossy = { readFrom: () => ({ text: 'tail', nextOffset: 5, lossy: true }) }
    const controller = await bootFixed({
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: lossy, stderr: reader('') },
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate: () => {},
      waitForExit: () => Promise.resolve(true),
    })
    await expect(controller.fileDiff('abc', 'file.ts')).rejects.toThrow(/spill file was discarded/)
  })

  it('recovers the full output from the spill file when the tail dropped its head', async () => {
    const spill = join(tmpdir(), `git-controller-spill-${process.pid}.txt`)
    await writeFile(spill, 'diff --git a/file.ts b/file.ts\n', 'utf8')
    try {
      const lossy = { readFrom: () => ({ text: 'tail', nextOffset: 5, lossy: true, spillPath: spill }) }
      const controller = await bootFixed({
        stdin: undefined,
        stdout: undefined,
        stderr: undefined,
        collected: { stdout: lossy, stderr: reader('') },
        done: Promise.resolve({ exitCode: 0, signal: null }),
        terminate: () => {},
        waitForExit: () => Promise.resolve(true),
      })
      await expect(controller.fileDiff('abc', 'file.ts')).resolves.toMatchObject({ patch: 'diff --git a/file.ts b/file.ts\n' })
    } finally {
      await rm(spill, { force: true })
    }
  })

  it('forms the failure from the exit code when the collected stderr is absent', async () => {
    const controller = await bootFixed({
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: reader('') },
      done: Promise.resolve({ exitCode: 9, signal: null }),
      terminate: () => {},
      waitForExit: () => Promise.resolve(true),
    })
    await expect(controller.show('abc')).rejects.toThrow(/git exited with code 9/)
  })

  it('parses a commit row with missing NUL fields defensively', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'log') return { stdout: 'abc\n' }
      return { stdout: '/repo\n' }
    })
    const value = await controller.log()
    expect(value.commits[0]).toEqual({
      hash: 'abc', parents: [], authorName: '', authorEmail: '',
      authorDate: '', commitDate: '', subject: '', refs: [],
    })
  })

  it('show tolerates an empty message head and a nameless status row', async () => {
    const { controller } = await boot((args) => {
      if (args[1] === '-s') return { stdout: '\x00' }
      return { stdout: 'M\n' }
    })
    const value = await controller.show('abc')
    expect(value).toEqual({
      hash: '', subject: '', body: '', files: [{ status: 'M', path: '' }],
    })
  })

  it('refs tolerates a nameless decoration row', async () => {
    const { controller } = await boot((args) => {
      if (args[0] === 'symbolic-ref') return { stdout: 'main\n' }
      return { stdout: '\x00tag\n' }
    })
    await expect(controller.refs()).resolves.toEqual({ head: 'main', branches: [], tags: [''] })
  })

  it('wraps a non-Error spawn failure into the method RemoteError', async () => {
    const ctx = new Context()
    ctx.provide('subprocess', { spawn: () => { throw 'boom' } } as never)
    await ctx.plugin(GitController, '/repo')
    await expect(ctx.gitController.refs()).rejects.toMatchObject({ code: 'git/refs-failed' })
    await expect(ctx.gitController.refs()).rejects.toThrow(/git refs failed: boom/)
  })
})
