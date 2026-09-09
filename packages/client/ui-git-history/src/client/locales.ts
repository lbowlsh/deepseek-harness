/** `gitHistory` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'gitHistory'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'toggle.title': 'Git 历史',
  'toggle.aria': 'Git 历史',
  'overlay.title': 'Git 历史',
  'overlay.close.aria': '关闭',
  'overlay.loading': '加载中…',
  'overlay.notRepo': '当前目录不是 Git 仓库',
  'overlay.noCommits': '暂无提交',
  'overlay.selectHint': '选择一个提交查看详情',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<GitHistoryKey, string> = {
  'toggle.title': 'Git history',
  'toggle.aria': 'Git history',
  'overlay.title': 'Git history',
  'overlay.close.aria': 'Close',
  'overlay.loading': 'Loading…',
  'overlay.notRepo': 'This directory is not a Git repository',
  'overlay.noCommits': 'No commits yet',
  'overlay.selectHint': 'Select a commit to view details',
}

/** Dictionary key union derived from the Chinese source of truth. */
export type GitHistoryKey = keyof typeof zh
