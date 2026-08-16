/**
 * The git-history overlay's viewing store: whether the panel is open and
 * which commit is selected. Shared by the sidebar toggle and the overlay
 * panel so one handle owns the open/close and selection axes.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Viewing state: open flag plus the currently selected commit hash. */
type GitHistoryState = {
  open: boolean
  selectedHash: string | null
}

/** Annotation twin of the actions literal below. */
type GitHistoryActions = {
  open: (draft: GitHistoryState) => void
  close: (draft: GitHistoryState) => void
  select: (draft: GitHistoryState, hash: string | null) => void
}

/**
 * Create the git-history viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createGitHistoryStore(): EngineStoreHandle<GitHistoryState, GitHistoryActions> {
  return defineStore({
    init: (): GitHistoryState => ({ open: false, selectedHash: null }),
    actions: {
      open: (d) => { d.open = true },
      close: (d) => { d.open = false },
      select: (d, hash) => { d.selectedHash = hash },
    },
  })
}
