/** git domain: routing through the managed subprocess seam and output parsing. */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentHandle, CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import type { SubprocessHandle, SubprocessOutputReader, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`git-${String(nextRpc++)}`), payload }
}

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
    pid: 4242,
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

/** Mount the minimal host spine `createApiProxy` needs, plus a scripted subprocess service. */
async function composed(script: (args: string[]) => ScriptedRun): Promise<{
  ctx: Context
  spawn: ReturnType<typeof scriptedSubprocess>['spawn']
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  ctx.provide('workspaceRegistry', { list: () => [] } as never)
  ctx.agents.setFactory({
    createAgent: async (ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle> => {
      const session = ctx.sessions.create(options.sessionId, {})
      const agent = {} as Agent
      const agentCtx = ownerCtx.extend({ agent })
      Object.assign(agent, { id: session.id, session, status: 'idle', ctx: agentCtx })
      await options.setup?.(agentCtx)
      ctx.agents.register(agent)
      return { agent, dispose: () => Promise.resolve() }
    },
    resume: () => Promise.reject(new Error('git test sources are live')),
  })
  const { spawn } = scriptedSubprocess(script)
  ctx.provide('subprocess', { spawn } as never)
  return { ctx, spawn }
}

const api = (ctx: Context) => createApiProxy(ctx, {
  defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
  cwd: '/repo',
})

describe('git domain', () => {
  it('log routes git through the subprocess seam and parses commit rows', async () => {
    const { ctx, spawn } = await composed((args) => {
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

    const response = await api(ctx).git.log(request({ maxCount: 300 }))

    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value).toMatchObject({
      repoRoot: '/repo',
      repo: true,
      truncated: false,
    })
    expect(response.result.value.commits).toEqual([
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
    await ctx.fiber.dispose()
  })

  it('log reports not-a-repo when the toplevel probe fails', async () => {
    const { ctx } = await composed(() => ({ stdout: '', stderr: 'fatal: not a git repository', exitCode: 128 }))

    const response = await api(ctx).git.log(request({}))

    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value).toEqual({ repoRoot: '/repo', repo: false, commits: [], truncated: false })
    await ctx.fiber.dispose()
  })

  it('log reports an empty repo when HEAD is unborn', async () => {
    const { ctx } = await composed((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return { stdout: '/repo\n' }
      return { stdout: '', stderr: 'fatal: bad revision', exitCode: 128 }
    })

    const response = await api(ctx).git.log(request({}))

    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value).toEqual({ repoRoot: '/repo', repo: true, commits: [], truncated: false })
    await ctx.fiber.dispose()
  })

  it('log maps a failing log invocation onto an internal error', async () => {
    const { ctx } = await composed((args) => {
      if (args[0] === 'log') return { stdout: '', stderr: 'fatal: bad object', exitCode: 128 }
      return { stdout: 'ok\n' }
    })

    const response = await api(ctx).git.log(request({}))

    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error).toMatchObject({ code: 'internal' })
    expect(response.result.error.message).toContain('git log failed')
    await ctx.fiber.dispose()
  })

  it('show parses the message and name-status files', async () => {
    const { ctx } = await composed((args) => {
      if (args[1] === '-s') return { stdout: ['abc', 'Subject line', 'Body text'].join('\x00') }
      return { stdout: ['M\tfile.ts', 'A\tnew.ts'].join('\n') }
    })

    const response = await api(ctx).git.show(request({ hash: 'abc' }))

    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value).toEqual({
      hash: 'abc', subject: 'Subject line', body: 'Body text',
      files: [{ status: 'M', path: 'file.ts' }, { status: 'A', path: 'new.ts' }],
    })
    await ctx.fiber.dispose()
  })

  it('fileDiff returns the patch and refs parse branches, tags, and head', async () => {
    const { ctx } = await composed((args) => {
      if (args[0] === 'show') return { stdout: 'diff --git a/file.ts b/file.ts\n' }
      if (args[0] === 'symbolic-ref') return { stdout: 'main\n' }
      return { stdout: ['main\x00commit', 'feature/x\x00commit', 'v1.0\x00tag'].join('\n') }
    })

    const proxy = api(ctx)
    const diff = await proxy.git.fileDiff(request({ hash: 'abc', path: 'file.ts' }))
    expect(diff.result.ok).toBe(true)
    if (!diff.result.ok) return
    expect(diff.result.value).toEqual({ hash: 'abc', path: 'file.ts', patch: 'diff --git a/file.ts b/file.ts\n' })

    const refs = await proxy.git.refs(request({}))
    expect(refs.result.ok).toBe(true)
    if (!refs.result.ok) return
    expect(refs.result.value).toEqual({ head: 'main', branches: ['main', 'feature/x'], tags: ['v1.0'] })
    await ctx.fiber.dispose()
  })

  it('refs treats a detached HEAD as an empty head', async () => {
    const { ctx } = await composed((args) => {
      if (args[0] === 'symbolic-ref') return { stdout: '', stderr: 'fatal: ref HEAD is not a symbolic ref', exitCode: 1 }
      return { stdout: '' }
    })

    const response = await api(ctx).git.refs(request({}))

    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value).toEqual({ head: '', branches: [], tags: [] })
    await ctx.fiber.dispose()
  })
})
