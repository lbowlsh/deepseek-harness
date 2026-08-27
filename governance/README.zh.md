# 治理目录

[English](README.md) | 中文

本目录存放本仓库 fork 工作流的治理规则：`lbowl` 工作分支、fork 的 `master` 纯镜像与上游三方如何保持同步，同时让本地修复、故障档案与治理文档长期并存且不污染 `master`。

## 目录文件

- [repo-sync.md](repo-sync.md) — 仓库更新纪律（中文）：拓扑、三条纪律、三条红线、标准操作序列、冲突与回退。

## 核心纪律

1. 一切自产内容（修复、故障档案、治理文档）只落 `lbowl` 并推送 `origin/lbowl`；禁止向 `master` 提交任何内容。
2. 上游同步用 merge-forward：把 `upstream/master` 合并进 `lbowl`，本地解决冲突后推送。
3. fork 的 `master` 是纯镜像：只允许 `git merge --ff-only upstream/master`——防污染的机械护栏。
