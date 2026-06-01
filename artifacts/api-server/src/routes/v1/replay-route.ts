import { Router } from "express";
import {
  startReplay,
  stopReplay,
  getReplayStatus,
  getReplaySpeeds,
} from "../../services/replay-engine";
import type { ReplaySpeed } from "../../services/stream-types";

const router = Router();

const VALID_SPEEDS: ReplaySpeed[] = [1, 5, 10, 100];

/**
 * POST /v1/replay/start — start a tick replay session.
 *
 * Body:
 *   symbol      (required) — market symbol to replay
 *   from        (required) — ISO start time
 *   to          (required) — ISO end time
 *   speed       (optional, default 1) — replay speed: 1 | 5 | 10 | 100
 *   streamTypes (optional) — default ["ticker"]
 */
router.post("/replay/start", async (req, res) => {
  try {
    const { symbol, from, to, speed = 1, streamTypes = ["ticker"] } = req.body as {
      symbol?: string;
      from?: string;
      to?: string;
      speed?: number;
      streamTypes?: string[];
    };

    if (!symbol) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "symbol is required" },
      });
    }
    if (!from || !to) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "from and to (ISO timestamps) are required" },
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid date format. Use ISO 8601." },
      });
    }
    if (fromDate >= toDate) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "from must be before to" },
      });
    }

    const replaySpeed = VALID_SPEEDS.includes(speed as ReplaySpeed) ? (speed as ReplaySpeed) : 1;

    const state = startReplay({
      symbol,
      fromTime: fromDate,
      toTime: toDate,
      speed: replaySpeed,
      streamTypes: streamTypes as ["ticker"],
    });

    res.status(202).json({ data: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start replay";
    req.log?.error({ err }, "POST /replay/start failed");
    res.status(400).json({ error: { code: "REPLAY_ERROR", message } });
  }
});

/**
 * POST /v1/replay/stop — stop the active replay session.
 */
router.post("/replay/stop", (_req, res) => {
  try {
    const result = stopReplay();
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to stop replay" } });
  }
});

/**
 * GET /v1/replay/status — get the current replay session state.
 */
router.get("/replay/status", (_req, res) => {
  const state = getReplayStatus();
  res.json({
    data: state ?? { status: "idle", ticksReplayed: 0 },
    availableSpeeds: getReplaySpeeds(),
  });
});

export default router;
