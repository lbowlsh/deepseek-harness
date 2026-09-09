---
description: "Git 历史图叠加面板：部署工作区仓库的只读提交 DAG、引用与文件 diff，供仓库视图的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-history

[English](README.md) | 中文

## 概述

本包在 Web GUI 中渲染部署工作区的仓库历史：侧边栏底部入口（⑂）打开全幅叠加面板，以 SVG 泳道绘制提交 DAG，旁边是提交列表；详情窗格展示单个提交的消息、变更文件与逐文件统一补丁。数据来自宿主的 `git` Remote 命名空间（`@deepseek-ai/dsh-api-git-controller`）；查看器严格只读，绝不写入仓库。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

把本插件与 runtime 和 git controller 一起挂载；侧边栏底部随即出现 ⑂ 入口。点击后打开叠加面板并加载最新的 200 个提交与分支/标签/HEAD 装饰集合。点击提交行会把详情窗格切到该提交；点击其中一个变更文件会在窗格内加载该文件的补丁。面板通过 × 按钮或背景点击关闭；store 在侧边栏折叠期间保持面板开关与选中提交。

### 空状态

不在 Git 工作树内的工作区显示「当前目录不是 Git 仓库」；无提交的工作树显示「暂无提交」。两种状态都是 controller 的数据应答，而非失败。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本包贡献两个条目：`sidebar.footer.action`（`GitHistoryToggle`）与 `shell.overlay`（`GitHistoryOverlay`），两者绑定同一个共享视图 store（`createGitHistoryStore`），因此入口与面板共享开关与选中轴。git 调用通过注册期的 inject 面以四个普通异步回调抵达组件（封装 `ctx.remote.git`）；组件永远看不到 `ctx` 或 Remote 服务对象。图列布局按最旧优先 + 贪婪泳道复用分配车道，并以三次贝塞尔曲线绘制子→父连接线，因此即使父提交比兄弟尖端更旧，合并也能正确呈现分叉/汇合。详情窗格在选择时加载 `show`，并按点击的文件惰性加载 `fileDiff`。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当叠加面板不够用时阅读以下页面。它们从图形转向数据与本包所用的 shell seam。

- [git-controller](../../api/git-controller/README.zh.md)——本叠加面板读取的 Remote 命名空间。
- [Slots 参考](../../../docs/subsystems/slots.zh.md)——本包注册进的 slot 组合（`sidebar.footer.action`、`shell.overlay`）。
- [Web 客户端架构](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.zh.md)——浏览器插件行如何加载并注册 slot。

-----

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

这些限制说明本叠加面板何时不合适。它们是当前包约束，不是任务积压。

- **单一仓库、最新 200 条提交**——图形只显示部署工作区的仓库，且截断到已加载页，无分页控件。
- **设计上只读**——不存在 checkout、分支或写操作；查看器绝不修改仓库。
- **仅补丁预览**——文件 diff 窗格显示统一补丁文本，无语法高亮或并排渲染。
- **CSS 调色板未 token 化**——叠加样式使用字面色值而非 `--dsw-*` 主题 token；主题变更不会重绘叠加面板。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与尚未决定的探索方向。它明确不具权威性——已交付的行为、限制与既定理由以上文、包代码和相关 Agent Note 为准。

[git-history feature Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-web-git-history-viewer.zh.md) 记录了旧 apiproxy 接线下的原始设计；[迁移 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-09-git-history-controller-migration.zh.md) 记录上游删除 apiproxy 后迁到 Typert Remote 装配的过程。

</details>
