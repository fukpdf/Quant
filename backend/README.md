# /backend — API Server

> The backend API server lives in `artifacts/api-server/` as a pnpm workspace package.
> This directory is reserved for backend-specific documentation, shared middleware, and service modules
> as the server grows beyond its initial structure.

---

## Purpose

The backend is the Express 5 API server that serves all data to the frontend, enforces business rules, coordinates market data ingestion, runs the risk engine, and manages all application state via PostgreSQL.

---

## Current Location

The API server workspace package is at:
```
artifacts/api-server/          (@workspace/api-server)
├── src/
│   ├── app.ts                 # Express app setup
│   ├── index.ts               # Server entry point
│   ├── lib/logger.ts          # Pino logger singleton
│   ├── middlewares/           # Global middleware
│   └── routes/                # Route handlers
│       ├── index.ts           # Route registration
│       └── health.ts          # GET /api/healthz
└── build.mjs                  # esbuild build script
```

---

## Technology

| Layer | Technology |
|-------|-----------|
| Framework | Express 5 |
| Language | TypeScript 5.9 (strict) |
| Validation | Zod v4 (generated schemas from OpenAPI) |
| ORM | Drizzle ORM |
| Logging | pino (via `req.log` in handlers, `logger` singleton elsewhere) |
| Build | esbuild (CJS bundle) |

---

## Running the API Server

```bash
# Development (via Replit workflow)
pnpm --filter @workspace/api-server run dev

# Build
pnpm --filter @workspace/api-server run build

# Typecheck
pnpm --filter @workspace/api-server run typecheck
```

---

## API Contract

The API is defined in `lib/api-spec/openapi.yaml`. This is the source of truth.

After any spec change:
```bash
pnpm --filter @workspace/api-spec run codegen
```

Generated outputs:
- `lib/api-client-react/` — React Query hooks for frontend
- `lib/api-zod/` — Zod schemas for server-side validation

---

## Adding Routes

See `.local/skills/pnpm-workspace/references/server.md` for the full guide.

Quick summary:
1. Add endpoint to `lib/api-spec/openapi.yaml`
2. Run codegen
3. Add Zod validation schema import in the route handler
4. Add the handler in `artifacts/api-server/src/routes/`
5. Register in `artifacts/api-server/src/routes/index.ts`

---

## Logging Rules

- **Never use `console.log`** in server code
- In route handlers: use `req.log.info(...)`, `req.log.error(...)` etc.
- In non-request code: use the `logger` singleton from `src/lib/logger.ts`
- Never log secrets, credentials, tokens, or full request bodies if they contain sensitive data

---

## For AI Agents

Before modifying any server code:
1. Read [AGENTS.md](../AGENTS.md)
2. Update the OpenAPI spec first if adding endpoints
3. Run codegen before writing implementation code
4. Use `req.log` / `logger` — never `console.log`
5. Validate all inputs with generated Zod schemas
6. Handle all errors explicitly — no empty catch blocks
