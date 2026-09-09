/**
 * Sidebar footer action that opens the git-history overlay. It renders a
 * branch glyph always, plus a text label when the sidebar is wide.
 */
// Type-only: pulls the sidebar shell's SlotMap merge (sidebar.footer.action).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import clsx from 'clsx'
import type { createGitHistoryStore } from './store.ts'
import { NS } from './locales.ts'
import css from './GitHistoryOverlay.module.css'

type Store = ReturnType<typeof createGitHistoryStore>

/** Full props: the store share, the locale seat, and the sidebar footer action owner share. */
export type GitHistoryToggleProps = PropsStore<Store> & PropsLocale<typeof NS> & PropsRuntime<'sidebar.footer.action'>

/**
 * Render the sidebar footer action.
 * @param props - store share (useStore/actions), locale seat (t), and owner share (wide).
 */
export function GitHistoryToggle({ useStore, actions, t, wide }: GitHistoryToggleProps) {
  const open = useStore(s => s.open)
  return (
    <button
      type="button"
      className={clsx(css.toggle, open && css.toggleActive)}
      onClick={() => actions.open()}
      title={t('toggle.title')}
      aria-label={t('toggle.aria')}
    >
      <span className={css.toggleGlyph} aria-hidden>⑂</span>
      {wide && <span className={css.toggleLabel}>{t('toggle.title')}</span>}
    </button>
  )
}
