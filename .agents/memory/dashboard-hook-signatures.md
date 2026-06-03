---
name: Dashboard hook signatures
description: Non-obvious argument shapes for @workspace/api-client-react hooks used in the dashboard.
---

## Hooks that take plain `string` (not object) for accountId

```ts
useGetPortfolioHealth(accountId: string, options?)
useGetPortfolioAnalytics(accountId: string, options?)
useGetRecommendations(accountId: string, params?, options?)
```

NOT `{ accountId }` — pass the raw string.

## Hooks with 3 args (service, params, options)

```ts
useGetServiceHealthHistory(service: string, params?, options?)
```

## Ops overview is nested

`useGetOpsOverview()` returns `GetOpsOverview200 = { data?: OpsOverview }`.
Access fields as: `overview?.data?.platformScore`, `overview?.data?.activeAlerts`, etc.

## Live metrics is untyped

`useGetLiveSystemMetrics()` returns `{ data: { [key: string]: unknown } }`.
Cast `metrics?.data as Record<string, unknown>` and extract fields manually.

## ListAlertEvents second arg is options

```ts
useListAlertEvents(params?, options?)
// NOT: useListAlertEvents({ query: { refetchInterval } }) — that puts query in params!
// YES: useListAlertEvents(undefined, { query: { refetchInterval } as any })
```

## UpdateAlertRule uses `name` not `id`

```ts
updateRule.mutate({ name: r.name, data: { isEnabled: !r.isEnabled } })
```

## GetAiUsageSummary is wrapped

`useGetAiUsageSummary()` returns `GetAiUsageSummary200 = { data: AiUsageSummary }`.
Access as: `usage?.data?.totalTokens`, `usage?.data?.totalRequests`.

## ResolveIncidentBody has `resolution` not `summary`

```ts
resInc.mutate({ id, data: { resolution: "..." } })
```

## KillSwitchStatus nesting

`useGetKillSwitchStatus()` returns `{ status: KillSwitchStatus, recentEvents }`.
Fields: `killSwitch?.status?.tradingHalted`, `killSwitch?.status?.schedulerPaused`.

## ExecutionHealth is wrapped

`useGetExecutionHealth({ window })` returns `{ data?: ExecutionHealthRecord }`.
Fields are numeric strings: `health?.data?.fillRate` (parse with `parseFloat`).

## ExecutionOrder enum values are lowercase

`ExecutionOrderSide`: `"buy"` | `"sell"` (NOT "BUY"/"SELL")
`ExecutionOrderStatus`: `"filled"` | `"rejected"` | `"pending"` | etc. (all lowercase)

## SchedulerHealthRecord has `schedulerName` not `name`

```ts
s.schedulerName  // correct
s.name           // does not exist → TS error
```

## ServiceHealthRecord has `service` not `name`

```ts
s.service  // the service name string
s.name     // does not exist → TS error
```
