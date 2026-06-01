---
name: Orval codegen barrel fix
description: orval auto-regenerates lib/api-zod/src/index.ts with both api and types exports on every codegen run, causing TS2308 conflicts for endpoints with both path and query params.
---

## Problem

When an OpenAPI endpoint has BOTH path params (`{accountId}`) AND query params (`limit`, `status`), orval generates:
- `GetXxxParams` zod const in `generated/api.ts` (for path params)
- `GetXxxParams` TypeScript type in `generated/types/getXxxParams.ts` (for query params)

Both have the same name. The auto-generated barrel `lib/api-zod/src/index.ts` re-exports from both:
```ts
export * from "./generated/api";
export * from './generated/types';
```

TypeScript raises TS2308 (ambiguous re-export) because both modules export the same name.

## Why

Prior phases avoided this because their endpoints either had ONLY path params OR ONLY query params (not both). Phase 7+ introduces endpoints like `GET /v1/portfolio/allocation/{accountId}/history` with both.

## Fix

In `lib/api-spec/package.json`, post-process the generated barrel after orval runs:

```json
"codegen": "orval --config ./orval.config.ts && printf 'export * from \"./generated/api\";\\n' > ../../lib/api-zod/src/index.ts && pnpm -w run typecheck:libs"
```

This overwrites the barrel to only export from `generated/api`, eliminating the conflict. The zod schemas in `api.ts` already include full TypeScript type inference via `z.infer<>`, so consumers lose nothing.

**Why:** The `generated/types` TypeScript aliases are redundant — all types are inferrable from the zod schemas. The only consumer of `@workspace/api-zod` is the api-server route validation layer, which uses zod schemas directly.
