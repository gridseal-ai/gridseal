"""SHA-256 hashing and deterministic serialization, matching the TypeScript implementation."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from gridseal.core.types import ProofChainEntry

# Field order MUST match the TypeScript HASHABLE_FIELD_ORDER exactly.
# This order is locked and must not change once entries exist in production chains.
HASHABLE_FIELD_ORDER: tuple[str, ...] = (
    "entryId",
    "chainId",
    "sequenceNumber",
    "timestamp",
    "entryType",
    "previousHash",
    "parentEntryId",
    "modelId",
    "modelProvider",
    "inputHash",
    "outputHash",
    "inputTokenCount",
    "outputTokenCount",
    "decisionType",
    "confidenceScore",
    "reasoningCertificateId",
    "provenanceId",
    "sessionId",
    "actorId",
    "policyIds",
    "tags",
    "annotation",
    "complianceMetadata",
)

# Map from Python snake_case attribute to TypeScript camelCase field name
_PYTHON_TO_TS_FIELD: dict[str, str] = {
    "entry_id": "entryId",
    "chain_id": "chainId",
    "sequence_number": "sequenceNumber",
    "timestamp": "timestamp",
    "entry_type": "entryType",
    "previous_hash": "previousHash",
    "parent_entry_id": "parentEntryId",
    "model_id": "modelId",
    "model_provider": "modelProvider",
    "input_hash": "inputHash",
    "output_hash": "outputHash",
    "input_token_count": "inputTokenCount",
    "output_token_count": "outputTokenCount",
    "decision_type": "decisionType",
    "confidence_score": "confidenceScore",
    "reasoning_certificate_id": "reasoningCertificateId",
    "provenance_id": "provenanceId",
    "session_id": "sessionId",
    "actor_id": "actorId",
    "policy_ids": "policyIds",
    "tags": "tags",
    "annotation": "annotation",
    "compliance_metadata": "complianceMetadata",
}

# Reverse mapping for lookup
_TS_TO_PYTHON_FIELD: dict[str, str] = {v: k for k, v in _PYTHON_TO_TS_FIELD.items()}


def canonicalize(value: Any) -> str:  # noqa: ANN401
    """Deterministically serialize a value for hashing.

    Objects have sorted keys, arrays preserve order, primitives use JSON encoding.
    Matches the TypeScript canonicalize function exactly.
    """
    if value is None:
        return "null"
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        # Match JavaScript number serialization
        if value == int(value) and not (value == 0.0 and str(value).startswith("-")):
            return str(int(value))
        return str(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        pairs = [json.dumps(k) + ":" + canonicalize(value[k]) for k in keys]
        return "{" + ",".join(pairs) + "}"
    return str(value)


def _entry_to_hashable_dict(entry: ProofChainEntry) -> dict[str, Any]:
    """Convert a ProofChainEntry to a dict with camelCase keys for hashing."""
    result: dict[str, Any] = {}
    for python_field, ts_field in _PYTHON_TO_TS_FIELD.items():
        value = getattr(entry, python_field)
        # Convert tuple to list for JSON compatibility
        if isinstance(value, tuple):
            value = list(value)
        result[ts_field] = value
    return result


def serialize_for_hashing(entry: ProofChainEntry) -> str:
    """Build the canonical string representation of an entry's hashable fields.

    Uses the fixed HASHABLE_FIELD_ORDER to ensure deterministic output.
    Matches the TypeScript serializeForHashing function.
    """
    hashable = _entry_to_hashable_dict(entry)
    parts: list[str] = []
    for field_name in HASHABLE_FIELD_ORDER:
        value = hashable[field_name]
        parts.append(json.dumps(field_name) + ":" + canonicalize(value))
    return "{" + ",".join(parts) + "}"


def sha256(input_str: str) -> str:
    """Compute SHA-256 hash of a UTF-8 string, returned as lowercase hex."""
    return hashlib.sha256(input_str.encode("utf-8")).hexdigest()


def compute_entry_hash(entry: ProofChainEntry) -> str:
    """Compute the entry hash for a proof chain entry's hashable fields."""
    return sha256(serialize_for_hashing(entry))
