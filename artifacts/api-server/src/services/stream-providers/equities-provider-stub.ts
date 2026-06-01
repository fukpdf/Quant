import type { IStreamProvider, RawStreamEvent, StreamType } from "../stream-types";

/**
 * EquitiesStreamProvider — stub for future equities data provider integration.
 * FUTURE: Connect to Polygon.io, Alpaca, or similar.
 */
export class EquitiesStreamProvider implements IStreamProvider {
  readonly name = "equities" as const;

  async connect(_symbols: string[], _streamTypes: StreamType[], _sessionId: string): Promise<void> {
    throw new Error("EquitiesStreamProvider: not implemented. Future phase.");
  }

  async disconnect(): Promise<void> {}
  async subscribe(_symbol: string, _streamTypes: StreamType[]): Promise<void> {
    throw new Error("EquitiesStreamProvider: not implemented.");
  }
  async unsubscribe(_symbol: string): Promise<void> {}
  isConnected(): boolean { return false; }
  onEvent(_handler: (event: RawStreamEvent) => void): void {}
  onError(_handler: (error: Error) => void): void {}
  onDisconnect(_handler: (reason: string) => void): void {}
  getSubscribedSymbols(): string[] { return []; }
}
