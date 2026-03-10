# Platform Runtime Hardening Sprint Plan v1

Status: active (PRH-1 complete, PRH-2 in progress)
Date: 2026-03-10
Owner: BE Lead + Platform Owner + SRE
Depends on:
- `docs/contracts/contract-gate-plan-v2.md`
- `docs/release/v1-rollout-runbook.md`
- `docs/contracts/api-v1.md`

## 1. Goal

Move current runtime toward production-grade platform behavior in 6 areas:
1. strict module decoupling via event-driven architecture
2. transactional outbox pattern
3. full observability baseline (tracing + structured logs)
4. database layer readiness for read/write split
5. API resilience patterns (circuit breaker + rate limiting)
6. graceful shutdown with in-flight task draining

## 1.1 Priority map (severity + blast radius + value)

1. `P0` Event-driven decoupling foundation (`UserCreated` and other domain events as first-class runtime contract).
2. `P0` Transactional outbox and relay delivery guarantees.
3. `P1` Observability baseline (OpenTelemetry + JSON logs + correlation IDs).
4. `P1` API resilience baseline (circuit breaker + rate limiting).
5. `P2` DB read/write split readiness (abstraction + routing hooks).
6. `P2` Graceful shutdown hardening (SIGTERM drain and clean close path).

## 2. Sprint map

### Sprint PRH-1 (event contract + outbox foundation)

Goal:
- remove direct cross-module service calls in critical flows and define domain event contract.

Scope:
1. Define canonical event envelope (`event_id`, `event_type`, `occurred_at`, `aggregate_id`, `payload`, `trace_id`, `correlation_id`).
2. Add outbox table and repository write path in same DB transaction as business write.
3. Add relay worker skeleton (`pending -> published/failed`) with retry metadata.
4. Introduce idempotency key policy for consumers.

DoD:
1. At least one flow writes business data + outbox event atomically.
2. Relay publishes from outbox without direct coupling to request path.
3. Event contract doc exists and is test-covered.
4. No direct service-to-service call remains in selected pilot flow.

Gate:
- `pytest -q tests -k "outbox or event_store or event_contract"`
- `pytest -q tests/test_api_integration.py -k "idempotency or replay"`

## 2.1 PRH-1 implementation blocks (ready to execute)

### Block PRH-1A (event envelope + persistence contract)

Goal:
- freeze canonical event envelope and persist event records in one place.

Implementation tasks:
1. Add explicit event envelope schema module (typed dataclass/pydantic model).
2. Add/normalize event persistence contract in `event_store_service.py` (append + query by status/type).
3. Add DB migration for outbox/event table minimal fields:
   - `id`, `event_type`, `aggregate_id`, `payload_json`, `trace_id`, `correlation_id`, `status`, `created_at`, `available_at`, `attempt_count`, `last_error`.
4. Add contract docs note for envelope fields and status lifecycle.

Exit criteria:
1. Envelope validation rejects missing required fields.
2. Event can be written/read with deterministic status defaults (`pending`).
3. Migration is backward-compatible.

Focused gate:
- `pytest -q tests -k "event_envelope or event_store_contract"`
- `python -m py_compile app/services/universe/event_store_service.py`

### Block PRH-1B (transactional outbox write path)

Goal:
- write business entity and outbox event atomically in one DB transaction.

Implementation tasks:
1. Introduce outbox repository method that accepts active DB session/transaction.
2. In selected pilot write flow, replace direct cross-module call with:
   - business write
   - outbox append in same transaction
3. Add rollback test where business write fails and outbox row is not committed.
4. Add rollback test where outbox append fails and business write is not committed.

Exit criteria:
1. No partial commit state (business yes / event no, or event yes / business no).
2. Pilot flow no longer depends on direct module-to-module synchronous call.

Focused gate:
- `pytest -q tests -k "transactional_outbox or atomic_write"`
- `pytest -q tests/test_api_integration.py -k "pilot and outbox"`

### Block PRH-1C (relay skeleton + retry semantics)

Goal:
- deliver outbox events asynchronously with deterministic retry behavior.

Implementation tasks:
1. Add relay worker/service that fetches `pending` events by batch.
2. Add publish adapter interface (`publish(event)`) with fake/in-memory implementation for tests.
3. Implement status transitions:
   - `pending -> published`
   - `pending -> failed` with `attempt_count` and `last_error`
   - retry re-queues failed events by `available_at`.
4. Add idempotency helper for consumers (`event_id` dedupe store/check).

Exit criteria:
1. Successful publish marks event `published`.
2. Failed publish increments attempts and keeps event retryable.
3. Re-running relay over same already-published event is safe.

Focused gate:
- `pytest -q tests -k "outbox_relay or relay_retry or consumer_idempotent"`
- `pytest -q tests/test_api_integration.py -k "replay or idempotency"`

### Block PRH-1D (pilot flow decoupling validation)

Goal:
- prove end-to-end decoupling on one real workflow (onboarding -> downstream provisioning).

Implementation tasks:
1. Modify pilot service to emit event only (no direct downstream call).
2. Implement consumer side handler for provisioning path.
3. Add operator/API status field for eventual consistency visibility.
4. Add integration test for:
   - success path
   - delayed consumer
   - duplicate event delivery

Exit criteria:
1. Original request latency no longer depends on downstream module execution.
2. Downstream failure is recoverable by retry, not by request replay.
3. Integration tests pass consistently.

Focused gate:
- `pytest -q tests/test_api_integration.py -k "onboarding and event and provision"`
- `pytest -q tests -k "event_consumer and duplicate_delivery"`

### Sprint PRH-2 (decoupled workflow pilot: onboarding -> universe)

Goal:
- replace synchronous orchestration with async event reaction.

Scope:
1. `OnboardingService` emits `UserCreated` (and optional `UserOnboardingRequested`) only.
2. `Universe` side consumes event and provisions defaults asynchronously.
3. Add retry + dead-letter strategy for consumer failures.
4. Add operator-visible status for eventual consistency phase.

DoD:
1. API request returns without waiting for downstream provisioning.
2. Downstream failure does not roll back original user creation.
3. Consumer is idempotent on duplicate event delivery.
4. Integration test covers success + retry + duplicate delivery.

Gate:
- `pytest -q tests/test_api_integration.py -k "onboarding and event"`
- `pytest -q tests -k "consumer and idempotent"`

### Sprint PRH-3 (observability + resilience baseline)

Goal:
- make runtime diagnosable and resilient under partial failures.

Scope:
1. OpenTelemetry traces for API entry -> service -> DB -> outbox relay.
2. Structured JSON logging with required fields (`module`, `trace_id`, `correlation_id`, `user_id` where available).
3. Circuit breaker wrapper for external calls / cross-boundary calls.
4. Rate limiting middleware with deterministic error envelope.

DoD:
1. Every request has stable `trace_id` propagated to logs.
2. Relay and consumers emit structured logs with event identifiers.
3. Circuit breaker behavior covered by tests (open/half-open/close transitions).
4. Rate-limit responses are stable and documented.

Gate:
- `pytest -q tests -k "telemetry or tracing or rate_limit or circuit_breaker"`
- `pytest -q tests/test_api_integration.py -k "429 or resilience or timeout"`

### Sprint PRH-4 (DB routing readiness + graceful shutdown)

Goal:
- harden runtime lifecycle and persistence routing for scale.

Scope:
1. Introduce DB access abstraction that can route read queries to replica and writes to primary.
2. Keep default deployment backward-compatible (single DB still works).
3. Implement SIGTERM shutdown hook: stop intake, drain executor queue, flush outbox relay batch, close DB pool.
4. Add shutdown timeout policy and safe forced-stop fallback.

DoD:
1. Read/write router is enabled by config and test-covered.
2. Graceful shutdown finishes in-flight tasks or marks them recoverable.
3. DB and worker connections close without leak warnings.
4. Runbook section for shutdown operations is updated.

Gate:
- `pytest -q tests -k "graceful_shutdown or db_router or replica"`
- `pytest -q tests/test_api_integration.py -k "shutdown or projection_recover"`

## 3. Closure checklist (global)

1. [x] PRH-1 event envelope + outbox schema freeze approved.
2. [x] PRH-1 relay + retry semantics implemented and passing.
3. [ ] PRH-2 onboarding flow decoupled to event-driven path.
4. [ ] PRH-3 OpenTelemetry trace propagation operational.
5. [ ] PRH-3 structured JSON logging contract enforced.
6. [ ] PRH-3 resilience middleware enabled (rate limit + circuit breaker).
7. [ ] PRH-4 DB routing abstraction implemented (single-DB compatible).
8. [ ] PRH-4 graceful shutdown verified with in-flight task drain.
9. [ ] Release runbook updated with new operational procedures.

Progress note (2026-03-10):
1. PRH-1A/1B/1C/1D implemented and test-covered.
2. PRH-2A started: outbox consumer registry + in-process relay dispatch wiring landed.
3. PRH-2B started: relay max-attempts policy with `dead_letter` terminal status + migration.
4. PRH-2C started: run-once relay runner orchestration + structured summary payload.
5. PRH-2D started: internal outbox trigger/status endpoints via operator service.
6. PRH-3A started: structured outbox logs with trace/correlation propagation across operator -> runner -> relay.
7. PRH-3B started: global JSON log formatter with required structured field contract.
8. PRH-3C started: rate-limit middleware baseline + async circuit-breaker helper with contract tests.

## 4. Risk register

1. Outbox relay can create duplicate deliveries if consumer idempotency is incomplete.
2. Eventual consistency can confuse operators without clear status UX/API fields.
3. Tracing/logging overhead can regress latency if sampling and payload size are not controlled.
4. Circuit breaker misconfiguration can block healthy traffic.
5. Read/write split can return stale reads if consistency expectations are not explicit.
6. Shutdown drains can exceed orchestration timeout and cause forced termination.

## 5. Success metrics

1. `cross_module_direct_call_count = 0` in selected critical flows.
2. `outbox_delivery_success_rate >= 99.9%` with retry.
3. `trace_coverage_api_requests >= 95%` in staging.
4. `structured_log_compliance >= 95%` (required fields present).
5. `rate_limit_rejection_envelope_consistency = 100%`.
6. `graceful_shutdown_success_rate >= 99%` in controlled restart tests.

## 6. Execution rule

1. Implement in small blocks with focused tests after each block.
2. Run long integration gates only after a bundle of completed blocks.
3. Do not expand monolith modules; split into focused adapters/services.

## 7. PRH-1A contract freeze note (event envelope + outbox lifecycle)

Canonical event envelope fields:
1. `event_id` (UUID)
2. `event_type` (string)
3. `occurred_at` (UTC datetime)
4. `aggregate_id` (UUID)
5. `payload` (JSON object)
6. `trace_id` (string)
7. `correlation_id` (string)

Canonical outbox lifecycle:
1. `pending` (ready for relay pickup)
2. `published` (successfully emitted)
3. `failed` (publish failed, retryable by policy using `available_at` + `attempt_count`)
