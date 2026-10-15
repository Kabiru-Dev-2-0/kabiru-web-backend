# Architecture decisions

## Service boundaries

| Service | Owns | Avoid owning |
|---|---|---|
| API Gateway | HTTP ingress, request IDs, rate limiting, routing, API versioning | Domain persistence/business rules |
| Auth | Credentials/identity, access/refresh tokens or external identity verification | Learning progress |
| Users | Profile and user preferences | Password/session internals if Auth owns identity |
| Learning | Lessons, materials, quiz definitions | Attempts/XP totals |
| Progress | Attempts, score snapshots, XP ledger, streak calculation | Content authoring |
| AI | Provider adapters, prompt templates, AI jobs and AI result metadata | User/profile canonical data |

## Data ownership

Use one PostgreSQL server in local development but separate databases per service. In production, databases may share a managed PostgreSQL cluster initially, but each service must own its database credentials and migrations. Cross-service data needs APIs or events, not direct table joins.

## Communication

The starter uses NestJS TCP transport for internal request/response as a simple local baseline. Before production, assess HTTP/gRPC for interoperable contracts and a durable broker (for example RabbitMQ/NATS/Kafka) for asynchronous workflows. Do not add a broker until there is a concrete event/queue requirement.

## Authentication migration

Supabase is not assumed to remain in the target architecture. Before removing it, inventory Auth users, OAuth providers, sessions, RLS policies, SQL functions, triggers, storage and edge functions. Password hashes may not be portable in a directly usable form; plan account linking or password reset if needed. Every public service operation must verify identity/authorization according to the selected trust model.

## Concurrency-sensitive operations

Progress and streak logic should use transactions, constraints/idempotency keys, and conditional updates. Avoid relying on Redis distributed locks as the only correctness mechanism when PostgreSQL transactions/constraints can enforce invariants.
