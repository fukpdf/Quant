---
name: Dashboard Orval queryKey pattern
description: Orval-generated UseQueryOptions requires queryKey as a required field; workaround for dashboard hooks.
---

## The Problem

Orval v7 generates hooks where the `query` option has type `UseQueryOptions<T, E, TData, readonly unknown[]>`. React Query's `UseQueryOptions` type marks `queryKey` as required in this signature. So passing `{ query: { enabled: true } }` causes:

```
Property 'queryKey' is missing in type '{ enabled: boolean; }'
```

## The Fix

Cast the query object with `as any`:

```ts
useGetSomething(params, { query: { enabled: !!id, refetchInterval: 30000 } as any })
```

This is safe because:
- The actual `queryKey` is always provided at runtime by the generated `getGetSomethingQueryOptions()` function
- The `as any` only bypasses the compile-time structural check, not the runtime behavior
- Other type safety (return types, param shapes) is fully preserved

## Where This Applies

Every hook call that passes a `query` option object — `enabled`, `refetchInterval`, `staleTime`, etc.

**Why:** Orval's type generation doesn't re-export a `Partial<UseQueryOptions>` variant for the options object, making `queryKey` structurally required even though it's always injected internally.
