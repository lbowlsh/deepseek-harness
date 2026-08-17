# Agent Note: Web git history viewer

Status: implemented

[English](2026-08-16-web-git-history-viewer.md) | 中文

## Problem

DSH 是在用户 Git 工作区内工作的编码 agent，但 Web GUI 此前无法展示该工作区的历史——提交 DAG、分支、标签、逐文件 diff。查看 agent（或协作者）改了什么必须离开 GUI 回到命令行。浏览器无法直接读取工作区文件系统，因此数据必须由 host 提供。

## Decision

交付了一个只读的 Git 历史查看器，分两半：host 上的 `git.*` API 域，以及 `@deepseek-ai/dsh-client-ui-git-history` 客户端插件。

host 域（`git.log` / `git.show` / `git.fileDiff` / `git.refs`）在部署工作区根目录运行 `git` 并返回类型化数据——提交行、name-status 文件列表、统一 diff 补丁、分支/标签引用——从 `git` 的 NUL 分隔输出在 Zod schema 之后解析。它天然只读：该域硬编码了它接受的 `git` 子命令，因此任何客户端输入都无法触达写命令。执行现已走受管子进程 seam（见 [subprocess-seam note](../architecture/2026-08-17-git-domain-subprocess-seam.md)）。

客户端插件贡献一个侧边栏 footer 入口（`sidebar.footer.action`，id `git-history`），打开一个全宽 `shell.overlay`（id `git-history`），以 SVG 泳道渲染提交 DAG、提交列表，以及带逐文件 patch 的提交详情面板。一个共享的 `createGitHistoryStore()` handle 驱动两个入口的开合与提交选择。客户端通过共享连接既有的 RPC 载体读取 host——不新增传输。

接线遵循 client-plugin 清单的三登记面：`tsconfig.client.json` 聚合引用、`web-app` bundle 的 `cordis.patch.yml` `dsh.client` 行、以及 `web-app` 的 `package.json` 依赖。

## Alternatives considered

- **复用 shell/bash 能力**：否决——bash 在 sandbox 内、面向模型的 workspace 视图运行，而非 host 部署根目录，且返回原始文本；查看器需要走既有 RPC 载体的结构化类型数据。
- **通用 host「执行命令」端点**：否决——窄而只读的 `git` 域比任意命令执行攻击面小得多，且给客户端一份类型化契约，而非让浏览器重解析的原始文本。
- **在浏览器里解析 `.git`**：否决——浏览器无法访问工作区文件系统；数据必须在 host 侧读取。

## Consequences

- 查看器是纯展示面：不贡献任何 tool、prompt 段或 session 事件，因此永远不会进入 model 可见面或 session 日志。
- host 域只读且有界：提交列表长度封顶（`maxCount`，默认 300），输出缓冲由 subprocess seam 界定（64 MiB 尾部 + spill——见 subprocess-seam note）。
- 非 Git 仓库、或 HEAD 未出生的工作区会降级为客户端空态而非报错，符合查看器作为可选辅助的定位。
- 该域是共享 `ApiProxy`/`IApiClient` 契约及 client/handler 测试 fake 的一部分，因此复用既有契约与测试面而非另辟通道。`git` 域不携带协议版本，因为 client 与 host 在此 fork 中一同发布。
- 待办：host 域仍位于 `api-proxy.ts` 内；迁到独立 Typert Remote 包可缩小 apiproxy 冲突面，代价是新增一个包外加 remotes 挂载。
