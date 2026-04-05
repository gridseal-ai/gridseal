/**
 * SQLite-backed StorageAdapter using Drizzle ORM.
 * Used for tests and local development.
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import Database from "better-sqlite3";
import type { StorageAdapter } from "@gridseal/core";
import { ok, err } from "@gridseal/core";
import type { ProofChainEntry, ReasoningCertificate, ModelProvenance } from "@gridseal/core";
import { sqliteEntries, sqliteCertificates, sqliteProvenance } from "./schema.js";

type SqliteDb = ReturnType<typeof drizzle>;

function entryToRow(entry: ProofChainEntry) {
  return {
    entryId: entry.entryId,
    chainId: entry.chainId,
    sequenceNumber: entry.sequenceNumber,
    timestamp: entry.timestamp,
    entryType: entry.entryType,
    previousHash: entry.previousHash,
    entryHash: entry.entryHash,
    parentEntryId: entry.parentEntryId,
    modelId: entry.modelId,
    modelProvider: entry.modelProvider,
    inputHash: entry.inputHash,
    outputHash: entry.outputHash,
    inputTokenCount: entry.inputTokenCount,
    outputTokenCount: entry.outputTokenCount,
    decisionType: entry.decisionType,
    confidenceScore: entry.confidenceScore,
    reasoningCertificateId: entry.reasoningCertificateId,
    provenanceId: entry.provenanceId,
    sessionId: entry.sessionId,
    actorId: entry.actorId,
    policyIds: JSON.stringify(entry.policyIds),
    tags: JSON.stringify(entry.tags),
    annotation: entry.annotation,
    complianceMetadata: JSON.stringify(entry.complianceMetadata),
  };
}

function rowToEntry(row: Record<string, unknown>): ProofChainEntry {
  return {
    entryId: row["entryId"] as string,
    chainId: row["chainId"] as string,
    sequenceNumber: row["sequenceNumber"] as number,
    timestamp: row["timestamp"] as string,
    entryType: row["entryType"] as ProofChainEntry["entryType"],
    previousHash: (row["previousHash"] as string | null) ?? null,
    entryHash: row["entryHash"] as string,
    parentEntryId: (row["parentEntryId"] as string | null) ?? null,
    modelId: (row["modelId"] as string | null) ?? null,
    modelProvider: (row["modelProvider"] as string | null) ?? null,
    inputHash: (row["inputHash"] as string | null) ?? null,
    outputHash: (row["outputHash"] as string | null) ?? null,
    inputTokenCount: (row["inputTokenCount"] as number | null) ?? null,
    outputTokenCount: (row["outputTokenCount"] as number | null) ?? null,
    decisionType: (row["decisionType"] as ProofChainEntry["decisionType"]) ?? null,
    confidenceScore: (row["confidenceScore"] as number | null) ?? null,
    reasoningCertificateId: (row["reasoningCertificateId"] as string | null) ?? null,
    provenanceId: (row["provenanceId"] as string | null) ?? null,
    sessionId: (row["sessionId"] as string | null) ?? null,
    actorId: (row["actorId"] as string | null) ?? null,
    policyIds: JSON.parse((row["policyIds"] as string) ?? "[]") as ReadonlyArray<string>,
    tags: JSON.parse((row["tags"] as string) ?? "{}") as Readonly<Record<string, string>>,
    annotation: (row["annotation"] as string | null) ?? null,
    complianceMetadata: JSON.parse((row["complianceMetadata"] as string) ?? "{}") as Readonly<Record<string, unknown>>,
  };
}

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS entries (
    entry_id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    previous_hash TEXT,
    entry_hash TEXT NOT NULL,
    parent_entry_id TEXT,
    model_id TEXT,
    model_provider TEXT,
    input_hash TEXT,
    output_hash TEXT,
    input_token_count INTEGER,
    output_token_count INTEGER,
    decision_type TEXT,
    confidence_score REAL,
    reasoning_certificate_id TEXT,
    provenance_id TEXT,
    session_id TEXT,
    actor_id TEXT,
    policy_ids TEXT,
    tags TEXT,
    annotation TEXT,
    compliance_metadata TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_entries_chain_id ON entries(chain_id, sequence_number);
  CREATE INDEX IF NOT EXISTS idx_entries_parent_id ON entries(parent_entry_id);

  CREATE TABLE IF NOT EXISTS certificates (
    certificate_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    certificate_hash TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS provenance (
    provenance_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    provenance_hash TEXT NOT NULL,
    data TEXT NOT NULL
  );
`;

export type SqliteAdapterHandle = {
  readonly adapter: StorageAdapter;
  readonly close: () => void;
};

/** Create a SQLite-backed StorageAdapter. Uses in-memory database by default. */
export function createSqliteAdapter(dbPath?: string | undefined): SqliteAdapterHandle {
  const sqlite = new Database(dbPath ?? ":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(CREATE_TABLES_SQL);

  const db: SqliteDb = drizzle(sqlite);

  const adapter: StorageAdapter = {
    putEntry: async (entry) => {
      const existing = db.select().from(sqliteEntries).where(eq(sqliteEntries.entryId, entry.entryId)).get();
      if (existing) {
        return err({ type: "DUPLICATE_ENTRY" as const, entryId: entry.entryId });
      }
      db.insert(sqliteEntries).values(entryToRow(entry)).run();
      return ok(entry);
    },

    getEntry: async (entryId) => {
      const row = db.select().from(sqliteEntries).where(eq(sqliteEntries.entryId, entryId)).get();
      if (!row) {
        return err({ type: "ENTRY_NOT_FOUND" as const, entryId });
      }
      return ok(rowToEntry(row as unknown as Record<string, unknown>));
    },

    getEntriesByChainId: async (chainId) => {
      const rows = db
        .select()
        .from(sqliteEntries)
        .where(eq(sqliteEntries.chainId, chainId))
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
        .where(eq(sqliteEntries.parentEntryId, parentEntryId))
        .orderBy(sqliteEntries.sequenceNumber)
        .all();
      return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
    },

    putCertificate: async (certificate) => {
      const existing = db.select().from(sqliteCertificates).where(eq(sqliteCertificates.certificateId, certificate.certificateId)).get();
      if (existing) {
        return err({ type: "DUPLICATE_CERTIFICATE" as const, certificateId: certificate.certificateId });
      }
      db.insert(sqliteCertificates).values({
        certificateId: certificate.certificateId,
        timestamp: certificate.timestamp,
        modelId: certificate.modelId,
        modelProvider: certificate.modelProvider,
        certificateHash: certificate.certificateHash,
        data: JSON.stringify(certificate),
      }).run();
      return ok(certificate);
    },

    getCertificate: async (certificateId) => {
      const row = db.select().from(sqliteCertificates).where(eq(sqliteCertificates.certificateId, certificateId)).get();
      if (!row) {
        return err({ type: "CERTIFICATE_NOT_FOUND" as const, certificateId });
      }
      return ok(JSON.parse(row.data) as ReasoningCertificate);
    },

    putProvenance: async (provenance) => {
      const existing = db.select().from(sqliteProvenance).where(eq(sqliteProvenance.provenanceId, provenance.provenanceId)).get();
      if (existing) {
        return err({ type: "DUPLICATE_PROVENANCE" as const, provenanceId: provenance.provenanceId });
      }
      db.insert(sqliteProvenance).values({
        provenanceId: provenance.provenanceId,
        timestamp: provenance.timestamp,
        modelName: provenance.modelName,
        modelVersion: provenance.modelVersion,
        modelProvider: provenance.modelProvider,
        provenanceHash: provenance.provenanceHash,
        data: JSON.stringify(provenance),
      }).run();
      return ok(provenance);
    },

    getProvenance: async (provenanceId) => {
      const row = db.select().from(sqliteProvenance).where(eq(sqliteProvenance.provenanceId, provenanceId)).get();
      if (!row) {
        return err({ type: "PROVENANCE_NOT_FOUND" as const, provenanceId });
      }
      return ok(JSON.parse(row.data) as ModelProvenance);
    },

    getChainLength: async (chainId) => {
      const result = db
        .select({ count: sql<number>`count(*)` })
        .from(sqliteEntries)
        .where(eq(sqliteEntries.chainId, chainId))
        .get();
      return result?.count ?? 0;
    },

    listChainIds: async () => {
      const rows = db
        .selectDistinct({ chainId: sqliteEntries.chainId })
        .from(sqliteEntries)
        .all();
      return rows.map((r) => r.chainId);
    },

    clear: async () => {
      db.delete(sqliteEntries).run();
      db.delete(sqliteCertificates).run();
      db.delete(sqliteProvenance).run();
    },
  };

  return {
    adapter,
    close: () => sqlite.close(),
  };
}
