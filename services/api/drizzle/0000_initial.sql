-- GridSeal API initial schema migration

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
CREATE INDEX IF NOT EXISTS idx_entries_session_id ON entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_actor_id ON entries(actor_id);
CREATE INDEX IF NOT EXISTS idx_entries_model_id ON entries(model_id);
CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp);

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
