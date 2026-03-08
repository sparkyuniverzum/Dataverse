# ADR: Star Laws v2 - Immutable Constitution + Physical Laws Engine

Status: proposed
Date: 2026-03-05
Owner: BE + FE core architecture

## 1. Context

Current Star layer already exposes policy/runtime/pulse/domain metrics and supports profile lock.
This solved constitutional integrity, but physical behavior is still mixed between:
- local FE heuristics,
- partial backend physics projection,
- non-explicit profile semantics for planet behavior under load/inactivity.

Project direction requires:
- clear LEGO-like composition rules,
- deterministic and explainable visual behavior,
- strict separation of immutable internal rules vs tunable physical behavior.

## 2. Decision

We split Star laws into two layers and lock them at onboarding time.

1. `Constitution Laws` (immutable after lock):
- no hard delete,
- soft-delete mode,
- OCC enforcement,
- idempotency,
- branch consistency.

2. `Physical Laws` (deterministic simulation profile):
- how planets scale, glow, pulse, corrode, and phase-shift,
- profile-driven by one of three star archetypes.

Three physical profiles are introduced:
- `FORGE` (transaction-heavy),
- `BALANCE` (default),
- `ARCHIVE` (long-term catalog stability).

After lock:
- profile change is not a mutable edit,
- only versioned migration is allowed (`vN -> vN+1`), with audit trail.

## 3. Why this architecture

1. Keeps invariant safety rules independent from visual tuning.
2. Makes onboarding explicit: first lock star laws, then create first planet.
3. Lets FE render from backend runtime state instead of inventing behavior locally.
4. Supports deterministic replay (`as_of`, branch replay, event re-projection).

## 4. Law model

### 4.1 Input signals (normalized 0..1)

- `activity` (`A`): writes/reads frequency (EMA window).
- `stress` (`S`): conflict, retry, validation pressure.
- `health` (`H`): inverse of quality risk (null/dup/contract violations).
- `inactivity` (`I`): time since last meaningful write.
- `corrosion` (`C`): state variable with growth/decay.

### 4.2 Core equations

- Corrosion update:
`C(t+1) = clamp(C(t) + u*I - v*A, 0, 1)`

- Size factor:
`size = clamp(1 + a*log10(rows+1) + b*A - c*C, min_size, max_size)`

- Luminosity:
`lum = clamp(l0 + d*A + e*S - f*C, 0, 1)`

- Pulse:
`pulse = clamp(p0 + g*A + h*S, pulse_min, pulse_max)`

- Color mapping:
`hue/saturation/value` derived from `H` and `C`.

### 4.3 Planet phases

`CALM -> ACTIVE -> OVERLOADED -> DORMANT -> CORRODING -> CRITICAL`

Transitions are threshold-based with hysteresis to avoid phase flapping.

## 5. Scope boundaries

### In scope
- Star law structure,
- physical profile selection/lock,
- BE runtime state computation contract,
- FE render contract,
- migration and audit policy.

### Out of scope
- final numeric tuning for all business domains,
- fancy shader specifics,
- product copy decisions.

## 6. FE state machine (Star-first onboarding)

`Idle -> StarFocused -> StarControlCenterOpen -> ApplyProfile -> Locked -> PlanetBuilderEnabled`

Rules:
- Stage 0 planet builder is blocked while not locked.
- Checklist must show constitutional invariants and their impact.
- After lock, setup proceeds to first planet flow.

## 7. Persistence strategy

Use read-model approach (no hard delete):
- immutable policy history,
- runtime state snapshots per planet,
- deterministic recompute from events.

## 8. Alternatives considered

1. Keep FE-only physics heuristics.
- Rejected: non-deterministic, hard to audit/replay.

2. Single law layer only.
- Rejected: constitutional invariants get mixed with tuning changes.

3. Allow live profile edits after lock.
- Rejected: violates onboarding contract and temporal consistency.

## 9. Consequences

Positive:
- deterministic visual behavior,
- clear governance,
- stable basis for LEGO builder layers.

Tradeoffs:
- more backend model complexity,
- profile migration workflow required,
- additional contract/version tests.

## 10. Rollout plan

1. Introduce v2 contracts in parallel with v1 outputs.
2. Populate runtime state read-model behind feature flag.
3. Switch FE render source to backend-first with fallback.
4. Lock onboarding on Star profile before planet creation.
5. Enable migration-only profile changes.

## 11. Acceptance criteria

1. Same event timeline => same planet runtime state.
2. No constitutional field can be edited after lock.
3. FE does not compute authoritative physics from local heuristics.
4. Runtime state is available in main timeline and branch scope.
5. Contract/test gates fail on incompatible schema drift.

## 12. Open questions

1. Do we expose per-planet coefficient overrides in future (default: no)?
2. How often should batch recompute run under heavy write pressure?
3. Which domain metrics enter `stress` in v1 vs v2?
