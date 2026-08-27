# 护栏验收规程（hardStop 与 spill 生效自检）

> 适用范围：`packages/bundle/base/cordis.patch.yml` 的护栏配置（INC-2026-08-26-01 部署护栏）变更后验收；新会话环境首次启用后的定期抽检
> 前提：`dsh web` 已在护栏配置变更后**重启**，且自检在**重启后新建的会话**中执行（运行中的旧会话不追溯新配置）

## 1. hardStop 熔断自检

步骤：

1. 在新会话中让 agent 以相同参数连续调用同一工具 9 次（例如 `bash` 执行 `echo ping`；该工具在默认 exclude 之外，全程受跟踪）。
2. 观察第 1–8 次：全部正常执行；第 3/5/8 次之后应出现 repeat-tool-reminder 提醒（gentle@3、detailed@5、detailed@8）。
3. 观察第 9 次：工具结果应为错误，文本包含 `Error: repeat-tool-reminder hard stop:` 且注明 `called 9 times`。

判定：

- ✅ 通过：第 9 次被拒绝、前 8 次正常，拒绝文本含 hard stop 与次数。
- ❌ 失败：第 9 次仍然执行——检查会话是否在配置变更后新建、bundle 文件是否被回退。
- 注意：若部署阈值被修改，按当前 `at` 值调整「第 N 次」；提醒次数按当前 `thresholds` 对照。

## 2. spill 截断自检

步骤：

1. 准备一个大于 16KiB 的纯文本文件：`python3 -c "print('x' * 20000)" > /tmp/spill-probe.txt`。
2. 让 agent 用 `bash` 执行 `cat /tmp/spill-probe.txt`（**不要用 `read` 工具**——spill-policy 的模型可见臂有意跳过 `read`，避免 read→spill→再 read 的循环）。
3. 观察工具结果：应为截断预览（head/tail）+ spill 工件定位指引（工件路径/检索提示），而非完整 20KB 文本。

判定：

- ✅ 通过：结果含预览与溢出定位，未见全文。
- ❌ 失败：全文原样进入结果——检查 `maxInlineBytes` 当前值并按新值重测。
- 注意：spill-policy 只对纯文本结果生效；含非文本 block 的结果不受此臂约束。

## 3. 复验与记录

- 每次护栏配置变更后必须重跑第 1、2 节全部自检；
- 结果登记到对应变更提交的说明或故障记录中；两项自检通过后部署状态方可标记 ✅。

## 4. 附则

- 本规程修订只落 `lbowl`；与上游 master 同步无关。
- 关联：[agent-run-health-probe.md](agent-run-health-probe.md) §3（部署护栏清单）、INC-2026-08-26-01 报告 §5。
