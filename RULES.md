# RULES.md — Development Rules & Standards

> These rules are non-negotiable. They apply to all contributors and all AI agents working on this project.

---

## Core Principles

1. **Security before convenience** — If a shortcut compromises security, do not take it.
2. **Documentation first** — No feature is complete until it is documented.
3. **Small commits only** — Every commit should do exactly one thing and do it well.
4. **Changelog discipline** — Every meaningful change gets a CHANGELOG entry before the session ends.
5. **Phase discipline** — Work only within the current phase's scope.

---

## Secret Management Rules

| Rule | Detail |
|------|--------|
| No secrets in code | Never hardcode API keys, passwords, tokens, or credentials |
| No secrets in git | `.env` files are gitignored; only `.env.example` (no real values) is committed |
| Use environment variables | All configuration values are read from `process.env` |
| Never log secrets | Logging middleware must not output Authorization headers or request bodies containing credentials |
| Rotate on exposure | If a secret is ever committed to git accidentally, rotate it immediately — assume it is compromised |
| Use Replit Secrets | In development, use the Replit Secrets panel, not a local `.env` file |

---

## Version Control Rules

| Rule | Detail |
|------|--------|
| No direct main commits | All changes via feature branches and pull requests (once GitHub CI is configured) |
| Descriptive commit messages | Format: `type(scope): description` — e.g. `feat(api): add healthz endpoint` |
| One concern per commit | Do not mix feature work with refactoring or bug fixes |
| No force pushes to main | History is immutable on main |
| Tag releases | Each phase completion is tagged with a version |

### Commit Message Format

```
type(scope): short description

Optional longer explanation if needed.

Refs: #issue-number (if applicable)
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `ci`

---

## API Development Rules

| Rule | Detail |
|------|--------|
| OpenAPI spec first | Write `lib/api-spec/openapi.yaml` before any implementation |
| Run codegen before coding | `pnpm --filter @workspace/api-spec run codegen` after every spec change |
| No breaking changes without versioning | Deprecate old endpoints; do not remove them |
| Validate inputs server-side | Use generated Zod schemas — never trust raw request data |
| Use generated hooks client-side | Import from `@workspace/api-client-react`, never write raw fetch calls |
| Document every endpoint | Every OpenAPI path must have a summary, description, and response schemas |

---

## Database Rules

| Rule | Detail |
|------|--------|
| Schema changes via migrations | Never alter the database manually in production |
| Reversible migrations | Every migration must have a down path |
| Document schema changes | Update docs/05-DATABASE_ARCHITECTURE.md after every schema change |
| No raw SQL in application code | Use Drizzle ORM for all queries |
| Index thoughtfully | Add indexes only when query patterns justify them; document every index |
| No nulls without reason | Every nullable column must have a documented reason for allowing null |

---

## Frontend Rules

| Rule | Detail |
|------|--------|
| No hardcoded URLs | Use environment variables or the generated base URL |
| No inline styles | Use CSS classes or Tailwind utilities |
| No console.log in production | Remove or guard all debug logging |
| Accessible components | All interactive elements must have appropriate ARIA attributes |
| No emojis in UI | Unless the user explicitly requests them |
| Use generated hooks | Import React Query hooks from `@workspace/api-client-react` |
| Error states are required | Every data-fetching component must handle loading, error, and empty states |

---

## Documentation Rules

| Rule | Detail |
|------|--------|
| Update docs with features | Every new feature requires documentation before it is considered done |
| Keep TODO.md current | Mark tasks complete immediately when done; add new tasks as they are discovered |
| CHANGELOG entry per session | At minimum one entry per working session |
| Architecture decisions go in DECISIONS.md | Do not leave architectural choices undocumented |
| No placeholder content in production docs | "TODO: fill this in" is acceptable in Phase 0; not acceptable in Phase 2+ |

---

## Testing Rules

| Rule | Detail |
|------|--------|
| No merge without tests | (Phase 2+) All new functionality must have test coverage |
| Test the contract, not the implementation | Unit tests assert behavior, not internal implementation details |
| Backtesting results are reproducible | Given the same data, seed, and parameters, backtests must always produce identical results |
| Paper trading is not real trading | Never use paper trading results to make live capital decisions without live validation |

---

## Security Rules (Extended)

| Rule | Detail |
|------|--------|
| Principle of least privilege | Services only access what they strictly need |
| Input sanitization everywhere | Never trust any input — API requests, file uploads, database results |
| Audit log everything sensitive | Logins, API key usage, order submissions, risk overrides |
| Rate limit all external-facing endpoints | Protect against abuse and credential stuffing |
| No CORS wildcards in production | Explicitly whitelist allowed origins |
| HTTPS only | No plain HTTP in staging or production |
| Dependency audits | Run `pnpm audit` before each phase release |

---

## Prohibited Actions

These actions are absolutely prohibited at all times:

- Committing any real API key, password, token, or credential to git
- Implementing live trading execution before Phase 8
- Removing working functionality without explicit confirmation
- Skipping phases or implementing out-of-scope features
- Deploying to production without the defined workflow
- Using third-party analytics or telemetry that sends trading data off-platform
- Making autonomous financial decisions — AI assists, humans decide

---

## Enforcement

These rules are enforced by:

1. This RULES.md document (read by all AI agents and contributors)
2. AGENTS.md protocol (mandatory pre/post coding checklist)
3. Git hooks (to be configured in Phase 10)
4. Code review (to be formalized in Phase 10)
5. CI/CD checks (to be configured as phases progress)
