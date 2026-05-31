---
name: Routes index mount
description: v1Router must be explicitly imported and mounted in routes/index.ts — omitting the mount silently kills all /api/v1/* routes while healthz still works.
---

## The rule
Every time a new sub-router level is introduced (e.g. `/v1`, `/v2`), it must be imported and mounted in `artifacts/api-server/src/routes/index.ts`.

```ts
import v1Router from "./v1";
router.use("/v1", v1Router);
```

**Why:** Express only forwards requests to routers that are explicitly mounted. If the mount line is absent, `/api/v1/*` returns a 404 HTML page from Express's default handler — indistinguishable at first glance from an application error. The health endpoint still works because it is mounted on the root router directly.

**How to apply:** After adding a new route file to `routes/v1/index.ts`, confirm `routes/index.ts` already has `router.use("/v1", v1Router)`. If introducing a new version prefix (`/v2`), add the equivalent line.
