import { describe, it, expect } from "vitest";
import { createSqliteAdapter } from "../../src/storage/sqlite-adapter.js";
import {
  createChain,
  appendN,
  makeCertificate,
  makeProvenance,
} from "./storage-test-helpers.js";

describe("file-backed database", () => {
  it("persists data across adapter instances using the same file", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const dbPath = path.join(
      os.tmpdir(),
      `gridseal-test-${Date.now()}.db`
    );

    try {
      const adapter1 = createSqliteAdapter({ path: dbPath });
      const chain = createChain("chain-1");
      const { entries } = appendN(chain, 3);
      for (const entry of entries) {
        await adapter1.putEntry(entry);
      }
      await adapter1.putCertificate(makeCertificate("cert-1"));
      await adapter1.putProvenance(makeProvenance("prov-1"));

      const adapter2 = createSqliteAdapter({ path: dbPath });

      const chainEntries = await adapter2.getEntriesByChainId("chain-1");
      expect(chainEntries).toHaveLength(3);

      const certResult = await adapter2.getCertificate("cert-1");
      expect(certResult.ok).toBe(true);

      const provResult = await adapter2.getProvenance("prov-1");
      expect(provResult.ok).toBe(true);
    } finally {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(`${dbPath}-wal`, { force: true });
      fs.rmSync(`${dbPath}-shm`, { force: true });
    }
  });
});
