# Quality assurance and test strategy

This document describes how the system is quality-assured: the test strategy, what each
test level is responsible for, our definition of done and test policy, and how AI support
was used critically in the work. How to run the tests is in [README.md](../README.md#tests).

## Test strategy (test pyramid)

We use three levels, from many fast tests to a few broad ones:

| Level | What it tests | Dependencies | Where |
|---|---|---|---|
| **Unit tests** | Pure business logic and data contracts (Zod schemas) | None – no database, no network | [tests/unit/](../tests/unit/) |
| **Integration tests** | Each service's HTTP contract + database interaction via nginx | The whole stack (Docker Compose) | [tests/integration/api.test.ts](../tests/integration/api.test.ts) |
| **End-to-end (e2e)** | Whole flows from client to completion, incl. RabbitMQ events | The whole stack | [tests/e2e/](../tests/e2e/) |

**Principle:** the further down the pyramid, the more is tested. Logic that can be isolated
(pricing, status transitions, validation, the product cache) is tested as fast unit tests.
Only what genuinely requires real infrastructure (HTTP, database, message queue) is lifted
up to integration/e2e.

### Events: contract vs. propagation

Event-driven communication is tested in two parts to keep fast and slow tests separate:

- **Contract** (unit): [tests/unit/events.test.ts](../tests/unit/events.test.ts) verifies that
  each event's Zod schema accepts valid payloads and rejects invalid ones. This is our
  versioned data contract between the services.
- **Propagation** (e2e): the full flow in [tests/e2e/order-flow.test.ts](../tests/e2e/order-flow.test.ts)
  proves that events are actually published and consumed over RabbitMQ
  (`order.created` → kitchen, `order.status.updated` → order-service + notification).

## Contracts, versioning and robustness

The following reduces integration errors and strengthens the robustness of the flow:

- **Schema validation at every boundary.** Incoming HTTP bodies and events are validated with
  Zod ([shared/src/schemas.ts](../shared/src/schemas.ts), [shared/src/events.ts](../shared/src/events.ts))
  before any business logic or database call runs. Invalid input is stopped early with a 400.
- **Shared error handler.** All services share [shared/src/error-handler.ts](../shared/src/error-handler.ts)
  and the error classes in [shared/src/errors.ts](../shared/src/errors.ts), so errors map
  consistently to status codes (400/404/500) and a uniform JSON response.
- **Versioned public API path.** All public routes sit behind `/api/v1` in nginx. The prefix
  is centralized in one place in the frontend ([frontend/src/api.ts](../frontend/src/api.ts)), so a
  future breaking change can be introduced as `/api/v2` without old clients breaking.
- **Invalid events are dropped, not requeued.** The consumer in
  [shared/src/rabbitmq.ts](../shared/src/rabbitmq.ts) nacks schema-breaking messages without
  requeue, so a broken message doesn't get stuck in an infinite loop (fault isolation).

## Tested error scenarios

Robustness is demonstrated by testing failure paths explicitly, not just happy paths:

- Invalid input (missing name/email, bad email format, empty order, quantity 0) → **400**.
- Unknown or malformed id → **400**, unknown resource → **404**.
- Invalid status transition in the kitchen (e.g. `pending → completed`) → **400**; the ticket's
  state is left unchanged and the correct transition still works afterwards
  ([tests/e2e/order-flow-multi.test.ts](../tests/e2e/order-flow-multi.test.ts)).
- Unknown status value in a PATCH body is rejected by the schema → **400**.
- Customer isolation: one customer cannot fetch another customer's order → **404**.

## Definition of Done

A change is done when:

1. Relevant logic is covered by unit tests and new/changed endpoints by integration tests.
2. Affected flows are covered by e2e tests.
3. The whole test suite (unit + integration + e2e) is green locally **and** in CI.
4. Failure paths (validation, correct status codes) are tested, not just success cases.
5. Public documentation (README/endpoints) matches the code.

## Test policy

- Tests run automatically in GitHub Actions on every push to **all** branches and on pull
  requests ([.github/workflows/ci.yml](../.github/workflows/ci.yml)).
- CI starts the whole stack with Docker Compose and runs the integration and e2e tests against it.
- Green CI is required before code is considered ready to merge.
- E2E tests use polling (`waitFor`) instead of fixed `sleep`s to stay stable despite
  asynchronous event propagation.

## Critical use of AI support

AI support (Claude) was used to produce and review test cases and to identify quality gaps.
The approach was critical rather than accepting suggestions at face value:

- AI was used to **inventory test gaps** (which flows, APIs and events lacked coverage) and to
  propose new test cases – e.g. a multi-item order, an error scenario for status transitions,
  and a unit test for the product cache.
- Every suggestion was reviewed against the actual code before it was adopted. Suggestions that
  added unnecessary complexity or new dependencies (e.g. extra abstractions) were rejected in
  favour of the simplest solution that satisfies the requirement.
- AI motivated architectural decisions (versioning, contract tests) which were then judged on
  whether they actually reduce integration errors – not merely because they were suggested.
