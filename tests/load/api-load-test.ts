/**
 * api-load-test.ts — QuantForge API Load Testing Suite
 *
 * Uses fetch-based concurrent request batching to measure API throughput,
 * latency distribution, and error rates under various load profiles.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 API_TOKEN=<jwt> pnpm tsx tests/load/api-load-test.ts
 *
 * Or with specific profile:
 *   LOAD_PROFILE=stress pnpm tsx tests/load/api-load-test.ts
 *
 * Profiles:
 *   smoke     — 5 VUs, 10s (quick sanity check)
 *   load      — 50 VUs, 60s (normal load)
 *   stress    — 200 VUs, 120s (stress test)
 *   spike     — ramp 0→500→0 VUs over 60s (spike test)
 */

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3000";
const API_TOKEN = process.env["API_TOKEN"] ?? "";
const PROFILE = process.env["LOAD_PROFILE"] ?? "smoke";

// ---------------------------------------------------------------------------
// Load profiles
// ---------------------------------------------------------------------------

interface LoadProfile {
  virtualUsers: number;
  durationMs: number;
  rampUpMs: number;
  description: string;
}

const PROFILES: Record<string, LoadProfile> = {
  smoke: { virtualUsers: 5, durationMs: 10_000, rampUpMs: 1_000, description: "Smoke test — 5 VUs / 10s" },
  load: { virtualUsers: 50, durationMs: 60_000, rampUpMs: 10_000, description: "Load test — 50 VUs / 60s" },
  stress: { virtualUsers: 200, durationMs: 120_000, rampUpMs: 20_000, description: "Stress test — 200 VUs / 120s" },
  spike: { virtualUsers: 500, durationMs: 60_000, rampUpMs: 5_000, description: "Spike test — 500 VUs / 60s (aggressive ramp)" },
};

// ---------------------------------------------------------------------------
// Test scenarios
// ---------------------------------------------------------------------------

interface Scenario {
  name: string;
  weight: number; // relative frequency weight
  execute: () => Promise<Response>;
}

const scenarios: Scenario[] = [
  {
    name: "GET /healthz",
    weight: 10,
    execute: () => fetch(`${BASE_URL}/healthz`),
  },
  {
    name: "GET /health/live",
    weight: 10,
    execute: () => fetch(`${BASE_URL}/health/live`),
  },
  {
    name: "GET /health/ready",
    weight: 5,
    execute: () => fetch(`${BASE_URL}/health/ready`),
  },
  {
    name: "GET /api/v1/markets",
    weight: 20,
    execute: () => fetch(`${BASE_URL}/api/v1/markets`, {
      headers: authHeaders(),
    }),
  },
  {
    name: "GET /api/v1/candles",
    weight: 20,
    execute: () => fetch(`${BASE_URL}/api/v1/candles?symbol=BTCUSDT&interval=1h&limit=100`, {
      headers: authHeaders(),
    }),
  },
  {
    name: "GET /api/v1/latest-price",
    weight: 15,
    execute: () => fetch(`${BASE_URL}/api/v1/latest-price?symbol=BTCUSDT`, {
      headers: authHeaders(),
    }),
  },
  {
    name: "GET /api/v1/ops/overview",
    weight: 10,
    execute: () => fetch(`${BASE_URL}/api/v1/ops/overview`, {
      headers: authHeaders(),
    }),
  },
  {
    name: "GET /api/v1/ops/profiling",
    weight: 5,
    execute: () => fetch(`${BASE_URL}/api/v1/ops/profiling`, {
      headers: authHeaders(),
    }),
  },
  {
    name: "GET /api/v1/billing/plans",
    weight: 5,
    execute: () => fetch(`${BASE_URL}/api/v1/billing/plans`, {
      headers: authHeaders(),
    }),
  },
];

// Build weighted scenario picker
const weightedScenarios: Scenario[] = [];
for (const scenario of scenarios) {
  for (let i = 0; i < scenario.weight; i++) {
    weightedScenarios.push(scenario);
  }
}

function pickScenario(): Scenario {
  const idx = Math.floor(Math.random() * weightedScenarios.length);
  return weightedScenarios[idx]!;
}

function authHeaders(): Record<string, string> {
  return API_TOKEN ? { "Authorization": `Bearer ${API_TOKEN}` } : {};
}

// ---------------------------------------------------------------------------
// Metrics collection
// ---------------------------------------------------------------------------

interface RequestResult {
  scenario: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

const results: RequestResult[] = [];

async function executeRequest(scenario: Scenario): Promise<RequestResult> {
  const start = Date.now();
  try {
    const response = await scenario.execute();
    await response.text(); // Drain body
    return {
      scenario: scenario.name,
      statusCode: response.status,
      durationMs: Date.now() - start,
      success: response.ok || response.status === 401, // 401 expected without auth
    };
  } catch (err) {
    return {
      scenario: scenario.name,
      statusCode: 0,
      durationMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Virtual user
// ---------------------------------------------------------------------------

async function virtualUser(durationMs: number, rampDelayMs: number): Promise<void> {
  await sleep(rampDelayMs);
  const endTime = Date.now() + durationMs;
  while (Date.now() < endTime) {
    const scenario = pickScenario();
    const result = await executeRequest(scenario);
    results.push(result);
    // Think time: 100–500ms between requests
    await sleep(100 + Math.random() * 400);
  }
}

// ---------------------------------------------------------------------------
// Load runner
// ---------------------------------------------------------------------------

async function runLoadTest(): Promise<void> {
  const profile = PROFILES[PROFILE] ?? PROFILES["smoke"]!;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`QuantForge Load Test — ${profile.description}`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`${"=".repeat(60)}\n`);

  const startTime = Date.now();

  // Spawn virtual users with staggered ramp-up
  const userPromises = Array.from({ length: profile.virtualUsers }, (_, i) => {
    const rampDelay = Math.floor((i / profile.virtualUsers) * profile.rampUpMs);
    return virtualUser(profile.durationMs, rampDelay);
  });

  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const successRate = results.length > 0
      ? Math.round((results.filter(r => r.success).length / results.length) * 100)
      : 0;
    process.stdout.write(`\r  Elapsed: ${elapsed}s | Requests: ${results.length} | Success rate: ${successRate}%   `);
  }, 1000);

  await Promise.allSettled(userPromises);
  clearInterval(progressInterval);

  console.log("\n");
  printReport(profile, Date.now() - startTime);
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function printReport(profile: LoadProfile, totalDurationMs: number): void {
  const totalRequests = results.length;
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const throughput = Math.round((totalRequests / totalDurationMs) * 1000);

  const durations = results.map(r => r.durationMs).sort((a, b) => a - b);
  const p50 = percentile(durations, 0.50);
  const p95 = percentile(durations, 0.95);
  const p99 = percentile(durations, 0.99);
  const avg = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const max = durations[durations.length - 1] ?? 0;

  console.log(`${"=".repeat(60)}`);
  console.log("LOAD TEST RESULTS");
  console.log(`${"=".repeat(60)}`);
  console.log(`Profile:         ${profile.description}`);
  console.log(`Total duration:  ${Math.round(totalDurationMs / 1000)}s`);
  console.log(`Total requests:  ${totalRequests}`);
  console.log(`Throughput:      ${throughput} req/s`);
  console.log(`Success rate:    ${totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0}% (${successfulRequests}/${totalRequests})`);
  console.log(`Failed:          ${failedRequests}`);
  console.log("");
  console.log("LATENCY (ms)");
  console.log(`  Avg:  ${avg}ms`);
  console.log(`  p50:  ${p50}ms`);
  console.log(`  p95:  ${p95}ms`);
  console.log(`  p99:  ${p99}ms`);
  console.log(`  Max:  ${max}ms`);
  console.log("");
  console.log("BY SCENARIO");

  // Group by scenario
  const byScenario = new Map<string, RequestResult[]>();
  for (const result of results) {
    const existing = byScenario.get(result.scenario) ?? [];
    existing.push(result);
    byScenario.set(result.scenario, existing);
  }

  for (const [name, scenarioResults] of byScenario.entries()) {
    const scenarioDurations = scenarioResults.map(r => r.durationMs).sort((a, b) => a - b);
    const scenarioP95 = percentile(scenarioDurations, 0.95);
    const scenarioSuccessRate = Math.round((scenarioResults.filter(r => r.success).length / scenarioResults.length) * 100);
    console.log(`  ${name.padEnd(35)} n=${String(scenarioResults.length).padStart(5)}  p95=${String(scenarioP95).padStart(5)}ms  ok=${scenarioSuccessRate}%`);
  }

  console.log(`${"=".repeat(60)}\n`);

  // Thresholds
  console.log("THRESHOLD EVALUATION");
  const p95Threshold = 500; // 500ms p95
  const p99Threshold = 2000; // 2s p99
  const successThreshold = 95; // 95% success rate
  const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0;

  const p95Pass = p95 <= p95Threshold;
  const p99Pass = p99 <= p99Threshold;
  const successPass = successRate >= successThreshold;

  console.log(`  p95 <= ${p95Threshold}ms:    ${p95Pass ? "✓ PASS" : "✗ FAIL"} (${p95}ms)`);
  console.log(`  p99 <= ${p99Threshold}ms:  ${p99Pass ? "✓ PASS" : "✗ FAIL"} (${p99}ms)`);
  console.log(`  Success >= ${successThreshold}%: ${successPass ? "✓ PASS" : "✗ FAIL"} (${successRate}%)`);
  console.log(`  Overall: ${p95Pass && p99Pass && successPass ? "✓ ALL THRESHOLDS MET" : "✗ SOME THRESHOLDS FAILED"}`);
  console.log(`${"=".repeat(60)}\n`);
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.floor(sortedArr.length * p);
  return sortedArr[Math.min(idx, sortedArr.length - 1)] ?? 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

runLoadTest().catch(err => {
  console.error("Load test failed:", err);
  process.exit(1);
});
