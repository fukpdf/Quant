---
name: Drizzle inArray for UUID array conditions
description: Using raw sql`ANY($1::uuid[])` with a JS array causes "malformed array literal" in pg; always use inArray() from drizzle-orm instead.
---

## Rule
When filtering by a list of UUIDs in Drizzle, use `inArray(column, arrayOfIds)` — never use raw sql template interpolation like `sql\`column = ANY(${ids}::uuid[])\``.

## Why
PostgreSQL's `$1::uuid[]` expects an array literal `{uuid1,uuid2}`. When you interpolate a JavaScript array into a Drizzle `sql` template, pg receives the raw JS `.toString()` representation (e.g., `"d9bba712-da78-4dbc-88c9-04f99ef3d2a1"`), which is not a valid array literal. This causes:
```
error: malformed array literal: "d9bba712-da78-4dbc-88c9-04f99ef3d2a1"
```
The bug only manifests at runtime (TypeScript compiles clean), and only surfaces on first login after RBAC seeding — making it easy to miss in unit tests.

## How to apply
- **Wrong**: `.where(sql\`${table.roleId} = ANY(${roleIds}::uuid[])\`)`
- **Right**: `.where(inArray(table.roleId, roleIds))`
- `inArray` is exported from `drizzle-orm`; import it at the top of the file alongside `eq`, `and`, etc.
- Applies to any column type, not just UUIDs.
