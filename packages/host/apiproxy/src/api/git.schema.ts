/**
 * git domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

/** git.log request payload. */
export const gitLogRequestSchema = z.object({
  maxCount: z.number().int().positive().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'git.log'>>>

/** git.log response value. */
export const gitLogValueSchema = z.object({
  repoRoot: z.string(),
  repo: z.boolean(),
  commits: z.array(z.object({
    hash: z.string(),
    parents: z.array(z.string()),
    authorName: z.string(),
    authorEmail: z.string(),
    authorDate: z.string(),
    commitDate: z.string(),
    subject: z.string(),
    refs: z.array(z.string()),
  })),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'git.log'>>>

/** git.show request payload. */
export const gitShowRequestSchema = z.object({
  hash: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'git.show'>>>

/** git.show response value. */
export const gitShowValueSchema = z.object({
  hash: z.string(),
  subject: z.string(),
  body: z.string(),
  files: z.array(z.object({
    status: z.string(),
    path: z.string(),
  })),
}) satisfies z.ZodType<Wire<ResponseValue<'git.show'>>>

/** git.fileDiff request payload. */
export const gitFileDiffRequestSchema = z.object({
  hash: z.string().min(1),
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'git.fileDiff'>>>

/** git.fileDiff response value. */
export const gitFileDiffValueSchema = z.object({
  hash: z.string(),
  path: z.string(),
  patch: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'git.fileDiff'>>>

/** git.refs request payload (empty object literal). */
export const gitRefsRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'git.refs'>>>

/** git.refs response value. */
export const gitRefsValueSchema = z.object({
  head: z.string(),
  branches: z.array(z.string()),
  tags: z.array(z.string()),
}) satisfies z.ZodType<Wire<ResponseValue<'git.refs'>>>
