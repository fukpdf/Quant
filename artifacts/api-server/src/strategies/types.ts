/**
 * Core types for the QuantForge strategy framework.
 * Strategies are pure research/simulation tools — no live execution.
 */

// ---------------------------------------------------------------------------
// Candle (input data unit)
// ---------------------------------------------------------------------------

export interface OhlcvCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export type Signal = "BUY" | "SELL" | "HOLD";

// ---------------------------------------------------------------------------
// Strategy context passed to generateSignal on each candle
// ---------------------------------------------------------------------------

export interface StrategyContext {
  /** All candles from the start of the window up to and including the current one (no look-ahead) */
  candles: OhlcvCandle[];
  /** Zero-based index of the current candle in the full candles array */
  currentIndex: number;
  /** The candle being evaluated right now */
  currentCandle: OhlcvCandle;
  /** Whether a long position is currently open */
  inPosition: boolean;
}

// ---------------------------------------------------------------------------
// Parameter schema (for documentation and UI)
// ---------------------------------------------------------------------------

export type ParameterType = "integer" | "float" | "boolean";

export interface ParameterDef {
  type: ParameterType;
  default: number | boolean;
  min?: number;
  max?: number;
  description: string;
}

export type ParameterSchema = Record<string, ParameterDef>;

export type StrategyParams = Record<string, number | boolean>;

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

export interface IStrategy {
  /** Unique machine-readable identifier */
  readonly name: string;
  /** Human-readable display name */
  readonly displayName: string;
  /** Short description */
  readonly description: string;
  /** Declares accepted parameters and their defaults */
  readonly parameterSchema: ParameterSchema;

  /** Called once before the replay loop begins */
  initialize(params: StrategyParams): void;

  /** Called at the start of the replay (after initialize, before first candle) */
  onStart(): void;

  /** Called on every candle — must return a signal without reading future candles */
  generateSignal(ctx: StrategyContext): Signal;

  /** Called after the last candle has been processed */
  onFinish(): void;
}

// ---------------------------------------------------------------------------
// Backtest input / output
// ---------------------------------------------------------------------------

export interface BacktestInput {
  candles: OhlcvCandle[];
  strategy: IStrategy;
  params: StrategyParams;
  /** Starting capital in base-currency units */
  initialCapital: number;
}

export interface SimulatedTrade {
  side: "BUY" | "SELL";
  entryTime: Date;
  exitTime: Date | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  pnl: number | null;
  pnlPct: number | null;
  entrySignal: string;
  exitSignal: string | null;
  candleIndexEntry: number;
  candleIndexExit: number | null;
}

export interface EquityCurvePoint {
  timestamp: Date;
  equity: number;
}

export interface BacktestOutput {
  trades: SimulatedTrade[];
  equityCurve: EquityCurvePoint[];
  candlesProcessed: number;
}
