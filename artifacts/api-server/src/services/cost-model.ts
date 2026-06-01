/**
 * Commission and slippage engine — Phase 4.
 *
 * Cost models are research-only tools. They model the estimated
 * transaction costs of simulated trades to produce more realistic
 * backtesting results. No real money is involved.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommissionType = "flat" | "percentage" | "maker_taker";
export type SlippageType = "fixed" | "percentage" | "volatility_based" | "volume_based";

export interface CostModelConfig {
  commissionType: CommissionType;
  commissionValue: number;
  makerFee: number;
  takerFee: number;
  slippageType: SlippageType;
  slippageValue: number;
}

/** Describes preset exchange profiles for convenience */
export const EXCHANGE_PROFILES: Record<string, CostModelConfig> = {
  binance_spot: {
    commissionType: "maker_taker",
    commissionValue: 0,
    makerFee: 0.001,
    takerFee: 0.001,
    slippageType: "percentage",
    slippageValue: 0.0005,
  },
  binance_futures: {
    commissionType: "maker_taker",
    commissionValue: 0,
    makerFee: 0.0002,
    takerFee: 0.0004,
    slippageType: "percentage",
    slippageValue: 0.0003,
  },
  forex_ecn: {
    commissionType: "flat",
    commissionValue: 3.5,
    makerFee: 0,
    takerFee: 0,
    slippageType: "fixed",
    slippageValue: 0.5,
  },
  stocks_us: {
    commissionType: "flat",
    commissionValue: 1.0,
    makerFee: 0,
    takerFee: 0,
    slippageType: "percentage",
    slippageValue: 0.001,
  },
  zero_cost: {
    commissionType: "percentage",
    commissionValue: 0,
    makerFee: 0,
    takerFee: 0,
    slippageType: "fixed",
    slippageValue: 0,
  },
};

/** Zero-cost model — Phase 3 backward-compatible default */
export const ZERO_COST_MODEL: CostModelConfig = EXCHANGE_PROFILES["zero_cost"]!;

// ---------------------------------------------------------------------------
// Commission calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the commission charged on one side of a trade.
 *
 * @param notionalValue - price × quantity
 * @param config - cost model configuration
 * @param isMaker - true if the order rests on the book (used for maker_taker type)
 */
export function calculateCommission(
  notionalValue: number,
  config: CostModelConfig,
  isMaker = false,
): number {
  switch (config.commissionType) {
    case "flat":
      return config.commissionValue;
    case "percentage":
      return notionalValue * config.commissionValue;
    case "maker_taker":
      return notionalValue * (isMaker ? config.makerFee : config.takerFee);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Slippage calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the slippage-adjusted execution price.
 * Slippage always worsens the fill:
 *   - BUY side: price increases (you pay more)
 *   - SELL side: price decreases (you receive less)
 *
 * @param rawPrice - the theoretical fill price (e.g. next candle open)
 * @param side - "BUY" or "SELL"
 * @param config - cost model configuration
 * @param recentVolatility - recent price std-dev (required for volatility_based)
 * @param orderSize - trade notional (required for volume_based)
 * @param candleVolume - candle volume (required for volume_based)
 */
export function applySlippage(
  rawPrice: number,
  side: "BUY" | "SELL",
  config: CostModelConfig,
  recentVolatility = 0,
  orderSize = 0,
  candleVolume = 1,
): { adjustedPrice: number; slippageAmount: number } {
  let slippageAmount = 0;

  switch (config.slippageType) {
    case "fixed":
      slippageAmount = config.slippageValue;
      break;
    case "percentage":
      slippageAmount = rawPrice * config.slippageValue;
      break;
    case "volatility_based":
      // slippage scales with recent price std-dev times the multiplier
      slippageAmount = recentVolatility * config.slippageValue;
      break;
    case "volume_based": {
      // participation rate: what fraction of candle volume we consume
      const participationRate = candleVolume > 0 ? orderSize / candleVolume : 0;
      slippageAmount = rawPrice * config.slippageValue * participationRate;
      break;
    }
    default:
      slippageAmount = 0;
  }

  const adjustedPrice =
    side === "BUY"
      ? rawPrice + slippageAmount
      : rawPrice - slippageAmount;

  return { adjustedPrice, slippageAmount };
}

// ---------------------------------------------------------------------------
// Net trade cost (combined entry + exit commission)
// ---------------------------------------------------------------------------

export interface TradeCostResult {
  /** Adjusted entry price after slippage */
  adjustedEntryPrice: number;
  /** Adjusted exit price after slippage */
  adjustedExitPrice: number;
  /** Total commission paid (entry + exit) */
  totalCommission: number;
  /** Total slippage impact in quote units */
  totalSlippage: number;
  /** Total cost impact (commission + slippage converted to P&L reduction) */
  totalCostImpact: number;
}

/**
 * Compute the full round-trip cost for a completed simulated trade.
 *
 * @param entryPrice - raw (pre-slippage) entry price
 * @param exitPrice - raw (pre-slippage) exit price
 * @param quantity - position size in base units
 * @param config - cost model to apply
 * @param recentVolatility - recent stdDev of close prices (for volatility_based slippage)
 * @param entryVolume - candle volume at entry (for volume_based slippage)
 * @param exitVolume - candle volume at exit (for volume_based slippage)
 */
export function computeRoundTripCost(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  config: CostModelConfig,
  recentVolatility = 0,
  entryVolume = 1,
  exitVolume = 1,
): TradeCostResult {
  const orderSize = entryPrice * quantity;

  const entry = applySlippage(entryPrice, "BUY", config, recentVolatility, orderSize, entryVolume);
  const exit = applySlippage(exitPrice, "SELL", config, recentVolatility, orderSize, exitVolume);

  const entryNotional = entry.adjustedPrice * quantity;
  const exitNotional = exit.adjustedPrice * quantity;

  const entryCommission = calculateCommission(entryNotional, config, false);
  const exitCommission = calculateCommission(exitNotional, config, false);

  const totalCommission = entryCommission + exitCommission;
  const totalSlippage = (entry.slippageAmount + exit.slippageAmount) * quantity;
  const totalCostImpact = totalCommission + totalSlippage;

  return {
    adjustedEntryPrice: entry.adjustedPrice,
    adjustedExitPrice: exit.adjustedPrice,
    totalCommission,
    totalSlippage,
    totalCostImpact,
  };
}
