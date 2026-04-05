/** SQL schema for SQLite storage adapters. Shared between single-tenant and multi-tenant. */

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS entries (
    entry_id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT '__default__',
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
  CREATE INDEX IF NOT EXISTS idx_entries_tenant_id ON entries(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_entries_tenant_chain ON entries(tenant_id, chain_id);

  CREATE TABLE IF NOT EXISTS certificates (
    certificate_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT '__default__',
    timestamp TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    certificate_hash TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_certificates_tenant_id ON certificates(tenant_id);

  CREATE TABLE IF NOT EXISTS provenance (
    provenance_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT '__default__',
    timestamp TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    provenance_hash TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_provenance_tenant_id ON provenance(tenant_id);
`;
