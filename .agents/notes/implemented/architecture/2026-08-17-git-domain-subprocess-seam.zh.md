# Agent Note: Git history API runs git through the subprocess seam

Status: implemented

[English](2026-08-17-git-domain-subprocess-seam.md) | 中文

## Problem

`git.*` host API 域（Web Git 历史查看器的后端）此前通过 `node:child_process` 的 `execFile` 直接拉起 `git`。裸 spawn 绕过了 harness 的 subprocess seam：子进程继承了完整父环境——包括 `DEEPSEEK_API_KEY` 及其他 credential 形态的环境变量名——且仍在运行的 `git` 进程树在服务 teardown 时没有负责终止并收尾（join）的归属者。

## Decision

`git.*` 现在走受管的 subprocess seam。`runGit` 通过 `ctx.get('subprocess')` 读取该服务——这是可选服务读取，因为 apiproxy 并未把 `subprocess` 声明为必需注入——并在未组合任何 provider 时以清晰错误失败。随后以收集模式 spawn `['git', ...args]`（stdout/stderr 均收集，并带 spill 文件）；非零退出码会把 git 的 stderr 尾部作为错误信息抛出，stdout 则从内存尾部完整恢复，或在尾部被截断时从 spill 文件读回。

走 seam 免费换来两项保证：credential 形态的环境变量名会在子进程中被清洗（`SENSITIVE_ENV_PATTERN` 加上全部 `DSH_*`），且仍在运行的进程树会在 subprocess 服务 dispose 时被终止并收尾。apiproxy 现在依赖 `@deepseek-ai/dsh-subprocess` 仅用于类型与 `ctx.subprocess` 的 Context 合并；provider（`dsh-subprocess-local`）已由 base bundle 挂载。

## Alternatives considered

- **保留 `execFile` 并手写清洗/终止**：否决——那等于在 apiproxy 内重复实现 seam 的 `scrubbedParentEnv` 与进程树终止阶梯，而这正是 seam 存在的意义。
- **在 `ApiProxyService` 上把 `subprocess` 声明为必需注入**：否决——部分 host 的网关组合并不带 subprocess provider，且 git 域只是可降级的只读辅助面；可选 `ctx.get` 让网关在其余场景仍可加载。

## Consequences

- `git.*` 子进程不再继承 `DEEPSEEK_API_KEY` 或任何 `DSH_*` 事实，且无法在 subprocess 服务 dispose 之后继续存活。
- 输出有界：stdout 保留 64 MiB 尾部并将完整流 spill 到私有临时文件供解析读回；stderr 保留 1 MiB 尾部用于失败信息。
- 该域依赖 subprocess seam 已被组合。未挂载 provider 的 host 会让 `git.*` 调用失败；`git.log` 的“非仓库”探测会把这个失败吞进空状态，与既有的“git 未安装”行为一致。
