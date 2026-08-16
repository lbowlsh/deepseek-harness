/**
 * Sidebar footer action that opens the git-history overlay. It renders a
 * branch glyph always, plus a text label when the sidebar is wide.
 */
// Type-only: pulls the sidebar shell's SlotMap merge (sidebar.footer.action).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import clsx from 'clsx'
import type { createGitHistoryStore } from './store.ts'
import css from './GitHistoryOverlay.module.css'

type Store = ReturnType<typeof createGitHistoryStore>

/** Full props: the store share plus the sidebar footer action owner share. */
export type GitHistoryToggleProps = PropsStore<Store> & PropsRuntime<'sidebar.footer.action'>

/**
 * Render the sidebar footer action.
 * @param props - store share (useStore/actions) and owner share (wide).
 */
export function GitHistoryToggle({ useStore, actions, wide }: GitHistoryToggleProps) {
  const open = useStore(s => s.open)
  return (
    <button
      type="button"
      className={clsx(css.toggle, open && css.toggleActive)}
      onClick={() => actions.open()}
      title="Git 历史"
      aria-label="Git 历史"
    >
      <span className={css.toggleGlyph} aria-hidden>⑂</span>
      {wide && <span className={css.toggleLabel}>Git 历史</span>}
    </button>
  )
}
