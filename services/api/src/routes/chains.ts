import { Hono } from "hono";
import type { StorageAdapter } from "@gridseal/core";
import {
  createChain,
  appendEntry,
  validateChain,
  validateSubtree,
  validateEntry,
  getSubtree,
} from "@gridseal/core";
import type { AppendEntryInput } from "@gridseal/core";
import { appendEntrySchema, entryListSchema } from "../validation/schemas.js";
import { parseBody, parseQuery } from "../middleware/validate.js";
import type { StorageResolver } from "../app.js";

/** Build a ChainState from storage for validation and chain operations. */
async function loadChainState(storage: StorageAdapter, chainId: string) {
  const entries = await storage.getEntriesByChainId(chainId);
  return { chainId, entries: [...entries] };
}

export function createChainRoutes(resolveStorage: StorageResolver): Hono {
  const app = new Hono();

  /** List all chain IDs with their entry counts. */
  app.get("/", async (c) => {
    const storage = resolveStorage(c);
    const chainIds = await storage.listChainIds();
    const chains = await Promise.all(
      chainIds.map(async (chainId) => {
        const length = await storage.getChainLength(chainId);
        return { chainId, entryCount: length };
      })
    );
    return c.json({ chains });
  });

  /** Get chain metadata including entry count. */
  app.get("/:chainId", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const length = await storage.getChainLength(chainId);
    if (length === 0) {
      return c.json({ error: `Chain not found: ${chainId}` }, 404);
    }
    return c.json({ chainId, entryCount: length });
  });

  /** Get paginated entries for a chain with optional filters. */
  app.get("/:chainId/entries", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const parsed = parseQuery(c, entryListSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { offset, limit, startDate, endDate, modelId, actorId, sessionId } =
      parsed.value as {
        offset: number;
        limit: number;
        startDate?: string;
        endDate?: string;
        modelId?: string;
        actorId?: string;
        sessionId?: string;
      };
    const allEntries = await storage.getEntriesByChainId(chainId);
    if (allEntries.length === 0) {
      return c.json({ error: `Chain not found: ${chainId}` }, 404);
    }

    let filtered = [...allEntries];

    if (startDate !== undefined) {
      filtered = filtered.filter((e) => e.timestamp >= startDate);
    }
    if (endDate !== undefined) {
      filtered = filtered.filter((e) => e.timestamp <= endDate);
    }
    if (modelId !== undefined) {
      filtered = filtered.filter((e) => e.modelId === modelId);
    }
    if (actorId !== undefined) {
      filtered = filtered.filter((e) => e.actorId === actorId);
    }
    if (sessionId !== undefined) {
      filtered = filtered.filter((e) => e.sessionId === sessionId);
    }

    const paginated = filtered.slice(offset, offset + limit);
    return c.json({
      chainId,
      entries: paginated,
      total: filtered.length,
      offset,
      limit,
    });
  });

  /** Get a single entry by ID within a chain. */
  app.get("/:chainId/entries/:entryId", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const entryId = c.req.param("entryId");
    const result = await storage.getEntry(entryId);
    if (!result.ok) {
      return c.json({ error: `Entry not found: ${entryId}` }, 404);
    }
    if (result.value.chainId !== chainId) {
      return c.json({ error: `Entry ${entryId} does not belong to chain ${chainId}` }, 404);
    }
    return c.json({ entry: result.value });
  });

  /** Append an entry to a chain. Creates the chain if it does not exist. */
  app.post("/:chainId/entries", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const parsed = await parseBody(c, appendEntrySchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const body = parsed.value;

    const chainState = await loadChainState(storage, chainId);
    const chain =
      chainState.entries.length > 0 ? chainState : createChain(chainId);

    const { entryId, timestamp, entryType, ...optional } = body;
    const input: AppendEntryInput = { entryId, timestamp, entryType };
    for (const [key, value] of Object.entries(optional)) {
      if (value !== undefined) {
        (input as Record<string, unknown>)[key] = value;
      }
    }

    const appendResult = appendEntry(chain, input);
    if (!appendResult.ok) {
      return c.json(
        { error: `Failed to append entry: ${appendResult.error.type}`, details: appendResult.error },
        409
      );
    }

    const storeResult = await storage.putEntry(appendResult.value.entry);
    if (!storeResult.ok) {
      return c.json(
        { error: `Failed to store entry: ${storeResult.error.type}`, details: storeResult.error },
        409
      );
    }

    return c.json({ entry: appendResult.value.entry }, 201);
  });

  /** Validate the entire chain. */
  app.post("/:chainId/validate", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const chainState = await loadChainState(storage, chainId);
    if (chainState.entries.length === 0) {
      return c.json({ error: `Chain not found: ${chainId}` }, 404);
    }
    const result = validateChain(chainState);
    if (result.ok) {
      return c.json({
        valid: true,
        chainId,
        entryCount: chainState.entries.length,
      });
    }
    return c.json({
      valid: false,
      chainId,
      entryCount: chainState.entries.length,
      error: result.error,
    });
  });

  /** Get children of a specific entry. */
  app.get("/:chainId/entries/:entryId/children", async (c) => {
    const storage = resolveStorage(c);
    const entryId = c.req.param("entryId");
    const children = await storage.getEntriesByParentId(entryId);
    return c.json({ parentEntryId: entryId, children });
  });

  /** Get subtree rooted at a specific entry. */
  app.get("/:chainId/entries/:entryId/subtree", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const entryId = c.req.param("entryId");
    const chainState = await loadChainState(storage, chainId);
    if (chainState.entries.length === 0) {
      return c.json({ error: `Chain not found: ${chainId}` }, 404);
    }

    const entryResult = await storage.getEntry(entryId);
    if (!entryResult.ok) {
      return c.json({ error: `Entry not found: ${entryId}` }, 404);
    }

    const subtree = getSubtree(chainState, entryId);
    return c.json({ rootEntryId: entryId, entries: subtree });
  });

  /** Validate a single entry's hash integrity. */
  app.post("/:chainId/entries/:entryId/validate", async (c) => {
    const storage = resolveStorage(c);
    const entryId = c.req.param("entryId");
    const entryResult = await storage.getEntry(entryId);
    if (!entryResult.ok) {
      return c.json({ error: `Entry not found: ${entryId}` }, 404);
    }

    const entry = entryResult.value;
    const chainId = c.req.param("chainId");
    if (entry.chainId !== chainId) {
      return c.json({ error: `Entry ${entryId} does not belong to chain ${chainId}` }, 404);
    }

    const result = validateEntry(entry);
    if (result.ok) {
      return c.json({ valid: true, entryId });
    }
    return c.json({ valid: false, entryId, error: result.error });
  });

  /** Validate a subtree. */
  app.post("/:chainId/subtree/:entryId/validate", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const entryId = c.req.param("entryId");
    const chainState = await loadChainState(storage, chainId);
    if (chainState.entries.length === 0) {
      return c.json({ error: `Chain not found: ${chainId}` }, 404);
    }

    const result = validateSubtree(chainState, entryId);
    if (result.ok) {
      return c.json({ valid: true, chainId, rootEntryId: entryId });
    }
    return c.json({
      valid: false,
      chainId,
      rootEntryId: entryId,
      error: result.error,
    });
  });

  return app;
}
