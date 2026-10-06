# TECP service skeleton

Isolated local skeleton for slice `TECP-003-SERVICE-SKELETON`.

This package is a standalone Node ESM module. It validates one canonical local configuration, exposes a deterministic `CREATED → STARTED → STOPPED` lifecycle, and reports local health. GitHub and Linear are fail-closed port stubs. They do not hold live authority.

## Boundaries

- Node built-ins only. This package declares no dependencies.
- No database, migration, Redis, durable filesystem state, credential, or secret.
- No outbound network. `outboundNetwork` must be `false`.
- No real GitHub or Linear call, webhook, scheduler, worker, lease, task orchestration, or conflict engine.
- No Titan runtime integration and no deployment.

Calling `invoke` on either port throws `TecpFailClosedError` and does not increment network or mutation counters.

## Local test

```bash
node --test test/serviceSkeleton.test.js
```
