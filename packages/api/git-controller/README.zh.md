---
description: "面向部署工作区仓库的只读 Git 历史 Remote，供选择、挂载或排查 git 命名空间的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-git-controller

[English](README.md) | 中文

## 概述

本包向浏览器提供只读的 Git 历史：宿主在部署工作区根目录运行 `git`，并通过生成的 `ctx.remote.git` 命名空间返回类型化提交数据。四个一元调用覆盖查看器的全部需要——提交 DAG、单个提交的消息与变更文件列表、单个文件的统一补丁、以及分支/标签/HEAD 装饰集合。每次 `git` 进程都走受管子进程 seam，它会从子进程环境剔除 credential 形态的环境变量名，并在服务销毁时终止并收尾仍在运行的进程树。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

当客户端需要仓库历史时，在 Host 上挂载本插件。`dsh` web-app 组合已启用它；浏览器半边 `@deepseek-ai/dsh-client-ui-git-history` 消费它注册的命名空间。

### 调用命名空间

客户端通过装配的 `ctx.remote.git` 调用四个方法：

```ts
await ctx.remote.git.log(200)        // commit DAG, newest first
await ctx.remote.git.show(hash)      // message and changed-file list
await ctx.remote.git.fileDiff(hash, path) // unified patch of one file
await ctx.remote.git.refs()          // branches, tags, and HEAD
```

每次调用返回 `RemoteResult`；失败携带 `git/*` 错误码，消息中包含底层 `git` stderr 文本。

### 何时选择

当客户端界面需要展示仓库结构——提交图、文件历史、引用列表——且针对部署工作区时，选择它。当目录不在构造时固定时避免使用：本服务只应答一个根目录，控制器创建时即固定（默认是部署进程 cwd）。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本节解释控制器如何运行 `git` 并解析输出；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

控制器建立在四项承诺之上：

- **构造上只读。** 每次调用硬编码它运行的精确 `git` 子命令，因此任何客户端输入都无法触达写命令。客户端唯一提供的值是数量上限、提交哈希与仓库相对路径——全部作为固定动词之后的 `git` 参数传入。
- **只用受管子进程。** `git` 通过 `ctx.subprocess`（组合应用中的 `@deepseek-ai/dsh-subprocess-local`）拉起，绝不使用 `node:child_process`：子进程的 credential 形态环境变量名会被剔除，仍在运行的进程树会在服务销毁时终止并收尾。
- **完整输出收集。** 64 MiB stdout 尾部窗口加 spill 文件恢复返回完整 `log` 输出；1 MiB stderr 尾部足以构成失败消息。spawn、退出与解析失败都以类型化 `RemoteError` 呈现，绝不裸抛。
- **非仓库是数据，不是失败。** 不在工作树内的工作区应答 `repo: false`；HEAD 未诞生的仓库应答空提交列表——客户端渲染空状态而非传输失败。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 控制器：含四个 `@Remote` 方法的 `TypertRemoteService` 子类 |
| [`src/types.ts`](src/types.ts) | 线上词汇：提交/show/文件 diff/引用值及 `git/*` 失败码 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [api 组映射](../README.zh.md)——与它并列的 controller 包及其构成的 Remote 层。
- [remote-method-calls Agent Note](../../../.agents/notes/implemented/architecture/2026-08-02-typert-remote-method-calls.zh.md)——`@Remote` 方法如何变成类型化客户端调用。
- [git-controller 迁移 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-09-git-history-controller-migration.zh.md)——git 域从旧 host apiproxy 迁入本包的记录。

-----

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

这些限制说明本控制器何时不合适。它们是当前包约束，不是任务积压。

- **单一固定根**——控制器只应答构造时固定的目录；不支持按 session 或按 workspace 的根。
- **历史仅按数量截断**——`log` 在数量上限处截断并报告 `truncated`；分页、路径过滤与作者过滤未实现。
- **仅补丁文本**——`fileDiff` 返回统一补丁文本；二进制文件返回空补丁且无提示。
- **无引用变更**——命名空间严格只读；checkout、分支操作与 fetch 永不出现于此。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码和相关 Agent Note 为准。

[git-history feature Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-web-git-history-viewer.zh.md) 记录了旧 `apiproxy` 包下的两半式原始设计；[迁移 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-09-git-history-controller-migration.zh.md) 记录上游删除 apiproxy 后迁移到 Typert Remote 的过程。

</details>
