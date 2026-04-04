import Database from "better-sqlite3";
import type { Statement } from "better-sqlite3";
import type { ProofChainEntry } from "../schema/proof-chain-entry.js";
import type { ReasoningCertificate } from "../certificate/reasoning-certificate.js";
import type { ModelProvenance } from "../provenance/model-provenance.js";
import type { Result } from "../schema/result.js";
import { ok, err } from "../schema/result.js";
import type { StorageAdapter, StorageError } from "./storage-adapter.js";
import {
  type EntryRow,
  type CertificateRow,
  type ProvenanceRow,
  entryToRow,
  rowToEntry,
  CREATE_ENTRIES_TABLE,
  CREATE_ENTRIES_CHAIN_INDEX,
  CREATE_ENTRIES_PARENT_INDEX,
  CREATE_CERTIFICATES_TABLE,
  CREATE_PROVENANCE_TABLE,
  INSERT_ENTRY,
} from "./sqlite-adapter-sql.js";

type Statements = {
  readonly insertEntry: Statement;
  readonly getEntry: Statement;
  readonly getByChain: Statement;
  readonly getByRange: Statement;
  readonly getByParent: Statement;
  readonly chainLength: Statement;
  readonly listChains: Statement;
  readonly insertCert: Statement;
  readonly getCert: Statement;
  readonly insertProv: Statement;
  readonly getProv: Statement;
};

function prepareStatements(db: Database.Database): Statements {
  return {
    insertEntry: db.prepare(INSERT_ENTRY),
    getEntry: db.prepare<{ entry_id: string }>(
      "SELECT * FROM entries WHERE entry_id = @entry_id"
    ),
    getByChain: db.prepare<{ chain_id: string }>(
      "SELECT * FROM entries WHERE chain_id = @chain_id ORDER BY sequence_number ASC"
    ),
    getByRange: db.prepare<{
      chain_id: string;
      start_seq: number;
      end_seq: number;
    }>(
      "SELECT * FROM entries WHERE chain_id = @chain_id AND sequence_number >= @start_seq AND sequence_number <= @end_seq ORDER BY sequence_number ASC"
    ),
    getByParent: db.prepare<{ parent_entry_id: string }>(
      "SELECT * FROM entries WHERE parent_entry_id = @parent_entry_id ORDER BY sequence_number ASC"
    ),
    chainLength: db.prepare<{ chain_id: string }>(
      "SELECT COUNT(*) as cnt FROM entries WHERE chain_id = @chain_id"
    ),
    listChains: db.prepare("SELECT DISTINCT chain_id FROM entries"),
    insertCert: db.prepare(
      "INSERT INTO certificates (certificate_id, data) VALUES (@certificate_id, @data)"
    ),
    getCert: db.prepare<{ certificate_id: string }>(
      "SELECT * FROM certificates WHERE certificate_id = @certificate_id"
    ),
    insertProv: db.prepare(
      "INSERT INTO provenance (provenance_id, data) VALUES (@provenance_id, @data)"
    ),
    getProv: db.prepare<{ provenance_id: string }>(
      "SELECT * FROM provenance WHERE provenance_id = @provenance_id"
    ),
  };
}

function putEntry(
  stmt: Statement,
  entry: ProofChainEntry
): Promise<Result<ProofChainEntry, StorageError>> {
  try {
    stmt.run(entryToRow(entry));
    return Promise.resolve(ok(entry));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
      return Promise.resolve(
        err({ type: "DUPLICATE_ENTRY" as const, entryId: entry.entryId })
      );
    }
    throw e;
  }
}

function getEntry(
  stmt: Statement,
  entryId: string
): Promise<Result<ProofChainEntry, StorageError>> {
  const row = stmt.get({ entry_id: entryId }) as EntryRow | undefined;
  if (!row) {
    return Promise.resolve(
      err({ type: "ENTRY_NOT_FOUND" as const, entryId })
    );
  }
  return Promise.resolve(ok(rowToEntry(row)));
}

function putCertificate(
  stmt: Statement,
  certificate: ReasoningCertificate
): Promise<Result<ReasoningCertificate, StorageError>> {
  try {
    stmt.run({
      certificate_id: certificate.certificateId,
      data: JSON.stringify(certificate),
    });
    return Promise.resolve(ok(certificate));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
      return Promise.resolve(
        err({
          type: "DUPLICATE_CERTIFICATE" as const,
          certificateId: certificate.certificateId,
        })
      );
    }
    throw e;
  }
}

function getCertificate(
  stmt: Statement,
  certificateId: string
): Promise<Result<ReasoningCertificate, StorageError>> {
  const row = stmt.get({ certificate_id: certificateId }) as
    | CertificateRow
    | undefined;
  if (!row) {
    return Promise.resolve(
      err({ type: "CERTIFICATE_NOT_FOUND" as const, certificateId })
    );
  }
  return Promise.resolve(ok(JSON.parse(row.data) as ReasoningCertificate));
}

function putProvenance(
  stmt: Statement,
  prov: ModelProvenance
): Promise<Result<ModelProvenance, StorageError>> {
  try {
    stmt.run({
      provenance_id: prov.provenanceId,
      data: JSON.stringify(prov),
    });
    return Promise.resolve(ok(prov));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
      return Promise.resolve(
        err({
          type: "DUPLICATE_PROVENANCE" as const,
          provenanceId: prov.provenanceId,
        })
      );
    }
    throw e;
  }
}

function getProvenance(
  stmt: Statement,
  provenanceId: string
): Promise<Result<ModelProvenance, StorageError>> {
  const row = stmt.get({ provenance_id: provenanceId }) as
    | ProvenanceRow
    | undefined;
  if (!row) {
    return Promise.resolve(
      err({ type: "PROVENANCE_NOT_FOUND" as const, provenanceId })
    );
  }
  return Promise.resolve(ok(JSON.parse(row.data) as ModelProvenance));
}

/** Options for creating a SQLite storage adapter. */
export type SqliteAdapterOptions = {
  /** Path to the SQLite database file, or ":memory:" for an in-memory database. */
  readonly path: string;
};

/** Create a SQLite-backed storage adapter. */
export function createSqliteAdapter(
  options: SqliteAdapterOptions
): StorageAdapter {
  const db = new Database(options.path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(CREATE_ENTRIES_TABLE);
  db.exec(CREATE_ENTRIES_CHAIN_INDEX);
  db.exec(CREATE_ENTRIES_PARENT_INDEX);
  db.exec(CREATE_CERTIFICATES_TABLE);
  db.exec(CREATE_PROVENANCE_TABLE);

  const s = prepareStatements(db);

  return {
    putEntry: (entry) => putEntry(s.insertEntry, entry),
    getEntry: (entryId) => getEntry(s.getEntry, entryId),
    getEntriesByChainId: (chainId) => {
      const rows = s.getByChain.all({ chain_id: chainId }) as Array<EntryRow>;
      return Promise.resolve(rows.map(rowToEntry));
    },
    getEntriesBySequenceRange: (chainId, startSequence, endSequence) => {
      const rows = s.getByRange.all({
        chain_id: chainId,
        start_seq: startSequence,
        end_seq: endSequence,
      }) as Array<EntryRow>;
      return Promise.resolve(rows.map(rowToEntry));
    },
    getEntriesByParentId: (parentEntryId) => {
      const rows = s.getByParent.all({
        parent_entry_id: parentEntryId,
      }) as Array<EntryRow>;
      return Promise.resolve(rows.map(rowToEntry));
    },
    putCertificate: (cert) => putCertificate(s.insertCert, cert),
    getCertificate: (certId) => getCertificate(s.getCert, certId),
    putProvenance: (prov) => putProvenance(s.insertProv, prov),
    getProvenance: (provId) => getProvenance(s.getProv, provId),
    getChainLength: (chainId) => {
      const row = s.chainLength.get({ chain_id: chainId }) as { cnt: number };
      return Promise.resolve(row.cnt);
    },
    listChainIds: () => {
      const rows = s.listChains.all() as Array<{ chain_id: string }>;
      return Promise.resolve(rows.map((r) => r.chain_id));
    },
    clear: () => {
      db.exec("DELETE FROM entries");
      db.exec("DELETE FROM certificates");
      db.exec("DELETE FROM provenance");
      return Promise.resolve();
    },
  };
}
