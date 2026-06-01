import type { IStreamProvider, RawStreamEvent, StreamType } from "../stream-types";

/**
 * ForexStreamProvider — stub for future forex data provider integration.
 * Implements IStreamProvider interface but throws NotImplemented on connect.
 *
 * FUTURE: Connect to OANDA, Interactive Brokers, or similar.
 */
export class ForexStreamProvider implements IStreamProvider {
  readonly name = "forex" as const;

  async connect(_symbols: string[], _streamTypes: StreamType[], _sessionId: string): Promise<void> {
    throw new Error("ForexStreamProvider: not implemented. Future phase.");
  }

  async disconnect(): Promise<void> {}
  async subscribe(_symbol: string, _streamTypes: StreamType[]): Promise<void> {
    throw new Error("ForexStreamProvider: not implemented.");
  }
  async unsubscribe(_symbol: string): Promise<void> {}
  isConnected(): boolean { return false; }
  onEvent(_handler: (event: RawStreamEvent) => void): void {}
  onError(_handler: (error: Error) => void): void {}
  onDisconnect(_handler: (reason: string) => void): void {}
  getSubscribedSymbols(): string[] { return []; }
}
