/**
 * The git-history overlay panel: a frame-wide modal that renders the
 * workspace repository's commit DAG (SVG lanes) beside a commit list and a
 * commit-detail pane. Closed state renders null; the shell.overlay slot stays
 * mounted and this entry owns pointer events while open.
 */
// Type-only: pulls the layout shell's SlotMap merge (shell.overlay).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  GitCommit, GitFileDiffValue, GitLogValue, GitRefsValue, GitShowValue,
} from '@deepseek-ai/dsh-api-git-controller/types'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { createGitHistoryStore } from './store.ts'
import { NS } from './locales.ts'
import css from './GitHistoryOverlay.module.css'

type Store = ReturnType<typeof createGitHistoryStore>

/** The git domain calls the overlay issues; plain async callbacks over the Remote namespace. */
export interface GitHistoryClient {
  /** List the commit DAG of the workspace repository, newest first. */
  log(maxCount?: number): Promise<RemoteResult<GitLogValue>>
  /** Show one commit's message and changed-file list. */
  show(hash: string): Promise<RemoteResult<GitShowValue>>
  /** Show the unified patch of one file within one commit. */
  fileDiff(hash: string, path: string): Promise<RemoteResult<GitFileDiffValue>>
  /** List branches, tags, and the current HEAD. */
  refs(): Promise<RemoteResult<GitRefsValue>>
}

/** Injected business face: the host git domain over the shared connection. */
export type GitHistoryOverlayInjected = { git: GitHistoryClient }

/** Full props: the store share, the locale seat, and the injected git domain. */
export type GitHistoryOverlayProps = PropsStore<Store> & PropsLocale<typeof NS> & GitHistoryOverlayInjected

/** Row and lane geometry for the SVG graph column. */
const ROW_H = 34
const LANE_W = 16

/** One laid-out commit row. */
interface LaidRow { commit: GitCommit; row: number; lane: number }
/** One graph edge from a child row to a parent row. */
interface LaidEdge { child: number; parent: number; childLane: number; parentLane: number }
/** Whole-graph layout product. */
interface GraphLayout { rows: LaidRow[]; edges: LaidEdge[]; width: number }

/**
 * Assign each commit a horizontal lane (oldest-first greedy packing) and
 * derive the child→parent edges.
 * @param commits - commits newest-first.
 * @returns laid rows, edges, and the lane count.
 */
function layoutGraph(commits: GitCommit[]): GraphLayout {
  const ordered = [...commits].reverse()
  const childCount = new Map<string, number>()
  for (const c of commits) for (const p of c.parents) childCount.set(p, (childCount.get(p) ?? 0) + 1)
  const remaining = new Map(childCount)
  const laneOwner = new Map<number, string>()
  const free: number[] = []
  let laneHigh = 0
  const laneOf = new Map<string, number>()
  for (const c of ordered) {
    for (const [lane, hash] of [...laneOwner.entries()]) {
      if ((remaining.get(hash) ?? 0) === 0) { laneOwner.delete(lane); free.push(lane) }
    }
    free.sort((a, b) => a - b)
    const reused = free.shift()
    const lane = reused !== undefined ? reused : laneHigh++
    laneOf.set(c.hash, lane)
    laneOwner.set(lane, c.hash)
    for (const p of c.parents) remaining.set(p, (remaining.get(p) ?? 0) - 1)
  }
  const rowOf = new Map<string, number>()
  commits.forEach((c, i) => rowOf.set(c.hash, i))
  const rows: LaidRow[] = commits.map((c, i) => ({ commit: c, row: i, lane: laneOf.get(c.hash) ?? 0 }))
  const edges: LaidEdge[] = commits.flatMap((c, i) => c.parents
    .filter(p => rowOf.has(p))
    .map(p => ({ child: i, parent: rowOf.get(p) as number, childLane: laneOf.get(c.hash) ?? 0, parentLane: laneOf.get(p) ?? 0 })))
  return { rows, edges, width: laneHigh }
}

/** Cubic bezier with vertical tangents: the classic git-graph connector. */
function edgePath(e: LaidEdge): string {
  const x1 = e.childLane * LANE_W + LANE_W / 2
  const x2 = e.parentLane * LANE_W + LANE_W / 2
  const y1 = e.child * ROW_H + ROW_H / 2
  const y2 = e.parent * ROW_H + ROW_H / 2
  const mid = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
}

/** Compact local rendering of a commit timestamp in the user's locale. */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Render the git-history overlay.
 * @param props - store share (useStore/actions), locale seat (t), and injected git domain.
 */
export function GitHistoryOverlay({ useStore, actions, t, git }: GitHistoryOverlayProps) {
  const open = useStore(s => s.open)
  const selectedHash = useStore(s => s.selectedHash)

  const [log, setLog] = useState<GitLogValue | null>(null)
  const [refs, setRefs] = useState<GitRefsValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState<GitShowValue | null>(null)
  const [patch, setPatch] = useState<GitFileDiffValue | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const [logRes, refsRes] = await Promise.all([
        git.log(200),
        git.refs(),
      ])
      if (cancelled) return
      setLoading(false)
      if (logRes.ok) setLog(logRes.value)
      else setError(logRes.error.message)
      if (refsRes.ok) setRefs(refsRes.value)
    })()
    return () => { cancelled = true }
  }, [open, git])

  useEffect(() => {
    if (!open || selectedHash === null) { setShow(null); setPatch(null); return }
    let cancelled = false
    void git.show(selectedHash).then((res) => {
      if (cancelled) return
      if (res.ok) setShow(res.value)
    })
    return () => { cancelled = true }
  }, [open, selectedHash, git])

  const graph = useMemo(() => layoutGraph(log?.commits ?? []), [log])

  const loadPatch = (path: string): void => {
    if (selectedHash === null) return
    void git.fileDiff(selectedHash, path).then((res) => {
      if (res.ok) setPatch(res.value)
    })
  }

  if (!open) return null

  return (
    <div className={css.backdrop} onClick={() => actions.close()}>
      <div className={css.panel} onClick={event => event.stopPropagation()}>
        <header className={css.header}>
          <span className={css.title}>{t('overlay.title')}</span>
          {refs !== null && refs.head !== '' && <span className={css.branch}>⑂ {refs.head}</span>}
          {log !== null && <span className={css.repo}>{log.repoRoot}</span>}
          <button type="button" className={css.close} onClick={() => actions.close()} aria-label={t('overlay.close.aria')}>×</button>
        </header>
        <div className={css.body}>
          <div className={css.list}>
            {loading && <div className={css.empty}>{t('overlay.loading')}</div>}
            {!loading && error !== null && <div className={css.empty}>{error}</div>}
            {!loading && error === null && log !== null && !log.repo && <div className={css.empty}>{t('overlay.notRepo')}</div>}
            {!loading && error === null && log !== null && log.repo && log.commits.length === 0 && <div className={css.empty}>{t('overlay.noCommits')}</div>}
            {log !== null && log.repo && log.commits.length > 0 && (
              <div className={css.rows}>
                <svg
                  className={css.graph}
                  width={graph.width * LANE_W + LANE_W}
                  height={log.commits.length * ROW_H}
                  aria-hidden
                >
                  {graph.edges.map((edge, index) => (
                    <path key={index} d={edgePath(edge)} className={css.edge} fill="none" />
                  ))}
                  {graph.rows.map(row => (
                    <circle
                      key={row.commit.hash}
                      cx={row.lane * LANE_W + LANE_W / 2}
                      cy={row.row * ROW_H + ROW_H / 2}
                      r={4}
                      className={css.dot}
                    />
                  ))}
                </svg>
                <ul className={css.commits}>
                  {graph.rows.map(row => (
                    <li
                      key={row.commit.hash}
                      style={{ height: ROW_H }}
                      className={clsx(css.commitRow, selectedHash === row.commit.hash && css.commitSelected)}
                      onClick={() => actions.select(row.commit.hash)}
                    >
                      <div className={css.commitMain}>
                        <span className={css.hash}>{row.commit.hash.slice(0, 7)}</span>
                        <span className={css.subject}>{row.commit.subject}</span>
                        {row.commit.refs.map(ref => <span key={ref} className={css.ref}>{ref}</span>)}
                      </div>
                      <div className={css.meta}>{row.commit.authorName} · {formatDate(row.commit.commitDate)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className={css.detail}>
            {show === null && <div className={css.empty}>{t('overlay.selectHint')}</div>}
            {show !== null && (
              <>
                <div className={css.detailHash}>{show.hash}</div>
                <div className={css.detailSubject}>{show.subject}</div>
                {show.body !== '' && <pre className={css.detailBody}>{show.body}</pre>}
                <ul className={css.files}>
                  {show.files.map(file => (
                    <li key={file.path} className={css.file} onClick={() => loadPatch(file.path)}>
                      <span className={css.fileStatus}>{file.status}</span>
                      <span className={css.filePath}>{file.path}</span>
                    </li>
                  ))}
                </ul>
                {patch !== null && <pre className={css.patch}>{patch.patch}</pre>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
