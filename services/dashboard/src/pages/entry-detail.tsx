import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import type { ProofChainEntry, ReasoningCertificate, ModelProvenance } from "../types.ts";
import {
  getEntry,
  validateEntry,
  getCertificate,
  getProvenance,
} from "../api/client.ts";
import { EntryTypeBadge } from "../components/entry-type-badge.tsx";
import { HashDisplay } from "../components/hash-display.tsx";
import { ValidationBadge } from "../components/validation-badge.tsx";
import { Loading } from "../components/loading.tsx";
import { ErrorMessage } from "../components/error-message.tsx";

type EntryState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "loaded"; readonly entry: ProofChainEntry };

type ValidState =
  | { readonly status: "idle" }
  | { readonly status: "pending" }
  | { readonly status: "valid" }
  | { readonly status: "invalid" };

export function EntryDetailPage() {
  const { chainId, entryId } = useParams<{
    chainId: string;
    entryId: string;
  }>();
  const [entryState, setEntryState] = useState<EntryState>({
    status: "loading",
  });
  const [validState, setValidState] = useState<ValidState>({
    status: "idle",
  });
  const [certificate, setCertificate] = useState<ReasoningCertificate | null>(
    null,
  );
  const [provenance, setProvenance] = useState<ModelProvenance | null>(null);

  const loadEntry = useCallback(async () => {
    if (chainId === undefined || entryId === undefined) return;
    setEntryState({ status: "loading" });
    const result = await getEntry(chainId, entryId);
    if (result.ok) {
      const entry = result.value.entry;
      setEntryState({ status: "loaded", entry });

      if (entry.reasoningCertificateId !== null) {
        const certResult = await getCertificate(entry.reasoningCertificateId);
        if (certResult.ok) {
          setCertificate(certResult.value.certificate);
        }
      }
      if (entry.provenanceId !== null) {
        const provResult = await getProvenance(entry.provenanceId);
        if (provResult.ok) {
          setProvenance(provResult.value.provenance);
        }
      }
    } else {
      setEntryState({ status: "error", message: result.error });
    }
  }, [chainId, entryId]);

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  const handleValidate = useCallback(async () => {
    if (chainId === undefined || entryId === undefined) return;
    setValidState({ status: "pending" });
    const result = await validateEntry(chainId, entryId);
    if (result.ok) {
      setValidState({ status: result.value.valid ? "valid" : "invalid" });
    } else {
      setValidState({ status: "idle" });
    }
  }, [chainId, entryId]);

  if (chainId === undefined || entryId === undefined) {
    return <ErrorMessage message="Missing chain or entry ID" />;
  }

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-seal-600 transition-colors">
          Chains
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/chains/${encodeURIComponent(chainId)}`}
          className="hover:text-seal-600 transition-colors"
        >
          Chain
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Entry</span>
      </nav>

      {entryState.status === "loading" && (
        <Loading label="Loading entry..." />
      )}

      {entryState.status === "error" && (
        <ErrorMessage
          message={entryState.message}
          onRetry={() => void loadEntry()}
        />
      )}

      {entryState.status === "loaded" && (
        <EntryContent
          entry={entryState.entry}
          validState={validState}
          onValidate={() => void handleValidate()}
          certificate={certificate}
          provenance={provenance}
        />
      )}
    </div>
  );
}

function EntryContent({
  entry,
  validState,
  onValidate,
  certificate,
  provenance,
}: {
  readonly entry: ProofChainEntry;
  readonly validState: ValidState;
  readonly onValidate: () => void;
  readonly certificate: ReasoningCertificate | null;
  readonly provenance: ModelProvenance | null;
}) {
  const validationBadgeState =
    validState.status === "pending"
      ? "pending" as const
      : validState.status === "valid"
        ? "valid" as const
        : validState.status === "invalid"
          ? "invalid" as const
          : "idle" as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            Entry #{entry.sequenceNumber}
          </h1>
          <EntryTypeBadge entryType={entry.entryType} />
        </div>
        <div className="flex items-center gap-3">
          <ValidationBadge state={validationBadgeState} />
          <button
            type="button"
            onClick={onValidate}
            disabled={validState.status === "pending"}
            className="px-4 py-2 text-sm font-medium text-white bg-seal-600 rounded-md hover:bg-seal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Verify Hash
          </button>
        </div>
      </div>

      <FieldSection title="Chain Integrity (Tier 1)">
        <FieldRow label="Entry ID" value={entry.entryId} mono />
        <FieldRow label="Chain ID" value={entry.chainId} mono />
        <FieldRow label="Sequence" value={String(entry.sequenceNumber)} />
        <FieldRow label="Timestamp" value={entry.timestamp} />
        <FieldRow label="Entry Type" value={entry.entryType} />
        <FieldRow label="Entry Hash">
          <HashDisplay hash={entry.entryHash} />
        </FieldRow>
        <FieldRow label="Previous Hash">
          <HashDisplay hash={entry.previousHash} />
        </FieldRow>
        <FieldRow
          label="Parent Entry ID"
          value={entry.parentEntryId ?? "-"}
          mono={entry.parentEntryId !== null}
        />
      </FieldSection>

      <FieldSection title="AI Decision Context (Tier 2)">
        <FieldRow label="Model ID" value={entry.modelId ?? "-"} />
        <FieldRow label="Model Provider" value={entry.modelProvider ?? "-"} />
        <FieldRow label="Input Hash">
          <HashDisplay hash={entry.inputHash} />
        </FieldRow>
        <FieldRow label="Output Hash">
          <HashDisplay hash={entry.outputHash} />
        </FieldRow>
        <FieldRow
          label="Input Tokens"
          value={entry.inputTokenCount !== null ? String(entry.inputTokenCount) : "-"}
        />
        <FieldRow
          label="Output Tokens"
          value={entry.outputTokenCount !== null ? String(entry.outputTokenCount) : "-"}
        />
        <FieldRow label="Decision Type" value={entry.decisionType ?? "-"} />
        <FieldRow
          label="Confidence"
          value={
            entry.confidenceScore !== null
              ? `${(entry.confidenceScore * 100).toFixed(1)}%`
              : "-"
          }
        />
        <FieldRow
          label="Certificate ID"
          value={entry.reasoningCertificateId ?? "-"}
          mono={entry.reasoningCertificateId !== null}
        />
        <FieldRow
          label="Provenance ID"
          value={entry.provenanceId ?? "-"}
          mono={entry.provenanceId !== null}
        />
      </FieldSection>

      <FieldSection title="Compliance & Metadata (Tier 3)">
        <FieldRow label="Session ID" value={entry.sessionId ?? "-"} mono={entry.sessionId !== null} />
        <FieldRow label="Actor ID" value={entry.actorId ?? "-"} />
        <FieldRow
          label="Policy IDs"
          value={entry.policyIds.length > 0 ? entry.policyIds.join(", ") : "-"}
        />
        <FieldRow
          label="Tags"
          value={
            Object.keys(entry.tags).length > 0
              ? JSON.stringify(entry.tags)
              : "-"
          }
        />
        <FieldRow label="Annotation" value={entry.annotation ?? "-"} />
        <FieldRow
          label="Compliance Metadata"
          value={
            Object.keys(entry.complianceMetadata).length > 0
              ? JSON.stringify(entry.complianceMetadata, null, 2)
              : "-"
          }
        />
      </FieldSection>

      {certificate !== null && (
        <FieldSection title="Reasoning Certificate">
          <FieldRow label="Certificate ID" value={certificate.certificateId} mono />
          <FieldRow label="Model" value={`${certificate.modelId} (${certificate.modelProvider})`} />
          <FieldRow
            label="Confidence"
            value={`${certificate.confidenceAssessment.level} (${(certificate.confidenceAssessment.score * 100).toFixed(1)}%)`}
          />
          <FieldRow label="Claims" value={String(certificate.claims.length)} />
          <FieldRow label="Evidence Items" value={String(certificate.supportingEvidence.length)} />
          <FieldRow
            label="Unsupported Claims"
            value={String(certificate.unsupportedClaims.length)}
          />
          <FieldRow label="Hash">
            <HashDisplay hash={certificate.certificateHash} />
          </FieldRow>
        </FieldSection>
      )}

      {provenance !== null && (
        <FieldSection title="Model Provenance (AIBOM)">
          <FieldRow label="Provenance ID" value={provenance.provenanceId} mono />
          <FieldRow label="Model" value={`${provenance.modelName} v${provenance.modelVersion}`} />
          <FieldRow label="Type" value={provenance.modelType} />
          <FieldRow label="Provider" value={provenance.modelProvider} />
          <FieldRow label="BOM Version" value={provenance.bomVersion} />
          <FieldRow label="License" value={provenance.modelLicense ?? "-"} />
          <FieldRow
            label="Datasets"
            value={String(provenance.trainingDatasets.length)}
          />
          <FieldRow
            label="Metrics"
            value={String(provenance.performanceMetrics.length)}
          />
          <FieldRow label="Hash">
            <HashDisplay hash={provenance.provenanceHash} />
          </FieldRow>
        </FieldSection>
      )}
    </div>
  );
}

function FieldSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <dl className="divide-y divide-gray-100">{children}</dl>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono = false,
  children,
}: {
  readonly label: string;
  readonly value?: string;
  readonly mono?: boolean;
  readonly children?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-3 flex items-start gap-4">
      <dt className="w-40 flex-shrink-0 text-sm font-medium text-gray-500">
        {label}
      </dt>
      <dd
        className={`text-sm text-gray-900 break-all ${mono ? "font-mono" : ""}`}
      >
        {children ?? value}
      </dd>
    </div>
  );
}
