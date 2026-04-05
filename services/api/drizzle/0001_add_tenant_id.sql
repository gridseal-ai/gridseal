-- Add tenant_id column for multi-tenant isolation.
-- Existing rows get the default tenant ID.

ALTER TABLE entries ADD COLUMN tenant_id VARCHAR(128) NOT NULL DEFAULT '__default__';
CREATE INDEX IF NOT EXISTS idx_entries_tenant_id ON entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_chain ON entries(tenant_id, chain_id);

ALTER TABLE certificates ADD COLUMN tenant_id VARCHAR(128) NOT NULL DEFAULT '__default__';
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_id ON certificates(tenant_id);

ALTER TABLE provenance ADD COLUMN tenant_id VARCHAR(128) NOT NULL DEFAULT '__default__';
CREATE INDEX IF NOT EXISTS idx_provenance_tenant_id ON provenance(tenant_id);
