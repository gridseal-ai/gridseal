import type { StorageAdapter } from "@gridseal/core";
import { formatChainStats } from "../format.js";

export type StatsOptions = {
  readonly storage: StorageAdapter;
  readonly chainId: string;
};

export type StatsResult = {
  readonly success: boolean;
  readonly message: string;
};

/** Show statistics for a chain. */
export async function stats(options: StatsOptions): Promise<StatsResult> {
  const entries = await options.storage.getEntriesByChainId(options.chainId);

  if (entries.length === 0) {
    return { success: false, message: `No entries found for chain: ${options.chainId}` };
  }

  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return { success: true, message: formatChainStats(options.chainId, sorted) };
}
