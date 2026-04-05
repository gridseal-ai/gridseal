/**
 * Tenant-scoped SQLite storage adapter.
 * All queries are filtered by tenant_id for multi-tenant isolation.
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import Database from "better-sqlite3";
import type { StorageAdapter } from "@gridseal/core";
import { ok, err } from "@gridseal/core";
import type { ReasoningCertificate, ModelProvenance } from "@gridseal/core";
import { sqliteEntries, sqliteCertificates, sqliteProvenance } from "./schema.js";
import { entryToRow, rowToEntry } from "./row-helpers.js";

import { CREATE_TABLES_SQL } from "./sqlite-schema-sql.js";

type SqliteDb = ReturnType<typeof drizzle>;

/** Shared database handle that supports creating tenant-scoped adapters. */
export type TenantSqliteHandle = {
  /** Create a StorageAdapter scoped to a specific tenant. */
  readonly forTenant: (tenantId: string) => StorageAdapter;
  /** Close the underlying database connection. */
  readonly close: () => void;
};

/** Create a multi-tenant SQLite database handle. */
export function createTenantSqliteAdapter(
  dbPath?: string | undefined,
): TenantSqliteHandle {
  const sqlite = new Database(dbPath ?? ":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(CREATE_TABLES_SQL);

  const db: SqliteDb = drizzle(sqlite);

  function forTenant(tenantId: string): StorageAdapter {
    return {
      putEntry: async (entry) => {
        const existing = db
          .select()
          .from(sqliteEntries)
          .where(eq(sqliteEntries.entryId, entry.entryId))
          .get();
        if (existing) {
          return err({ type: "DUPLICATE_ENTRY" as const, entryId: entry.entryId });
        }
        db.insert(sqliteEntries).values(entryToRow(entry, tenantId)).run();
        return ok(entry);
      },

      getEntry: async (entryId) => {
        const row = db
          .select()
          .from(sqliteEntries)
          .where(
            and(
              eq(sqliteEntries.entryId, entryId),
              eq(sqliteEntries.tenantId, tenantId),
            ),
          )
          .get();
        if (!row) {
          return err({ type: "ENTRY_NOT_FOUND" as const, entryId });
        }
        return ok(rowToEntry(row as unknown as Record<string, unknown>));
      },

      getEntriesByChainId: async (chainId) => {
        const rows = db
          .select()
          .from(sqliteEntries)
          .where(
            and(
              eq(sqliteEntries.chainId, chainId),
              eq(sqliteEntries.tenantId, tenantId),
            ),
          )
          .orderBy(sqliteEntries.sequenceNumber)
          .all();
        return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
      },

      getEntriesBySequenceRange: async (chainId, startSequence, endSequence) => {
        const rows = db
          .select()
          .from(sqliteEntries)
          .where(
            and(
              eq(sqliteEntries.chainId, chainId),
              eq(sqliteEntries.tenantId, tenantId),
              gte(sqliteEntries.sequenceNumber, startSequence),
              lte(sqliteEntries.sequenceNumber, endSequence),
            ),
          )
          .orderBy(sqliteEntries.sequenceNumber)
          .all();
        return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
      },

      getEntriesByParentId: async (parentEntryId) => {
        const rows = db
          .select()
          .from(sqliteEntries)
          .where(
            and(
              eq(sqliteEntries.parentEntryId, parentEntryId),
              eq(sqliteEntries.tenantId, tenantId),
            ),
          )
          .orderBy(sqliteEntries.sequenceNumber)
          .all();
        return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
      },

      putCertificate: async (certificate) => {
        const existing = db
          .select()
          .from(sqliteCertificates)
          .where(eq(sqliteCertificates.certificateId, certificate.certificateId))
          .get();
        if (existing) {
          return err({
            type: "DUPLICATE_CERTIFICATE" as const,
            certificateId: certificate.certificateId,
          });
        }
        db.insert(sqliteCertificates)
          .values({
            certificateId: certificate.certificateId,
            tenantId,
            timestamp: certificate.timestamp,
            modelId: certificate.modelId,
            modelProvider: certificate.modelProvider,
            certificateHash: certificate.certificateHash,
            data: JSON.stringify(certificate),
          })
          .run();
        return ok(certificate);
      },

      getCertificate: async (certificateId) => {
        const row = db
          .select()
          .from(sqliteCertificates)
          .where(
            and(
              eq(sqliteCertificates.certificateId, certificateId),
              eq(sqliteCertificates.tenantId, tenantId),
            ),
          )
          .get();
        if (!row) {
          return err({ type: "CERTIFICATE_NOT_FOUND" as const, certificateId });
        }
        return ok(JSON.parse(row.data) as ReasoningCertificate);
      },

      putProvenance: async (provenance) => {
        const existing = db
          .select()
          .from(sqliteProvenance)
          .where(eq(sqliteProvenance.provenanceId, provenance.provenanceId))
          .get();
        if (existing) {
          return err({
            type: "DUPLICATE_PROVENANCE" as const,
            provenanceId: provenance.provenanceId,
          });
        }
        db.insert(sqliteProvenance)
          .values({
            provenanceId: provenance.provenanceId,
            tenantId,
            timestamp: provenance.timestamp,
            modelName: provenance.modelName,
            modelVersion: provenance.modelVersion,
            modelProvider: provenance.modelProvider,
            provenanceHash: provenance.provenanceHash,
            data: JSON.stringify(provenance),
          })
          .run();
        return ok(provenance);
      },

      getProvenance: async (provenanceId) => {
        const row = db
          .select()
          .from(sqliteProvenance)
          .where(
            and(
              eq(sqliteProvenance.provenanceId, provenanceId),
              eq(sqliteProvenance.tenantId, tenantId),
            ),
          )
          .get();
        if (!row) {
          return err({ type: "PROVENANCE_NOT_FOUND" as const, provenanceId });
        }
        return ok(JSON.parse(row.data) as ModelProvenance);
      },

      getChainLength: async (chainId) => {
        const result = db
          .select({ count: sql<number>`count(*)` })
          .from(sqliteEntries)
          .where(
            and(
              eq(sqliteEntries.chainId, chainId),
              eq(sqliteEntries.tenantId, tenantId),
            ),
          )
          .get();
        return result?.count ?? 0;
      },

      listChainIds: async () => {
        const rows = db
          .selectDistinct({ chainId: sqliteEntries.chainId })
          .from(sqliteEntries)
          .where(eq(sqliteEntries.tenantId, tenantId))
          .all();
        return rows.map((r) => r.chainId);
      },

      clear: async () => {
        db.delete(sqliteEntries)
          .where(eq(sqliteEntries.tenantId, tenantId))
          .run();
        db.delete(sqliteCertificates)
          .where(eq(sqliteCertificates.tenantId, tenantId))
          .run();
        db.delete(sqliteProvenance)
          .where(eq(sqliteProvenance.tenantId, tenantId))
          .run();
      },
    };
  }

  return {
    forTenant,
    close: () => sqlite.close(),
  };
}
