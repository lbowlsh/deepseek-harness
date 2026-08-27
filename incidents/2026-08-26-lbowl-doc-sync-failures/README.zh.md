# 故障处理目录：2026-08-26 lbowl 既有 doc-sync 门禁失败

[English](README.md) | 中文

本目录记录一项独立故障：`lbowl` 分支上既有的 `pnpm run doc-sync` 门禁失败，采集于 INC-2026-08-26-01 记录落地后的提交 `0ad9f0edbb`。本故障仅落盘登记，修复待办。

| 项 | 内容 |
|---|---|
| 故障编号 | INC-2026-08-26-02 |
| 登记日期 | 2026-08-26 |
| 位置 | deepseek-harness 的 `lbowl` 分支（全部失败在 `master` 上不存在） |
| 范围 | 7 个 doc-sync 门禁：markdown wrap、翻译配对、包 README 模型体验、包 README 已知限制、cordis 目录、client 目录、config 目录 |
| 状态 | 🟡 OPEN——已落盘登记，修复待办 |
| 关联 | 与 INC-2026-08-26-01（工具发射劫持）无关；`incidents/` 目录自身通过全部适用门禁 |

## 目录文件

- [report-2026-08-26.md](report-2026-08-26.md) — 完整故障报告：逐门禁违例、证据、归因、逐项修复建议

## 结论速览

1. **4 项失败源自同一个在制功能**：`packages/client/ui-git-history`（lbowl 本地提交 2fbd4a0eff）的 README 同时违反 markdown wrap、双语配对、模型体验、已知限制四项要求。
2. **3 项失败是过期生成目录**：`docs/subsystems/typert.md(.zh.md)`、`docs/config-catalog.md`、`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` 在 lbowl 本地重构（Agent Teams 改名）与上游合并后未重新生成；各自跑对应的 `gen-*` 命令重新生成即可修复。
3. **7 项全部为 lbowl 本地问题**：`origin/master`（47f943859b）上均不存在；引入提交 2fbd4a0eff、70a3bf4554、50a953fef3 均为 lbowl 本地提交，typert 目录过期亦源于 lbowl 源码漂移而非 master。
4. **修复均为逐项机械操作**（报告 §4）；无一项由 `incidents/` 目录引起——该目录已通过配对、markdown wrap 与文档预算门禁。
