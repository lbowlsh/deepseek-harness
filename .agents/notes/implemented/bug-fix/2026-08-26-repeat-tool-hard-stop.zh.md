# Agent Note：repeat-tool-reminder 硬熔断（派发前熔断器）

Status: implemented

[English](2026-08-26-repeat-tool-hard-stop.md) | 中文

## Problem

repeat-tool-reminder guard 此前仅提供建议：它在配置的连续重复阈值处注入逐级提醒，但从不打断循环。事故 INC-2026-08-26-01（工具发射劫持）记录了一次 kimi-coding/k3 会话，连续 23 次发射同一个零参数 MCP 工具；三次提醒均已触发，循环却跨回合持续，直到 agent 自行更换通道。使用同样工具面的 deepseek 系会话从未复现该循环，因此缺陷在模型层——harness 无法修复生成过程，但可以打断它所观察到的循环。

## Decision

为 `@deepseek-ai/dsh-repeat-tool-reminder` 增加一个可选的硬熔断器：配置 `hardStop: { enabled, at }`（默认 `false`／`10`；`at` 在加载时校验为大于等于 2 的整数，快速失败）。启用后，guard 自己的 `tools/pre-execute` 监听器会在派发前拒绝——工具主体不会运行——连续相同次数将达到 `at` 的受跟踪调用；之后的相同尝试持续被拒，直到 agent 更换工具或参数。拒绝原因成为该调用的错误结果（`Error: repeat-tool-reminder hard stop: ...`），受既有 `argumentsPreviewChars` 预览上限约束。被拒绝的调用仍会经过 `tools/post-execute`，既有的 `observe` 推进让链继续计数——熔断器无需第二个计数器即可保持，链的推进仍由 post-execute 单点负责（`nextCount` 只读）。

默认行为保持仅建议：随包默认值不变，既有转录或配置的行为均无变化。

## Alternatives considered

- **在高阈值处做 post-execute block**——否决：到 post-execute 时工具主体已经执行，写工具循环（本事故最担心的变体）会继续写入；派发前拒绝才能完全阻止第 N 次执行。
- **独立的新 guard 包**——否决：链、跟踪谓词、规范化和重置语义都已在此包内，新包会重复实现它们。
- **硬熔断默认开启**——否决：改变所有部署的随包行为，并可能拒绝合法的慢速幂等轮询；可选启用既保留建议型默认，也让各部署自行选择取舍。
- **以强硬的上下文重置代替拒绝**——否决：重置或改写上下文是循环级干预，不归此 guard 所有；带独立纠正信号的拒绝才是最小契约。

## Consequences

- 循环成本从无上界收敛为每条链至多 `at` 次相同调用；本事故的 23 次循环会在配置的 `at` 处停止，且不再产生额外执行。
- 启用熔断的部署接受「超过 `at` 的合法幂等轮询会被拒绝」的代价；泄压阀为 `at`／`thresholds`／`exclude`。
- 拒绝文本是新的模型可见输出，由本包真实循环测试覆盖（mock adapter 驱动组装后的 agent loop；断言钉住错误文本，并证明工具主体从未运行）。
- `hardStop` 进入配置目录（随本变更重新生成）与包 README 双语对。

## Related

- [事故 INC-2026-08-26-01 报告](../../../../incidents/2026-08-26-tool-emission-hijack/report-2026-08-26.md)
