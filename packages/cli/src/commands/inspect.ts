import type { StorageAdapter } from "@gridseal/core";
import { formatEntryDetail } from "../format.js";

export type InspectOptions = {
  readonly storage: StorageAdapter;
  readonly entryId: string;
  readonly json?: boolean | undefined;
};

export type InspectResult = {
  readonly success: boolean;
  readonly message: string;
};

/** Inspect a single entry by ID, showing all field details. */
export async function inspect(options: InspectOptions): Promise<InspectResult> {
  const result = await options.storage.getEntry(options.entryId);

  if (!result.ok) {
    return { success: false, message: `Entry not found: ${options.entryId}` };
  }

  if (options.json) {
    return { success: true, message: JSON.stringify(result.value, null, 2) };
  }

  return { success: true, message: formatEntryDetail(result.value) };
}
