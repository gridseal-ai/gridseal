import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { pgTable, varchar, text as pgText, integer as pgInteger, doublePrecision, jsonb, index as pgIndex } from "drizzle-orm/pg-core";

/**
 * SQLite schema for test/local development.
 * JSON columns stored as text, timestamps as ISO strings.
 */
export const sqliteEntries = sqliteTable("entries", {
  entryId: text("entry_id").primaryKey(),
  chainId: text("chain_id").notNull(),
  tenantId: text("tenant_id").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  timestamp: text("timestamp").notNull(),
  entryType: text("entry_type").notNull(),
  previousHash: text("previous_hash"),
  entryHash: text("entry_hash").notNull(),
  parentEntryId: text("parent_entry_id"),
  modelId: text("model_id"),
  modelProvider: text("model_provider"),
  inputHash: text("input_hash"),
  outputHash: text("output_hash"),
  inputTokenCount: integer("input_token_count"),
  outputTokenCount: integer("output_token_count"),
  decisionType: text("decision_type"),
  confidenceScore: real("confidence_score"),
  reasoningCertificateId: text("reasoning_certificate_id"),
  provenanceId: text("provenance_id"),
  sessionId: text("session_id"),
  actorId: text("actor_id"),
  policyIds: text("policy_ids"), // JSON array stored as text
  tags: text("tags"), // JSON object stored as text
  annotation: text("annotation"),
  complianceMetadata: text("compliance_metadata"), // JSON stored as text
}, (table) => [
  index("idx_entries_chain_id").on(table.chainId, table.sequenceNumber),
  index("idx_entries_parent_id").on(table.parentEntryId),
  index("idx_entries_tenant_id").on(table.tenantId),
  index("idx_entries_tenant_chain").on(table.tenantId, table.chainId),
]);

export const sqliteCertificates = sqliteTable("certificates", {
  certificateId: text("certificate_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  timestamp: text("timestamp").notNull(),
  modelId: text("model_id").notNull(),
  modelProvider: text("model_provider").notNull(),
  certificateHash: text("certificate_hash").notNull(),
  data: text("data").notNull(), // Full certificate JSON
}, (table) => [
  index("idx_certificates_tenant_id").on(table.tenantId),
]);

export const sqliteProvenance = sqliteTable("provenance", {
  provenanceId: text("provenance_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  timestamp: text("timestamp").notNull(),
  modelName: text("model_name").notNull(),
  modelVersion: text("model_version").notNull(),
  modelProvider: text("model_provider").notNull(),
  provenanceHash: text("provenance_hash").notNull(),
  data: text("data").notNull(), // Full provenance JSON
}, (table) => [
  index("idx_provenance_tenant_id").on(table.tenantId),
]);

/**
 * PostgreSQL schema for production.
 */
export const pgEntries = pgTable("entries", {
  entryId: varchar("entry_id", { length: 64 }).primaryKey(),
  chainId: varchar("chain_id", { length: 128 }).notNull(),
  tenantId: varchar("tenant_id", { length: 128 }).notNull(),
  sequenceNumber: pgInteger("sequence_number").notNull(),
  timestamp: varchar("timestamp", { length: 64 }).notNull(),
  entryType: varchar("entry_type", { length: 64 }).notNull(),
  previousHash: varchar("previous_hash", { length: 64 }),
  entryHash: varchar("entry_hash", { length: 64 }).notNull(),
  parentEntryId: varchar("parent_entry_id", { length: 64 }),
  modelId: varchar("model_id", { length: 256 }),
  modelProvider: varchar("model_provider", { length: 128 }),
  inputHash: varchar("input_hash", { length: 64 }),
  outputHash: varchar("output_hash", { length: 64 }),
  inputTokenCount: pgInteger("input_token_count"),
  outputTokenCount: pgInteger("output_token_count"),
  decisionType: varchar("decision_type", { length: 64 }),
  confidenceScore: doublePrecision("confidence_score"),
  reasoningCertificateId: varchar("reasoning_certificate_id", { length: 64 }),
  provenanceId: varchar("provenance_id", { length: 64 }),
  sessionId: varchar("session_id", { length: 128 }),
  actorId: varchar("actor_id", { length: 128 }),
  policyIds: jsonb("policy_ids"), // JSON array
  tags: jsonb("tags"), // JSON object
  annotation: pgText("annotation"),
  complianceMetadata: jsonb("compliance_metadata"),
}, (table) => [
  pgIndex("idx_pg_entries_chain_id").on(table.chainId, table.sequenceNumber),
  pgIndex("idx_pg_entries_parent_id").on(table.parentEntryId),
  pgIndex("idx_pg_entries_tenant_id").on(table.tenantId),
  pgIndex("idx_pg_entries_tenant_chain").on(table.tenantId, table.chainId),
]);

export const pgCertificates = pgTable("certificates", {
  certificateId: varchar("certificate_id", { length: 64 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 128 }).notNull(),
  timestamp: varchar("timestamp", { length: 64 }).notNull(),
  modelId: varchar("model_id", { length: 256 }).notNull(),
  modelProvider: varchar("model_provider", { length: 128 }).notNull(),
  certificateHash: varchar("certificate_hash", { length: 64 }).notNull(),
  data: jsonb("data").notNull(),
}, (table) => [
  pgIndex("idx_pg_certificates_tenant_id").on(table.tenantId),
]);

export const pgProvenance = pgTable("provenance", {
  provenanceId: varchar("provenance_id", { length: 64 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 128 }).notNull(),
  timestamp: varchar("timestamp", { length: 64 }).notNull(),
  modelName: varchar("model_name", { length: 256 }).notNull(),
  modelVersion: varchar("model_version", { length: 128 }).notNull(),
  modelProvider: varchar("model_provider", { length: 128 }).notNull(),
  provenanceHash: varchar("provenance_hash", { length: 64 }).notNull(),
  data: jsonb("data").notNull(),
}, (table) => [
  pgIndex("idx_pg_provenance_tenant_id").on(table.tenantId),
]);
