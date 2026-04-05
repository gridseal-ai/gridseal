/**
 * PostgreSQL-backed StorageAdapter using Drizzle ORM.
 * Used for production deployments.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import pg from "pg";
import type { StorageAdapter } from "@gridseal/core";
import { ok, err } from "@gridseal/core";
import type { ProofChainEntry, ReasoningCertificate, ModelProvenance } from "@gridseal/core";
import { pgEntries, pgCertificates, pgProvenance } from "./schema.js";

type PgDb = ReturnType<typeof drizzle>;

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
    policyIds: [...entry.policyIds],
    tags: { ...entry.tags },
    annotation: entry.annotation,
    complianceMetadata: { ...entry.complianceMetadata },
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
    policyIds: (row["policyIds"] as ReadonlyArray<string>) ?? [],
    tags: (row["tags"] as Readonly<Record<string, string>>) ?? {},
    annotation: (row["annotation"] as string | null) ?? null,
    complianceMetadata: (row["complianceMetadata"] as Readonly<Record<string, unknown>>) ?? {},
  };
}

export type PostgresAdapterHandle = {
  readonly adapter: StorageAdapter;
  readonly close: () => Promise<void>;
};

/** Create a PostgreSQL-backed StorageAdapter. */
export async function createPostgresAdapter(connectionString: string): Promise<PostgresAdapterHandle> {
  const pool = new pg.Pool({ connectionString });
  const db: PgDb = drizzle(pool);

  // Create tables if they don't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      entry_id VARCHAR(64) PRIMARY KEY,
      chain_id VARCHAR(128) NOT NULL,
      sequence_number INTEGER NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      entry_type VARCHAR(64) NOT NULL,
      previous_hash VARCHAR(64),
      entry_hash VARCHAR(64) NOT NULL,
      parent_entry_id VARCHAR(64),
      model_id VARCHAR(256),
      model_provider VARCHAR(128),
      input_hash VARCHAR(64),
      output_hash VARCHAR(64),
      input_token_count INTEGER,
      output_token_count INTEGER,
      decision_type VARCHAR(64),
      confidence_score DOUBLE PRECISION,
      reasoning_certificate_id VARCHAR(64),
      provenance_id VARCHAR(64),
      session_id VARCHAR(128),
      actor_id VARCHAR(128),
      policy_ids JSONB,
      tags JSONB,
      annotation TEXT,
      compliance_metadata JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_entries_chain_id ON entries(chain_id, sequence_number);
    CREATE INDEX IF NOT EXISTS idx_entries_parent_id ON entries(parent_entry_id);

    CREATE TABLE IF NOT EXISTS certificates (
      certificate_id VARCHAR(64) PRIMARY KEY,
      timestamp VARCHAR(64) NOT NULL,
      model_id VARCHAR(256) NOT NULL,
      model_provider VARCHAR(128) NOT NULL,
      certificate_hash VARCHAR(64) NOT NULL,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provenance (
      provenance_id VARCHAR(64) PRIMARY KEY,
      timestamp VARCHAR(64) NOT NULL,
      model_name VARCHAR(256) NOT NULL,
      model_version VARCHAR(128) NOT NULL,
      model_provider VARCHAR(128) NOT NULL,
      provenance_hash VARCHAR(64) NOT NULL,
      data JSONB NOT NULL
    );
  `);

  const adapter: StorageAdapter = {
    putEntry: async (entry) => {
      const existing = await db.select({ id: pgEntries.entryId }).from(pgEntries).where(eq(pgEntries.entryId, entry.entryId)).limit(1);
      if (existing.length > 0) {
        return err({ type: "DUPLICATE_ENTRY" as const, entryId: entry.entryId });
      }
      await db.insert(pgEntries).values(entryToRow(entry));
      return ok(entry);
    },

    getEntry: async (entryId) => {
      const rows = await db.select().from(pgEntries).where(eq(pgEntries.entryId, entryId)).limit(1);
      if (rows.length === 0) {
        return err({ type: "ENTRY_NOT_FOUND" as const, entryId });
      }
      return ok(rowToEntry(rows[0] as unknown as Record<string, unknown>));
    },

    getEntriesByChainId: async (chainId) => {
      const rows = await db
        .select()
        .from(pgEntries)
        .where(eq(pgEntries.chainId, chainId))
        .orderBy(pgEntries.sequenceNumber);
      return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
    },

    getEntriesBySequenceRange: async (chainId, startSequence, endSequence) => {
      const rows = await db
        .select()
        .from(pgEntries)
        .where(
          and(
            eq(pgEntries.chainId, chainId),
            gte(pgEntries.sequenceNumber, startSequence),
            lte(pgEntries.sequenceNumber, endSequence),
          ),
        )
        .orderBy(pgEntries.sequenceNumber);
      return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
    },

    getEntriesByParentId: async (parentEntryId) => {
      const rows = await db
        .select()
        .from(pgEntries)
        .where(eq(pgEntries.parentEntryId, parentEntryId))
        .orderBy(pgEntries.sequenceNumber);
      return rows.map((r) => rowToEntry(r as unknown as Record<string, unknown>));
    },

    putCertificate: async (certificate) => {
      const existing = await db.select({ id: pgCertificates.certificateId }).from(pgCertificates).where(eq(pgCertificates.certificateId, certificate.certificateId)).limit(1);
      if (existing.length > 0) {
        return err({ type: "DUPLICATE_CERTIFICATE" as const, certificateId: certificate.certificateId });
      }
      await db.insert(pgCertificates).values({
        certificateId: certificate.certificateId,
        timestamp: certificate.timestamp,
        modelId: certificate.modelId,
        modelProvider: certificate.modelProvider,
        certificateHash: certificate.certificateHash,
        data: certificate as unknown as Record<string, unknown>,
      });
      return ok(certificate);
    },

    getCertificate: async (certificateId) => {
      const rows = await db.select().from(pgCertificates).where(eq(pgCertificates.certificateId, certificateId)).limit(1);
      if (rows.length === 0) {
        return err({ type: "CERTIFICATE_NOT_FOUND" as const, certificateId });
      }
      return ok(rows[0]?.data as unknown as ReasoningCertificate);
    },

    putProvenance: async (provenance) => {
      const existing = await db.select({ id: pgProvenance.provenanceId }).from(pgProvenance).where(eq(pgProvenance.provenanceId, provenance.provenanceId)).limit(1);
      if (existing.length > 0) {
        return err({ type: "DUPLICATE_PROVENANCE" as const, provenanceId: provenance.provenanceId });
      }
      await db.insert(pgProvenance).values({
        provenanceId: provenance.provenanceId,
        timestamp: provenance.timestamp,
        modelName: provenance.modelName,
        modelVersion: provenance.modelVersion,
        modelProvider: provenance.modelProvider,
        provenanceHash: provenance.provenanceHash,
        data: provenance as unknown as Record<string, unknown>,
      });
      return ok(provenance);
    },

    getProvenance: async (provenanceId) => {
      const rows = await db.select().from(pgProvenance).where(eq(pgProvenance.provenanceId, provenanceId)).limit(1);
      if (rows.length === 0) {
        return err({ type: "PROVENANCE_NOT_FOUND" as const, provenanceId });
      }
      return ok(rows[0]?.data as unknown as ModelProvenance);
    },

    getChainLength: async (chainId) => {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(pgEntries)
        .where(eq(pgEntries.chainId, chainId));
      return Number(result[0]?.count ?? 0);
    },

    listChainIds: async () => {
      const rows = await db
        .selectDistinct({ chainId: pgEntries.chainId })
        .from(pgEntries);
      return rows.map((r) => r.chainId);
    },

    clear: async () => {
      await db.delete(pgEntries);
      await db.delete(pgCertificates);
      await db.delete(pgProvenance);
    },
  };

  return {
    adapter,
    close: async () => {
      await pool.end();
    },
  };
}
