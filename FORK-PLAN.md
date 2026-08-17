# 私有插件开发与 Fork 同步方案（落盘）

> 落盘日期：本次会话。本文是「以源库为基础开发私有插件、并通过自己的 fork 同步备份」的唯一权威方案。
> 它取代 `FORK-MAINTENANCE.md` 中「未来目标 / Backlog / 同步 Runbook」三节的旧规划（该文件「本次会话结果」保留为历史记录）。
> 前置约束见仓库根 `AGENTS.md`（插件化架构、非平凡改动带 Agent Note 等）与 `FORK-MAINTENANCE.md` 的既有结论。

---

## 1. 需求澄清

1. **以源库为基础开发私有插件**：源库是 `deepseek-ai/deepseek-harness`，我只是下游开发者，在其之上增补自己的插件（当前已有一个「Git 历史查看器」插件）。
2. **插件深度集成，必须走 fork**：该插件不是纯外部包——它改动 host 端 `apiproxy`（新增只读 `git` API 域）、新增 client 包 `ui-git-history`、并注册进 web bundle 的三登记面。因此无法脱离 fork 独立成外部 npm 包，只能在一个 fork 上维护。
3. **私有改动不回源库**：不向 `deepseek-ai/deepseek-harness` 推送、不开 PR 回上游；源库只读。
4. **远端 fork 是唯一真相（单一事实源）**：所有私有改动都推送到自己的 fork `lbowlsh/deepseek-harness`；本地只是工作副本，丢了本地机器也不丢任何代码。
5. **master 不被污染**：本地 `master` 与 fork 的 `master` 永远只是上游的纯镜像，只做 `--ff-only` 快进，绝不直接提交私有改动。

---

## 2. 推荐方案（为什么这样做）

### 2.1 remote 命名 —— 采用 GitHub 标准惯例

| remote | 指向 | 角色 |
|---|---|---|
| `upstream` | `deepseek-ai/deepseek-harness` | 只读源库 |
| `origin` | `lbowlsh/deepseek-harness` | 自己的 fork = 唯一真相 |

原命名与习惯相反（`origin` 指源库、`fork` 指自己），极易推错。改为标准命名后，`git push` / `git push origin <branch>` 默认只会落到自己的 fork，从命名层面杜绝误推源库。

### 2.2 分支模型 —— 「镜像 master + 单一集成分支 lbowl」

| 分支 | 作用 | 规则 |
|---|---|---|
| `master` | 上游纯镜像 | 只 `--ff-only` 快进到 `upstream/master`，绝不直接提交；同步后推到 `origin/master` |
| `lbowl` | 私有集成分支 | **所有私有插件的唯一真相**；`rebase master` 跟进上游；`--force-with-lease` 强推到 `origin/lbowl` |
| `feat/*` | 短生命周期特性分支（可选） | 从 `lbowl` 切出，做完合回 `lbowl` 后删除 |

当前唯一的 `feat/git-history-viewer` 已就地改名为 `lbowl`，作为集成分支起点；后续每个新插件都在 `lbowl` 上继续叠，或切 `feat/*` 再合回 `lbowl`。

### 2.3 为什么选「单一集成分支」而不是其它方案

- **单一集成分支（采纳）**：每次跟进上游只 `rebase` 一次，所有插件在同一处共存、一起 `build:lib` 自检，备份只需一个分支。冲突面最小。
- **每插件一条长活分支（否决）**：N 条分支各自 rebase + 交叉合并，冲突面 ×N，且无法一次构建验证整体。
- **独立私有仓库 / submodule / 纯外部 npm 包（暂不可行）**：插件改了 host `apiproxy` + bundle 注册，属于「改源库内高频文件」的深度集成，无法纯外部化。唯一能缩小这种改动的长期手段是 Backlog #5（把 `git` 域迁成独立 `@deepseek-ai/dsh-host-git-log` Typert Remote 包，只挂载一行），这是「降低冲突面」的演进方向，不是当前替代方案。
- **rebase 而非 merge**：让私有补丁始终是「上游之上的线性栈」，diff 干净、冲突只解一次、跟进历史清晰；配合 `rerere.enabled=true` 记住已解决的冲突。

---

## 3. 本次会话已执行的环境修复

| # | 操作 | 命令 | 结果 |
|---|---|---|---|
| 1 | remote 重命名 | `git remote rename origin upstream` | 源库改名为 `upstream` |
| 2 | remote 重命名 | `git remote rename fork origin` | 自己的 fork 改名为 `origin` |
| 3 | 分支更名 | `git branch -m feat/git-history-viewer lbowl` | 私有分支改名为 `lbowl` |
| 4 | 冲突记忆 | `git config rerere.enabled true` | 已启用 |
| 5 | 封装同步脚本 | 新增 `scripts/sync-upstream.sh`（已 `chmod +x`、`bash -n` 通过） | 见第 4 节 |

修复后现状（本地）：

```text
origin    git@github.com:lbowlsh/deepseek-harness.git        # 自己的 fork
upstream  https://github.com/deepseek-ai/deepseek-harness.git # 只读源库

* lbowl   f7a458245c (本地) = origin/lbowl（fork 上的私有集成主分支）
  master  47f943859b = upstream/master = origin/master（镜像一致）
```

---

## 4. 同步 Runbook

### 4.1 一次性收尾（本会话已完成）

```bash
git push -u origin lbowl                              # ① 首次把 lbowl 推到 fork
git push origin --delete feat/git-history-viewer      # ② 删除 fork 旧分支名，避免「两个真相」
git ls-remote --heads origin                          # ③ 确认远端只剩 master + lbowl
```

结果：fork 现仅有两个分支——`master`（上游镜像，`47f943859b`）与 `lbowl`（私有集成分支，`f7a458245c`）；`feat/git-history-viewer` 已从 fork 删除。

### 4.2 每次跟进源库（一条命令）

```bash
bash scripts/sync-upstream.sh
```

脚本等价步骤（含 6 步，详见脚本头注释）：

1. `git fetch upstream --prune`
2. `git checkout master && git merge --ff-only upstream/master`
3. `git push origin master`（同步 fork 的 master 镜像）
4. `git checkout lbowl && git rebase master`（冲突在此解决）
5. `pnpm install --prefer-offline && pnpm run build:lib`（上游可能改契约，必须重建自检）
6. `git push --force-with-lease origin lbowl`（仅自己用，安全；首次无 `origin/lbowl` 时自动降级为 `-u`）

---

## 5. 任务边界（红线）

1. **源库只读**：不推 `upstream`，不开 PR 回上游（除非明确要求）。
2. **插件不进源库**：所有私有改动只在 `origin`（自己的 fork）的分支上。
3. **`master` 只做镜像**：永不在 `master` 直接提交，只 `--ff-only` 快进。
4. **跟进用 rebase，不用 merge**；强推只用 `--force-with-lease`，不用裸 `--force`。
5. **开发前先同步**：新一轮开发开始前先 `bash scripts/sync-upstream.sh`，不要攒很久再合并。
6. **同步后必须重建自检**：`pnpm install && pnpm run build:lib`（上游可能改 schema / slot / apiproxy 形状）。
7. **盯紧高频冲突面**：`packages/host/apiproxy/src/api-proxy.ts`（+137 行）是上游高频文件、最大冲突源；长期紧跟上游则尽早执行 Backlog #5。

---

## 6. Backlog（更新后）

| # | 事项 | 优先级 | 状态 |
|---|---|---|---|
| 1 | remote 重命名 `origin`↔`upstream` / `fork`→`origin` | 高 | ✅ 已完成（本会话） |
| 2 | 插件分支更名 → `lbowl`（私有集成分支） | 中 | ✅ 已完成（本会话） |
| 3 | 封装 `scripts/sync-upstream.sh` | 高 | ✅ 已完成（本会话） |
| — | 收尾远端：push `origin/lbowl` + 删除 `origin/feat/git-history-viewer` | 高 | ✅ 已完成（本会话） |
| 4 | 加固：`api-proxy.ts` 的 `execFile` → `ctx.subprocess` | 中 | ✅ 已完成（本会话，带 note + 测试） |
| 5 | 重构：git 域迁独立 `@deepseek-ai/dsh-host-git-log` Typert Remote 包 | 低（按跟进频率） | 待办 |
| 6 | 补 Agent Note（DSH 仓库规矩） | 中 | ✅ 已完成（本会话，feature + 加固两条 note，互相 cross-link） |
| 7 | 样式修正：`.panel` 字面色 → `--dsw-*` | 低 | 待办 |
| 8 | i18n：硬编码中文文案 → `locales.ts`（zh/en） | 低 | 待办 |
| — | i18n：`ui-git-history/README.md` 补 `.zh.md` 双语配对（`verify-translation-pairing` 当前唯一红灯） | 中 | 待办 |

---

## 7. 一次典型「新插件」开发循环

1. `bash scripts/sync-upstream.sh`（先同步，减少冲突面）
2. 在 `lbowl` 上开发（或切 `feat/<name>` 从 `lbowl` 起）
3. `pnpm run build:lib`（至少 typecheck + bundle）+ 相关测试
4. 提交（按仓库规矩带 Agent Note）
5. `git push origin lbowl`（或 `--force-with-lease` 若已 rebase）→ fork 即唯一真相
