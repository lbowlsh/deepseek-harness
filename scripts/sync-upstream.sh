#!/usr/bin/env bash
# scripts/sync-upstream.sh — 跟进源库并维护私有插件分支。
#
# 用法：
#   bash scripts/sync-upstream.sh
#
# 约定（见 FORK-PLAN.md）：
#   upstream = deepseek-ai/deepseek-harness（只读源库）
#   origin   = lbowlsh/deepseek-harness（自己的 fork = 唯一真相）
#   master   = 上游纯镜像，只 --ff-only 快进，绝不直接提交
#   lbowl    = 私有集成分支，rebase 跟进 + --force-with-lease 强推
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# 工作区必须干净（tracked 改动会挡 checkout/merge；untracked 文件不受影响）
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "错误：工作区有未提交改动，请先提交或 stash。" >&2
  exit 1
fi

echo "==> [1/6] fetch upstream"
git fetch upstream --prune

echo "==> [2/6] master 快进到 upstream/master"
git checkout master
git merge --ff-only upstream/master

echo "==> [3/6] 同步 fork 的 master 镜像"
git push origin master

echo "==> [4/6] lbowl rebase 到新 master（冲突在此解决）"
git checkout lbowl
git rebase master

echo "==> [5/6] 重建自检（上游可能改契约）"
pnpm install --prefer-offline
pnpm run build:lib

echo "==> [6/6] 强推私有分支（仅自己用，--force-with-lease 安全）"
if git rev-parse --verify "refs/remotes/origin/lbowl" >/dev/null 2>&1; then
  git push --force-with-lease origin lbowl
else
  git push -u origin lbowl
fi

echo "==> 完成：master 与 lbowl 均已同步到 origin（自己的 fork）。"
