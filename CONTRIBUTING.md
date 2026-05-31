# CONTRIBUTING.md — Contribution Guidelines

> This document applies to all contributors: human developers and AI agents alike.

---

## For AI Agents

**Read [AGENTS.md](./AGENTS.md) first.** It contains the mandatory pre-coding and post-coding protocol that all AI agents must follow before making any changes to this repository.

---

## For Human Contributors

This is primarily a personal project. Contributions from others are welcome but must follow the standards below.

---

## Before You Begin

1. Read [README.md](./README.md) for a project overview
2. Read [PROJECT_MASTER.md](./PROJECT_MASTER.md) for the project brain
3. Read [RULES.md](./RULES.md) for development rules
4. Read [DECISIONS.md](./DECISIONS.md) for prior architecture decisions
5. Check [TODO.md](./TODO.md) to understand the current phase and open tasks

---

## Branch Strategy

```
main                    # Stable, always deployable
├── phase/0-foundation  # Phase-level branches
├── feat/feature-name   # Feature branches
├── fix/bug-description # Bug fix branches
└── docs/doc-update     # Documentation-only branches
```

- All work happens on feature branches, never directly on `main`
- Branch names use kebab-case
- Branch names start with a type prefix: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`

---

## Commit Standards

### Format

```
type(scope): short description (max 72 chars)

Optional body explaining WHY this change was made.
The body explains context, not what the code does.

Refs: #123
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `chore` | Build system, dependency updates, tooling |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `style` | Code style changes (formatting, whitespace) |
| `ci` | CI/CD pipeline changes |

### Scopes (Examples)

`api`, `frontend`, `database`, `risk`, `backtest`, `data`, `docs`, `security`, `auth`

### Rules

- Subject line is imperative mood: "Add healthz endpoint" not "Added healthz endpoint"
- No period at the end of the subject line
- Body lines wrap at 72 characters
- Reference relevant issues with `Refs: #N` or `Closes: #N`

---

## Pull Request Process

1. **Create a PR** from your feature branch to `main`
2. **Use the PR template** — fill in all sections
3. **Self-review** — read your own diff before requesting review
4. **Update documentation** — every PR that changes behavior must update relevant docs
5. **Update CHANGELOG.md** — add entries for all meaningful changes
6. **Update TODO.md** — mark completed tasks; add any new tasks discovered

### PR Checklist (also in the PR template)

- [ ] Code follows project coding standards
- [ ] No secrets or credentials in any file
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] TODO.md updated
- [ ] DECISIONS.md updated if an architectural decision was made
- [ ] Tests pass (Phase 2+)
- [ ] No unrelated changes included

---

## Code Standards

### TypeScript

- Strict mode enabled — no `any` types without a documented reason
- Explicit return types on all exported functions
- No `console.log` in server-side code — use `req.log` or the `logger` singleton
- Imports from workspace packages use `@workspace/` prefix
- Only import what you use — unused imports are a build error

### API Development

1. Write the OpenAPI spec first
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Use generated Zod schemas for server-side validation
4. Use generated React Query hooks on the client
5. No hand-rolled fetch calls

### Error Handling

- All async functions handle errors explicitly
- No swallowed exceptions (empty catch blocks)
- Errors are logged with sufficient context to diagnose
- User-facing error messages do not expose implementation details

---

## Documentation Standards

### What Must Be Documented

| Change Type | Required Documentation |
|-------------|----------------------|
| New feature | Feature description in relevant docs/ file |
| New API endpoint | Entry in docs/09-API_STRATEGY.md |
| Database schema change | Update docs/05-DATABASE_ARCHITECTURE.md |
| Architecture decision | New ADR in DECISIONS.md |
| Security change | Update SECURITY.md |
| Phase completion | Update TODO.md, CHANGELOG.md, README.md roadmap table |

### Style

- Use plain language — write for clarity, not to impress
- Present tense for current state: "The API returns..." not "The API will return..."
- Tables over prose for structured information
- Code blocks for all commands, file paths, and code snippets

---

## Security Requirements

Before submitting any PR:

- Run `grep -r "password\|secret\|api_key\|apikey\|token" --include="*.ts" --include="*.js" --include="*.json" .` and verify no real credentials appear
- Check that `.env` is not staged for commit
- Verify `.env.example` contains no real values

See [SECURITY.md](./SECURITY.md) for full security policy.

---

## Questions and Issues

- **Bug reports** — Use the GitHub bug report template
- **Feature requests** — Use the GitHub feature request template
- **Architecture questions** — Open a GitHub discussion or create a draft PR with your proposed approach documented in DECISIONS.md format
