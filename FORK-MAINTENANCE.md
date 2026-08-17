# DSH Fork 维护与私有插件 — 会话总结与后续规划

> ⚠️ 本文为历史会话记录。**后续的「未来目标 / Backlog / 同步 Runbook」以 `FORK-PLAN.md` 为准**（本文件第 1 节「本次会话结果」保留为历史事实）。

> 落盘日期：本次会话结束。本文记录「Git 历史查看插件」开发的会话结果、后续目标与任务边界，作为后续跟进源库、维护私有插件时的唯一事实参考。

---

## 1. 本次会话主要结果

### 1.1 交付物：DSH Web UI 的「Git 历史」插件（只读可视化）

**Host 端** — `@deepseek-ai/dsh-host-apiproxy` 新增只读 `git` API 域：

- 新增 `packages/host/apiproxy/src/api/git.ts`（契约：`log` / `show` / `fileDiff` / `refs`）
- 新增 `packages/host/apiproxy/src/api/git.schema.ts`（request + value 双表 Zod 校验）
- 修改 `api/index.ts`、`api/rpc-map.ts`、`fetch/client.ts`、`fetch/handler.ts`、`index.ts`
- 修改 `api-proxy.ts`（用 `child_process.execFile` 在工作区根目录跑 `git`，`maxBuffer: 64MB`）
- 修改 `connection/src/client/fixture.ts` 与 4 个测试 fake，保证 typecheck 全绿

**客户端** — 新插件包 `packages/client/ui-git-history`：

- `GitHistoryOverlay.tsx`：SVG 泳道提交图 + 提交列表 + 详情/文件 diff
- `GitHistoryToggle.tsx`：侧边栏 footer 入口（`shell.overlay` + `sidebar.footer.action`，共享一个 store）
- 完整骨架：`package.json`（含 `dsh.client`）、`tsconfig.json`、`tsdown.config.ts`、`index.ts`、`invariant.ts`、`css-modules.d.ts`、`README.md`、`store.ts`

**三登记面**：`tsconfig.client.json`、`packages/bundle/web-app/cordis.patch.yml`、`web-app/package.json`

### 1.2 构建与提交

- `pnpm install --prefer-offline` 成功（新增包的依赖已链接）
- `pnpm run build:lib` 全绿（host + client tsc + tsdown bundle 均通过）
- 提交：`2fbd4a0eff` — `feat(web): add git-history viewer plugin and host git api domain`
- 分支：`feat/git-history-viewer`，**已推送到 fork** `git@github.com:lbowlsh/deepseek-harness.git`
- 推送时 pre-push `typecheck`（`tsc -b tsconfig.client.json`）通过
- 29 个文件，+1184 行

### 1.3 当前 git 状态（需注意）

| remote | 指向 | 状态 |
|---|---|---|
| `origin` | `deepseek-ai/deepseek-harness`（**源库**） | 命名与习惯相反，待改名 |
| `fork` | `lbowlsh/deepseek-harness`（**自己的 fork**） | 已推送插件分支 |

- 本地 `master` 仍与源库一致（未污染），fork 的 `master` 也仍是上游原样。
- 插件只存在于 `feat/git-history-viewer` 分支，**未**推送到 `master`。

### 1.4 本地激活方式（未自动化）

新增插件包 + host 端改动需要重启 `dsh web` 才生效：

```bash
pnpm dsh web          # 终端 A：重启 host
pnpm run dev:web      # 终端 B：客户端 HMR watcher
# 刷新 http://127.0.0.1:3080
```

---

## 2. 未来目标

### 2.1 核心目标

1. **保持 fork 跟进源库更新**：`master` 永远只是上游纯镜像，插件永远在独立分支。
2. **私有插件长期维护，不回流源库**：源库不是我负责，改动只在 fork 分支上。
3. **降低跟进成本**：用 rebase 而非 merge；尽量减小对上游高频文件的改动面。

### 2.2 待办清单（Backlog）

| # | 事项 | 优先级 | 说明 |
|---|---|---|---|
| 1 | remote 重命名 `origin`↔`upstream` / `fork`→`origin` | 高 | 与 GitHub 工具/文档习惯一致，避免推错 |
| 2 | 插件分支更名 `feat/git-history-viewer` → `lbowl`（或 `main-lbowl`） | 中 | `feat/` 暗示要开 PR 回上游，命名应体现「私有维护」 |
| 3 | 封装 `scripts/sync-upstream.sh` | 高 | 把第 3 节同步循环固化成一条命令 |
| 4 | 加固：`api-proxy.ts` 的 `execFile` → `ctx.subprocess` | 中 | 补 secret 清洗 + teardown（当前只读场景无硬伤） |
| 5 | 重构：git 域迁独立 `@deepseek-ai/dsh-host-git-log` Typert Remote 包 | 低（按跟进频率） | 不再改 `api-proxy.ts`（+137 行的最大冲突面），只新增包 + api-remotes 挂载一行 |
| 6 | 补 Agent Note（DSH 仓库规矩） | 中 | `.agents/notes/implemented/` 下，非平凡改动需带 |
| 7 | 样式修正：`.panel` 的 `box-shadow: rgb(0 0 0 / 30%)` 字面色 → `--dsw-*` | 低 | 违反「feature CSS 不写字面色」 |
| 8 | i18n：硬编码中文文案 → `locales.ts`（zh/en 字典） | 低 | 当前满足中文文案，但不参与 i18n |

---

## 3. 任务边界（红线）

1. **源库只读**：不直接向 `deepseek-ai/deepseek-harness` 推送；除非明确要求，不开 PR 回上游。
2. **插件不进源库**：所有私有改动只在 fork 的独立分支上。
3. **`master` 只做镜像**：永不在 `master` 上直接提交；只 `--ff-only` 快进。
4. **跟进用 rebase，不用 merge**：插件分支 `git rebase master` + `git push --force-with-lease`（不用裸 `--force`）。
5. **开发前先同步**：新一轮开发开始前先 sync，而不是攒很久再合并。
6. **sync 后必须重建自检**：`pnpm install && pnpm run build:lib`（至少 typecheck + bundle），因为上游可能改契约（schema / slot / apiproxy 形状）。
7. **高频冲突面要盯紧**：`packages/host/apiproxy/src/api-proxy.ts`（+137 行）是上游改动最频繁的文件之一，是最主要冲突源；若长期紧跟上游小版本，建议尽早执行 Backlog #5 重构。

---

## 4. 同步 Runbook（每次跟进源库）

```bash
cd /Users/ericzhang/Projects/deepseek-harness
git fetch upstream

# ① 本地 master 快进到上游
git checkout master
git merge --ff-only upstream/master
git push origin master                         # 同步 fork 的 master

# ② 插件分支 rebase 到新 master（冲突在此解决）
git checkout feat/git-history-viewer           # 或更名后的 lbowl
git rebase master

# ③ 重建自检（上游可能改契约）
pnpm install && pnpm run build:lib

# ④ 强推自己的分支（只有自己用，安全）
git push --force-with-lease origin feat/git-history-viewer
```

可选辅助：`git config --global rerere.enabled true` 让 git 记住已解决的冲突。

> 注意：上面的 `upstream` / `origin` 命名以「已完成 Backlog #1 重命名」为前提；未重命名前 `origin` 指源库、`fork` 指自己的仓库。
