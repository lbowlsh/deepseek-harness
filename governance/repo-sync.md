# 仓库更新纪律（lbowl fork 工作流治理）

> 适用范围：lbowlsh/deepseek-harness fork 及 `lbowl` 工作分支
> 目的：与上游 deepseek-ai/deepseek-harness 保持同步的同时，让本地修复与故障档案长期并存，且永不污染 `master`
> 状态：治理纪律——本文件即权威条款；修订与执行记录同样只落 `lbowl`

## 1. 仓库拓扑

| 引用 | 含义 | 角色 |
|---|---|---|
| `upstream/master` | deepseek-ai/deepseek-harness 官方 master | 唯一事实来源（持续前进） |
| `origin/master` | fork 的 master | 上游纯镜像，仅 fast-forward |
| `lbowl` | 工作分支 | 修复、故障档案、治理文档的唯一落点 |

## 2. 三条纪律

1. **自产内容只落 lbowl**：一切自产内容（修复、故障档案、治理文档）只提交到 `lbowl` 并推送 `origin/lbowl`；禁止向 `master` 提交或推送任何自产内容。
2. **上游同步 merge-forward**：`git fetch upstream` 后在 `lbowl` 上执行 `git merge upstream/master`，冲突在 lbowl 本地解决并验证后推送；对已发布的 `lbowl` 禁止无租赁的 rebase。
3. **fork master 纯镜像**：在 `master` 分支上只执行 `git merge --ff-only upstream/master` 后推送 `origin/master`；`--ff-only` 是防污染的机械护栏——master 一旦出现任何分叉（例如误带 lbowl 内容），该操作立即失败。

## 3. 三条红线

- 不在 `master` 分支上产生任何本地提交。
- 不执行 `git merge lbowl` 或任何把 lbowl 内容带入 master 的操作。
- 只在 `master` 分支上推送 `origin/master`；`lbowl` 只推送 `origin/lbowl`。

## 4. 标准操作序列

同步上游到 lbowl：

```sh
git fetch upstream
git switch lbowl
git merge upstream/master
# 有冲突在 lbowl 本地解决并验证
git push origin lbowl
```

同步 fork master（纯镜像）：

```sh
git switch master
git fetch upstream
git merge --ff-only upstream/master
git push origin master
```

发布修复（日常）：

```sh
git switch lbowl
git add <files> && git commit -m "..."
git push origin lbowl
```

## 5. 冲突与回退

- 修复涉及 `packages/` 时，upstream 合并可能冲突：一律在 lbowl 本地解决，master 不参与。
- 修复提交按主题独立切分（故障档案、治理文档、代码修复分开提交），便于将来提取或放弃。
- 需要改写已发布历史时，先记录远端 OID 并使用 `--force-with-lease`；禁止裸 `--force`。

## 6. 附则

- 本纪律的修订同样只落 `lbowl`，与 master 同步无关。
- 与 `incidents/` 索引联动：某故障修复落地并验证后，在 `incidents/README.md` 中把该行状态改为 ✅ 已确认修复。
