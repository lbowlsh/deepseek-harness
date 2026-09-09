# Agent Note: Git history controller migrates to its own Typert Remote package

Status: implemented

[English](2026-09-09-git-history-controller-migration.md) | 中文

## Problem

[Web Git 历史查看器](../feature/2026-08-16-web-git-history-viewer.zh.md)的后端——fork 本地的 `git.*` host 域——此前寄居在 host `apiproxy` 包内，是上游从未合并的表面。上游在 2026-08-27 把 apiproxy 的 RPC 迁上 Typert Remote 并删除该包；fork 在 2026-09-09 的上游同步 merge 中整目录删除了它，git 域连同其 fork 本地的 subprocess-seam 改动一并失去家园。[subprocess seam note](2026-08-17-git-domain-subprocess-seam.zh.md) 记录的路由决策需要一个不是 apiproxy 借尸还魂的新家。

## Decision

git 域以 `@deepseek-ai/dsh-api-git-controller` 交付——`api` 组中与其他持有 Remote 的 controller 并列的包。`GitController` 继承 `TypertRemoteService`，提供四个只读一元 `@Remote` 方法——`log`、`show`、`fileDiff` 与 `refs`；线上词汇定义在包内，generator 生成的 `zod` schema 作为发布后的运行时文件随 `./typert` host contributor 与 `./remote` client entry 一起交付。remotes 网关（`@deepseek-ai/dsh-api-remotes`）挂载该 Remote contribution，使装配暴露 `ctx.remote.git`；web-app bundle 注册插件与消费该命名空间的 `ui-git-history` 客户端叠加层。每次 `git` spawn 仍按 [seam note](2026-08-17-git-domain-subprocess-seam.zh.md) 走 `ctx.subprocess`：清洗 credential 形态的环境变量，服务销毁时终止并收尾进程树。

这执行了 FORK-PLAN Backlog #5——把 git 域迁入以一行注册挂载的独立 Typert Remote 包——并按 `api` 组的 controller 命名惯例定名。

## Alternatives considered

- **把域寄居在 fork 本地克隆的 `apiproxy` 里**：否决——上游是刻意删除该包的，借尸还魂的聚合体会为一个只读域重新引入 fork 最大的冲突面。
- **把 controller 折进 remotes 网关包**：否决——网关是面向客户端的 Remote 装配，而跑子进程的 controller 属于 host；`api` 组把这两面拆在不同包里。
- **等待上游的 git Remote**：否决——查看器是 fork 独占的（见 [feature note](../feature/2026-08-16-web-git-history-viewer.zh.md)），没有可等待的上游迁移目标。

## Consequences

- fork 的冲突面从 apiproxy 内部改动收窄为网关与 web-app bundle 里的依赖行与一行注册。
- 包把 `zod` 声明为运行时依赖：生成的 schema 从发布文件中 import 它，未声明的运行时依赖只会在从零重装后现形。
- seam note 现在以本包为域的归属；它记录的既有路由决策不变。
- 按[定向方法调用 note](2026-08-02-typert-remote-method-calls.zh.md)，每个 `@Remote` 方法仍是没有协议版本的类型化客户端调用，因为客户端与 host 同仓发布。
