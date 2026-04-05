import type { StorageAdapter } from "@gridseal/core";
import { formatChainList, formatEntrySummary } from "../format.js";

export type ListOptions = {
  readonly storage: StorageAdapter;
  readonly chainId?: string | undefined;
  readonly limit?: number | undefined;
};

export type ListResult = {
  readonly success: boolean;
  readonly message: string;
};

/** List chains or entries within a chain. */
export async function list(options: ListOptions): Promise<ListResult> {
  if (options.chainId) {
    return listEntries(options.storage, options.chainId, options.limit);
  }
  return listChains(options.storage);
}

async function listChains(storage: StorageAdapter): Promise<ListResult> {
  const chainIds = await storage.listChainIds();

  if (chainIds.length === 0) {
    return { success: true, message: "No chains found." };
  }

  const chains: Array<{ chainId: string; entryCount: number }> = [];
  for (const chainId of chainIds) {
    const count = await storage.getChainLength(chainId);
    chains.push({ chainId, entryCount: count });
  }

  return { success: true, message: formatChainList(chains) };
}

async function listEntries(
  storage: StorageAdapter,
  chainId: string,
  limit?: number
): Promise<ListResult> {
  const entries = await storage.getEntriesByChainId(chainId);

  if (entries.length === 0) {
    return { success: false, message: `No entries found for chain: ${chainId}` };
  }

  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const displayed = limit !== undefined ? sorted.slice(0, limit) : sorted;
  const lines = displayed.map(formatEntrySummary);

  if (limit !== undefined && sorted.length > limit) {
    lines.push(`... and ${sorted.length - limit} more entries`);
  }

  return { success: true, message: lines.join("\n") };
}
