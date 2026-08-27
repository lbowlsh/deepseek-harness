# Agent 运行健康纪律（写路径探针 + 复发换通道）

> 适用范围：kimi-coding/k3 会话执行写路径任务（参照库/组织/工作流写操作、`debug_sql` confirm=true 直写等）
> 依据：INC-2026-08-26-01（工具发射劫持）根因——kimi-k3 模型级工具生成缺陷，harness 侧只能护栏+规避
> 状态：治理纪律——本文件即权威条款；修订与执行记录同样只落 `lbowl`

## 1. 写前健康探针（强制）

1. 任何写操作序列开始前，先发一个零副作用只读调用（如 `organization_position_options`、`reference_model_list` 或任意轻量 get），确认发射层健康：实际发射的工具名与意图一致、返回有效数据。
2. 连续 **2 次**发射与意图不符（误发其他工具）即熔断：停止写任务，不再尝试任何写调用。
3. 探针未通过，不得进入写序列——不得以「误发目标是只读工具所以无害」为由继续（INC-01 零误写属于运气，不是可依赖的防护）。

## 2. 复发即换通道（强制）

1. 观察到同型零参循环（同一工具、相同参数连续 ≥3 次且任务无推进）或收到 `repeat-tool-reminder hard stop` 拒绝时，立即停止该会话的写任务。
2. 换通道二选一：切换到 deepseek 系模型继续（deepseek 系同上下文零复发，INC-01 §3.3）；或新开会话重做。
3. 先例：2026-08-26 Stage-2 C1 在故障会话延期后，经健康通道于 17:22 CST 落地（`c6d8cdbf` 含 override 守卫+line_amount 派生）。

## 3. 部署护栏（已启用，2026-08-26）

本部署（lbowl checkout 的 `packages/bundle/base/cordis.patch.yml`）已启用：

- `repeat-tool-reminder`：`hardStop: { enabled: true, at: 9 }`——第 9 次相同调用在派发前被拒绝，工具主体不再执行；提醒仍按 `[3, 5, 8]` 逐级注入。
- `spill-policy`：`maxInlineBytes: 16384`（上游默认 50 KiB 的收紧值）——超大工具结果溢出为截断预览，不再无界进入上下文（INC-01 循环每轮约 15K tokens 的重复结果因此被截断）。

## 4. 降级通道纪律（沿用）

熔断后若改用 `debug_sql`（confirm=true）直写，必须按平台格式忠实补录事件审计行（先例：INC-01 Stage-1 的 `entity_model_events` seq 17–20，category/is_breaking/schema_after 与 MCP 工具产物一致）。

## 5. 附则

- 本纪律修订只落 `lbowl`；与上游 master 同步无关（见 [repo-sync.md](repo-sync.md)）。
- 与 `incidents/` 索引联动：护栏或纪律变更在对应故障记录中登记执行证据。
