---
name: DB import convention
description: "@workspace/db has no ./client subpath export — always import from @workspace/db, not @workspace/db/client"
---

## Rule
Import the Drizzle `db` client from `@workspace/db`, never from `@workspace/db/client`.

**Why:** The `lib/db/package.json` exports only `.` and `./schema` subpaths. The `/client` subpath does not exist. TypeScript resolves it as "module not found", causing cascade errors in all files that import from the failing module.

**How to apply:** Any time a Phase 11 (or future) service needs the DB client:
```typescript
import { db } from "@workspace/db";
import { someTable } from "@workspace/db/schema";
```
Never:
```typescript
import { db } from "@workspace/db/client"; // WRONG — path does not exist
```
