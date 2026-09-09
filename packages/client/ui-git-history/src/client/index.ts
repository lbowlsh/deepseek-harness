/**
 * Git-history plugin, browser half: a sidebar footer action that opens a
 * frame-wide `shell.overlay` panel, plus the overlay itself. One shared store
 * handle drives the open/close and commit-selection axes across both entries.
 * Data comes from the host's `git` Remote namespace over the shared gateway.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the `ctx.remote` merge (git namespace via the assembly),
// the `ctx.slots`/`ctx.locale` service declarations, and the slots SlotMap
// declarations the registers below address.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createGitHistoryStore } from './store.ts'
import { en, NS, zh, type GitHistoryKey } from './locales.ts'
import { GitHistoryOverlay, type GitHistoryOverlayInjected } from './GitHistoryOverlay.tsx'
import { GitHistoryToggle } from './GitHistoryToggle.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git-history panel copy. */
    'gitHistory': GitHistoryKey
  }
}

export type { GitHistoryOverlayInjected, GitHistoryClient } from './GitHistoryOverlay.tsx'
export type { GitHistoryToggleProps } from './GitHistoryToggle.tsx'

/** Required services: the slot registry, the locale seat, and the git Remote namespace. */
export const inject = ['slots', 'locale', 'remote', 'remote.git']

/**
 * Client plugin body: register the dictionaries, the sidebar footer action,
 * and the shell overlay panel.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git-history: dictionaries')
  const store = createGitHistoryStore()
  // Plain async callbacks over the mounted git namespace, so components never
  // see ctx or the Remote service object.
  const git: GitHistoryOverlayInjected['git'] = {
    log: maxCount => ctx.remote.git.log(maxCount),
    show: hash => ctx.remote.git.show(hash),
    fileDiff: (hash, path) => ctx.remote.git.fileDiff(hash, path),
    refs: () => ctx.remote.git.refs(),
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'git-history',
    store,
    locale: NS,
    inject: (): GitHistoryOverlayInjected => ({ git }),
  }, GitHistoryOverlay))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'git-history',
    store,
    locale: NS,
    inject: () => ({}),
  }, GitHistoryToggle))
}
