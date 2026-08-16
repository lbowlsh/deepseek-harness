/**
 * Git-history plugin, browser half: a sidebar footer action that opens a
 * frame-wide `shell.overlay` panel, plus the overlay itself. One shared store
 * handle drives the open/close and commit-selection axes across both entries.
 * Data comes from the host's `git` API domain over the shared connection.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { createGitHistoryStore } from './store.ts'
import { GitHistoryOverlay, type GitHistoryOverlayInjected } from './GitHistoryOverlay.tsx'
import { GitHistoryToggle } from './GitHistoryToggle.tsx'

/** Required services: the slot registry and the shared API connection. */
export const inject = ['slots', 'connection']

/**
 * Client plugin body: register the toggle and the overlay panel into their
 * declaring packages' slots once those declarations exist.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  const store = createGitHistoryStore()

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'git-history',
    store,
    inject: (): GitHistoryOverlayInjected => ({ git: api.git }),
  }, GitHistoryOverlay))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'git-history',
    store,
    inject: () => ({}),
  }, GitHistoryToggle))
}
