# @deepseek-ai/dsh-repeat-tool-reminder

English | [中文](README.zh.md)

An advisory loop-breaker, not a model-facing tool: it never appears in the tool list, and by default it never vetoes or rewrites a call — it adds one behavior. It watches each agent's stream of tool calls, counts runs of consecutive calls to the same tool with identical canonicalized arguments, and at configured run lengths injects an escalating advisory reminder telling the model to stop repeating itself, re-read the last result, and either change approach or conclude. The decision (retry differently, gather more evidence, or finish) stays entirely with the model: a legitimately repeated call is delayed by nothing and blocked by nothing. An opt-in `hardStop` config adds a second behavior — a pre-dispatch circuit breaker that denies the call whose identical run reaches a configured length. Decision record: [the repeat-tool-reminder Agent Note](../../../.agents/notes/archived/feature/2026-07-08-repeat-tool-guard.md); hard-stop record: [the hard-stop Agent Note](../../../.agents/notes/implemented/bug-fix/2026-08-26-repeat-tool-hard-stop.md).

## Config

```yaml
- id: repeat-tool-reminder
  name: '@deepseek-ai/dsh-repeat-tool-reminder'
  config:
    thresholds: [3, 5, 8]        # default; consecutive counts that trigger a reminder
    include: []                  # tool-name patterns to track; empty ⇒ all tools
    exclude: [todo_write]        # tool-name patterns transparent to the chain
    argumentsPreviewChars: 500   # default; cap on arguments quoted in the detailed reminder
    hardStop:                    # default; optional pre-dispatch circuit breaker
      enabled: false             # default; opt in to deny the run-reaching call
      at: 10                     # default; consecutive identical calls that trip the breaker
```

`thresholds` fails loud at plugin load: an empty list, a non-integer, a value below 2, or a duplicate throws, never a silent fall-back to defaults; `argumentsPreviewChars` equally rejects anything but an integer >= 1. The list is normalized to ascending order; the FIRST threshold delivers a short generic nudge, every later threshold delivers the detailed form naming the tool, the run length, and the canonical arguments — head-truncated at `argumentsPreviewChars` with an omitted-count marker, so a looping `write`/`edit` payload cannot ride into the next request unbounded (the chain key always compares the FULL canonical string; the cap bounds the reminder, never the detection).

`hardStop` is disabled by default — the guard stays advisory unless a deployment opts in. When enabled, the tracked call whose consecutive identical run would reach `at` is denied BEFORE dispatch (its tool body never runs), and every further identical attempt stays denied until the agent changes tool or arguments; the denial reason reaches the model as the denied call's error result. `at` fails loud unless it is an integer >= 2. To keep the reminder escalation meaningful, set `at` above the highest `thresholds` entry — otherwise the breaker trips before the later reminders fire.

`include`/`exclude` entries support `*` wildcards and are predicates over whatever tools exist at call time, not references to registry entries — a pattern matching no currently registered tool is NOT an error (`exclude: [mcp_*]` stays valid in a deployment that loads no MCP tools), unlike `toolOrder`'s referent check.

## Chain semantics

The chain key is `(tool name, canonical arguments)` — canonicalization is a deep key-sort plus `JSON.stringify`, so argument objects differing only in property order count as identical. A call identical to the previous tracked call increments the agent's consecutive counter; a different tracked call resets it to 1.

- **Untracked calls are transparent to the chain.** A call excluded by `include`/`exclude` neither increments nor resets the counter, so `grep X → todo_write → grep X` still counts as two consecutive `grep X` when `todo_write` is excluded. This is what makes exclusion useful: bookkeeping tools interleaved into a loop must not launder it.
- **Denied calls count.** Detection sits on `tools/post-execute`, which also runs for calls a `tools/pre-execute` listener denied — a model hammering a denied call is exactly the loop worth breaking.
- **The hard stop denies before dispatch.** With `hardStop.enabled`, the guard's own `tools/pre-execute` listener denies the call whose run would reach `at` — the tool body never runs, later `tools/pre-execute` listeners never see the call, and the deny reason becomes the call's error result. The denied call still passes post-execute, so it counts toward the chain: identical follow-ups stay denied until the agent changes tool or arguments (a different tracked call resets the chain to 1 as usual).
- **Calls without an agent are ignored.** A direct `ctx.tools.execute()` caller has no model to remind and no live agent object to key on.
- **Per-agent keying.** The tool registry is context-level and subagents interleave through the same waterfall, so a `WeakMap<Agent, Chain>` keys each chain by the live agent object; one agent's repetition never trips another's reminder. A user prompt (`agent/pre-step`) resets the submitting agent's chain, and object lifetime bounds the weak entry without a disposal listener.
- **In-memory only.** A session resumed from persistence starts with a fresh chain — the guard is a heuristic nudge, not a logged invariant, later reminders are the accepted cost.

## Reminder delivery

Reminders ride the post-execute decision's `additionalContexts` (source `{kind: 'plugin', plugin: 'repeat-tool-reminder'}`), never a `content` replacement: the `tool/result` event stays the tool's own output for audit. The loop buffers the context and appends it as an injected `user/message` after the step's tool results, which the session renders as a plain synthetic user message — so the reminder is model-visible, source-attributed, and reconstructable from the session log with no new session event. The guard always delegates via `next()` and prepends its reminder to the downstream decision's context array (both variants — a blocked call still gets the nudge); every entry retains its own source and metadata.

## Model Experience

### First-threshold context message

#### What the model sees

At the first configured consecutive-repeat threshold, that agent receives the reminder below. No tool schema or normal-call text is added.

##### First-threshold reminder

```markdown
You are repeating the exact same tool call with identical arguments. Carefully analyze the previous result before calling again: if the task is not complete, try a different approach or different arguments instead of repeating the call.
```

#### Token effect

Zero tokens before the threshold. The reminder is retained history for that agent.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Later-threshold context message

#### What the model sees

A later threshold receives the detailed reminder template below. A capped argument preview ends exactly `… (+<omitted> more chars)`.

##### Later-threshold reminder

```markdown
Repeated tool call detected:
- tool: <toolName>
- consecutive_calls: <count>
- arguments: <canonicalArguments>
The repeated calls are not making progress. Do not call this tool with these exact arguments again. Inspect the latest result and choose a different action, different arguments, or finish the task if enough evidence has been gathered.
```

#### Token effect

Each reminder is retained history; `argumentsPreviewChars` bounds its data-dependent argument text, while agents keep independent counters.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Hard-stop denial

#### What the model sees

Only with `hardStop.enabled`: the call that would reach `at` consecutive identical tracked calls never runs; its result is an error carrying the denial below. The text stands alone as the correction signal.

##### Hard-stop denial

```markdown
Error: repeat-tool-reminder hard stop: '<toolName>' was called <count> times in a row with identical arguments — this call is denied and identical attempts stay denied. Stop repeating this call. Inspect the latest result, then choose a different tool, different arguments, or finish the task. arguments: <canonicalArguments>
```

#### Token effect

No tokens while the run stays below `at`; each denied attempt adds one error result plus the denial text to retained history.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

- **Exact-match detection only** — canonicalization is a deep key-sort, so near-identical variants (a tweaked path, extra whitespace inside a value) evade the chain; fuzzy matching is rejected pending evidence of need.
- **Compaction does not reset chains** — a chain spanning a compaction checkpoint keeps counting.
- **Opt-in breaker, advisory by default** — the hard stop denies only when `hardStop.enabled` is set; deployments that want pure nudges keep the default. A breaker configured at or below a reminder threshold trips before that reminder fires.
- **Hard-stop denials are identity-scoped, not semantic** — near-identical variants escape the breaker exactly as they escape the chain.
- **No subagent chain-sharing** — chains stay isolated per agent; a parent and its subagent repeating the same call never combine.
- **Legitimate idempotent polling still draws nudges** — and, with the breaker enabled, denials — the pressure valves are `thresholds`/`at`/`exclude` config.
- **Past the highest threshold a chain goes silent** — reminders fire only at exact configured counts, never beyond them.
