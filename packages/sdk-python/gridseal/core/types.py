"""Core types for GridSeal proof chain entries, mirroring the TypeScript definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Generic, Literal, TypeVar, Union

EntryType = Literal[
    "ai_decision",
    "human_override",
    "system_event",
    "policy_check",
    "data_access",
    "model_deployment",
    "feedback",
    "correction",
]

ENTRY_TYPES: tuple[EntryType, ...] = (
    "ai_decision",
    "human_override",
    "system_event",
    "policy_check",
    "data_access",
    "model_deployment",
    "feedback",
    "correction",
)

DecisionType = Literal[
    "classification",
    "generation",
    "recommendation",
    "extraction",
    "summarization",
    "translation",
    "embedding",
    "tool_call",
    "routing",
    "other",
]

DECISION_TYPES: tuple[DecisionType, ...] = (
    "classification",
    "generation",
    "recommendation",
    "extraction",
    "summarization",
    "translation",
    "embedding",
    "tool_call",
    "routing",
    "other",
)


@dataclass(frozen=True, slots=True)
class ProofChainEntry:
    """A complete Proof Chain entry with all 24 fields across 3 tiers."""

    # Tier 1: Core Chain Integrity (8 fields)
    entry_id: str
    chain_id: str
    sequence_number: int
    timestamp: str
    entry_type: EntryType
    entry_hash: str
    previous_hash: str | None
    parent_entry_id: str | None

    # Tier 2: AI Decision Context (10 fields)
    model_id: str | None = None
    model_provider: str | None = None
    input_hash: str | None = None
    output_hash: str | None = None
    input_token_count: int | None = None
    output_token_count: int | None = None
    decision_type: DecisionType | None = None
    confidence_score: float | None = None
    reasoning_certificate_id: str | None = None
    provenance_id: str | None = None

    # Tier 3: Compliance and Metadata (6 fields)
    session_id: str | None = None
    actor_id: str | None = None
    policy_ids: tuple[str, ...] = ()
    tags: dict[str, str] = field(default_factory=dict)
    annotation: str | None = None
    compliance_metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AppendEntryInput:
    """Input fields the caller provides when appending an entry."""

    entry_id: str
    timestamp: str
    entry_type: EntryType
    parent_entry_id: str | None = None

    # Tier 2 optional fields
    model_id: str | None = None
    model_provider: str | None = None
    input_hash: str | None = None
    output_hash: str | None = None
    input_token_count: int | None = None
    output_token_count: int | None = None
    decision_type: DecisionType | None = None
    confidence_score: float | None = None
    reasoning_certificate_id: str | None = None
    provenance_id: str | None = None

    # Tier 3 optional fields
    session_id: str | None = None
    actor_id: str | None = None
    policy_ids: tuple[str, ...] = ()
    tags: dict[str, str] = field(default_factory=dict)
    annotation: str | None = None
    compliance_metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ChainState:
    """Immutable state of a proof chain."""

    chain_id: str
    entries: tuple[ProofChainEntry, ...] = ()


# Result type: discriminated union for fallible operations.

T = TypeVar("T")
E = TypeVar("E")


@dataclass(frozen=True, slots=True)
class Ok(Generic[T]):
    """Successful result."""

    value: T
    ok: bool = field(default=True, init=False)


@dataclass(frozen=True, slots=True)
class Err(Generic[E]):
    """Failed result."""

    error: E
    ok: bool = field(default=False, init=False)


Result = Union[Ok[T], Err[E]]


def ok(value: T) -> Ok[T]:
    """Create a successful result."""
    return Ok(value=value)


def err(error: E) -> Err[E]:
    """Create a failed result."""
    return Err(error=error)


# Chain errors

@dataclass(frozen=True, slots=True)
class DuplicateEntryId:
    type: Literal["DUPLICATE_ENTRY_ID"] = "DUPLICATE_ENTRY_ID"
    entry_id: str = ""


@dataclass(frozen=True, slots=True)
class ParentNotFound:
    type: Literal["PARENT_NOT_FOUND"] = "PARENT_NOT_FOUND"
    parent_entry_id: str = ""


@dataclass(frozen=True, slots=True)
class ParentChainMismatch:
    type: Literal["PARENT_CHAIN_MISMATCH"] = "PARENT_CHAIN_MISMATCH"
    parent_entry_id: str = ""
    expected_chain_id: str = ""


ChainError = Union[DuplicateEntryId, ParentNotFound, ParentChainMismatch]


# Validation errors

@dataclass(frozen=True, slots=True)
class HashMismatch:
    type: Literal["HASH_MISMATCH"] = "HASH_MISMATCH"
    entry_id: str = ""
    sequence_number: int = 0
    expected_hash: str = ""
    actual_hash: str = ""


@dataclass(frozen=True, slots=True)
class PreviousHashMismatch:
    type: Literal["PREVIOUS_HASH_MISMATCH"] = "PREVIOUS_HASH_MISMATCH"
    entry_id: str = ""
    sequence_number: int = 0
    expected_previous_hash: str | None = None
    actual_previous_hash: str | None = None


@dataclass(frozen=True, slots=True)
class SequenceNumberMismatch:
    type: Literal["SEQUENCE_NUMBER_MISMATCH"] = "SEQUENCE_NUMBER_MISMATCH"
    entry_id: str = ""
    expected_sequence_number: int = 0
    actual_sequence_number: int = 0


@dataclass(frozen=True, slots=True)
class ChainIdMismatch:
    type: Literal["CHAIN_ID_MISMATCH"] = "CHAIN_ID_MISMATCH"
    entry_id: str = ""
    expected_chain_id: str = ""
    actual_chain_id: str = ""


@dataclass(frozen=True, slots=True)
class EntryNotFound:
    type: Literal["ENTRY_NOT_FOUND"] = "ENTRY_NOT_FOUND"
    entry_id: str = ""


@dataclass(frozen=True, slots=True)
class EmptyChain:
    type: Literal["EMPTY_CHAIN"] = "EMPTY_CHAIN"


ValidationError = Union[
    HashMismatch,
    PreviousHashMismatch,
    SequenceNumberMismatch,
    ChainIdMismatch,
    EntryNotFound,
    EmptyChain,
]


# Storage errors

@dataclass(frozen=True, slots=True)
class StorageEntryNotFound:
    type: Literal["ENTRY_NOT_FOUND"] = "ENTRY_NOT_FOUND"
    entry_id: str = ""


@dataclass(frozen=True, slots=True)
class StorageDuplicateEntry:
    type: Literal["DUPLICATE_ENTRY"] = "DUPLICATE_ENTRY"
    entry_id: str = ""


StorageError = Union[StorageEntryNotFound, StorageDuplicateEntry]
