# 故障处理目录：2026-08-26 工具发射劫持（会话级生成层）

[English](README.md) | 中文

本目录是 `incidents/` 故障处理档案的独立分册：agent 运行侧（DeepSeek Harness + kimi-coding/k3）工具发射故障的完整报告与结论。原始现象固化文档保留在外部项目 Atomos_Workflow_Database（`docs/incident-analysis-tool-emission-hijack-2026-08-26.md`），本目录为对该文档的独立核查结果与修正结论。

| 项 | 内容 |
|---|---|
| 故障编号 | INC-2026-08-26-01 |
| 故障日期 | 2026-08-26（另发现 2026-08-25 同型复发 ×1） |
| 故障会话 | `session-ef1d28fd-2a15-4c1e-9b83-8eaccffcf81b`（S3a 报价明细派生 Stage-1 执行会话，工作目录 Atomos_Workflow_Database） |
| 模型/提供方 | kimi-coding / k3（同型复发的另两个会话亦为该模型） |
| 性质 | 生成层工具选择缺陷（模型级），非 MCP 平台缺陷，非 harness adapter 缺陷 |
| 状态 | ✅ 已确认修复——repeat-tool-reminder 硬熔断（`c993b39509`） |

## 目录文件

- [report-2026-08-26.md](report-2026-08-26.md) — 完整故障报告与核查结论：事实基线、独立取证证据、根因修正、处置状态、治理建议、证据资产清单

## 结论速览

1. **现象属实**：故障会话 23 次把意图工具发射为只读 `mcp__shangJi__entity_field_policy_resource_list`（参数恒为 `{}`，原始文档称「14+」系低估）；harness repeated-call 告警精确触发 3 次（阈值 [3,5,8]）；跨 turn 3→4 未自愈；模型 chunk 流（`tool-call-delta`）自证发射侧为生成层，排除传输层损坏与 adapter 改名。
2. **平台无辜、零误写属实**：故障窗口内平台仅出现该会话有意的 `debug_sql` 写入（C2 规则集停用 + 4 项 schema 变更 + 事件审计行 seq 17–20 忠实补录）。
3. **原始文档两处需修正**：a) 并非「仅单会话发病」——同型循环在 3 个 kimi-k3 会话复现（08-25 讨论会话 25 次、08-26 上午会话 18 次、故障会话 23 次），deepseek 系会话零复现；b) H1「近期合法调用」前提不成立（故障会话中该工具首次出现即循环本身，意图为原则 14 FP 审计读）。主导根因修正为 **kimi-coding/k3 模型级 tool-call 选择缺陷：零必填参数工具塌缩 + 自锁**。
4. **处置现状**：Stage-1（C2/C3a-d）落地核实通过；Stage-2 的 C1（override 守卫 + line_amount 派生）已于当日 17:22 CST 经健康通道落地（`c6d8cdbf` 现含守卫规则）；C4 与探针 V0-V6 仍待健康会话执行。
