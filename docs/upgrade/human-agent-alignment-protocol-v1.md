# Human-Agent Alignment Protocol v1

Status: active (mandatory collaboration override for UX-first work)
Date: 2026-03-11
Owner: user + coding agent
Scope: entire repository when the task is framed as UX, refactor, product experience, or operating-center quality

## 1. Why this exists

This protocol exists because technical refactor closure was previously mistaken for user-experience closure.

That is not acceptable for UX-first work.

If the user asks for a refactor focused on experience, then:
1. architecture cleanup is not enough,
2. internal seam extraction is not enough,
3. documentation closure is not enough,
4. the result must be validated against visible user impact.

## 2. Non-negotiable interpretation rule

When repository documents say:
1. UX is the primary criterion,
2. weak experience means product failure,
3. the product must feel like an operating center,
4. the main work zone must remain primary,
5. validation must follow journeys and user-visible impact,

the agent must treat those statements as hard gates, not as background context.

They override convenience, internal elegance, and premature closure.

## 3. Mandatory pre-implementation contract

Before any substantial UX/refactor block, the agent must explicitly write:
1. the binding conditions taken from the governing documents,
2. what in the current product violates those conditions,
3. what will count as acceptable proof of completion,
4. what will not count as completion.

Implementation must not start until this framing is written out clearly to the user.

## 4. Mandatory completion vocabulary

The agent must never use one vague word such as `hotovo` or `done` for mixed states.

Completion must always be split into these categories:
1. `technical completion`
2. `user-visible completion`
3. `documentation completion`
4. `gate completion`

If one of these is missing, the block must say so explicitly.

## 5. UX-first acceptance rule

For UX/product experience work, the primary acceptance standard is:
1. visible change in default or target user flow,
2. improved first impression or journey quality,
3. operating-center feel in actual interaction,
4. stronger clarity of hierarchy and action,
5. user-visible value without requiring hidden internal knowledge.

The following do **not** count as sufficient proof on their own:
1. seam extraction,
2. token consolidation,
3. helper or contract creation,
4. monolith reduction,
5. drawer or mode logic that appears only in edge or hidden states,
6. documentation closure,
7. passing focused unit tests without visible product impact.

## 6. First-impression rule

If the task concerns product experience, the agent must explicitly evaluate:
1. what changes on first open,
2. what changes in the idle/default view,
3. what changes in the first 30 seconds of use,
4. whether the difference is visible without opening hidden modes.

If the answer is "almost nothing visible changed", then the block must not be presented as UX success.

## 7. Trust repair rule

If the agent fails to apply the user’s governing conditions, the next block must:
1. restate the missed conditions explicitly,
2. explain where the prior block violated them,
3. avoid shifting verification work back to the user,
4. re-establish a narrower and more auditable working contract.

## 8. Command responsibility rule

`Povel pro tebe` is for execution the user actually needs to run.

It must not be used to:
1. ask the user to rediscover context the agent should summarize,
2. ask the user to read documents the agent was supposed to interpret,
3. replace missing analysis,
4. offload the agent’s own reasoning work.

## 9. Required proof for future UX blocks

For any future UX-first block, acceptable proof should include some combination of:
1. before/after screenshots or an explicit first-view comparison,
2. concrete list of immediately visible differences,
3. targeted user-flow validation,
4. narrow tests for touched logic,
5. bundled gates when a series of UX blocks is complete.

## 10. Enforcement summary

For UX/refactor/product-experience tasks:
1. document conditions first,
2. judge visible impact before internal cleanliness,
3. never call architecture-only progress a UX success,
4. never collapse completion states into one ambiguous success claim,
5. never send the user to re-read source material instead of delivering the interpretation.
