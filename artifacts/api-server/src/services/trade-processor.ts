import { logger } from "../lib/logger";
import { insertMarketTrade } from "./stream-db";
import type { RawTradeEvent } from "./stream-types";

export async function processTradeEvent(
  event: RawTradeEvent,
  sessionId: string,
): Promise<void> {
  const quoteQty = event.quoteQuantity
    ?? String(parseFloat(event.price) * parseFloat(event.quantity));

  try {
    await insertMarketTrade({
      symbol: event.symbol,
      provider: event.provider,
      tradeId: event.tradeId ?? null,
      price: event.price,
      quantity: event.quantity,
      quoteQuantity: quoteQty,
      isBuyerMaker: event.isBuyerMaker ?? null,
      exchangeTimestamp: event.exchangeTimestamp ?? null,
      sessionId,
    });
  } catch (err) {
    logger.error({ err, symbol: event.symbol }, "Trade processor: DB insert failed");
  }
}
