"""Chain operations: create, append, validate. Mirrors the TypeScript implementation."""

from __future__ import annotations

from gridseal.core.hash import compute_entry_hash
from gridseal.core.types import (
    AppendEntryInput,
    ChainError,
    ChainIdMismatch,
    ChainState,
    DuplicateEntryId,
    Err,
    HashMismatch,
    Ok,
    ParentChainMismatch,
    ParentNotFound,
    PreviousHashMismatch,
    ProofChainEntry,
    Result,
    SequenceNumberMismatch,
    ValidationError,
    err,
    ok,
)


def create_chain(chain_id: str) -> ChainState:
    """Create an empty chain with the given ID."""
    return ChainState(chain_id=chain_id)


def _validate_append_input(
    chain: ChainState, entry_input: AppendEntryInput
) -> Result[None, ChainError]:
    for entry in chain.entries:
        if entry.entry_id == entry_input.entry_id:
            return err(DuplicateEntryId(entry_id=entry_input.entry_id))

    parent_entry_id = entry_input.parent_entry_id
    if parent_entry_id is not None:
        parent = None
        for entry in chain.entries:
            if entry.entry_id == parent_entry_id:
                parent = entry
                break
        if parent is None:
            return err(ParentNotFound(parent_entry_id=parent_entry_id))
        if parent.chain_id != chain.chain_id:
            return err(
                ParentChainMismatch(
                    parent_entry_id=parent_entry_id,
                    expected_chain_id=chain.chain_id,
                )
            )
    return ok(None)


def _build_entry(chain: ChainState, entry_input: AppendEntryInput) -> ProofChainEntry:
    """Build a ProofChainEntry from chain state and input, computing the hash."""
    last_entry = chain.entries[-1] if chain.entries else None
    previous_hash = last_entry.entry_hash if last_entry is not None else None

    # Build entry with placeholder hash first for serialization
    placeholder = ProofChainEntry(
        entry_id=entry_input.entry_id,
        chain_id=chain.chain_id,
        sequence_number=len(chain.entries),
        timestamp=entry_input.timestamp,
        entry_type=entry_input.entry_type,
        entry_hash="",  # placeholder
        previous_hash=previous_hash,
        parent_entry_id=entry_input.parent_entry_id,
        model_id=entry_input.model_id,
        model_provider=entry_input.model_provider,
        input_hash=entry_input.input_hash,
        output_hash=entry_input.output_hash,
        input_token_count=entry_input.input_token_count,
        output_token_count=entry_input.output_token_count,
        decision_type=entry_input.decision_type,
        confidence_score=entry_input.confidence_score,
        reasoning_certificate_id=entry_input.reasoning_certificate_id,
        provenance_id=entry_input.provenance_id,
        session_id=entry_input.session_id,
        actor_id=entry_input.actor_id,
        policy_ids=entry_input.policy_ids,
        tags=entry_input.tags,
        annotation=entry_input.annotation,
        compliance_metadata=entry_input.compliance_metadata,
    )

    entry_hash = compute_entry_hash(placeholder)

    # Create the real entry with computed hash using object.__setattr__ since frozen
    real_entry = ProofChainEntry(
        entry_id=placeholder.entry_id,
        chain_id=placeholder.chain_id,
        sequence_number=placeholder.sequence_number,
        timestamp=placeholder.timestamp,
        entry_type=placeholder.entry_type,
        entry_hash=entry_hash,
        previous_hash=placeholder.previous_hash,
        parent_entry_id=placeholder.parent_entry_id,
        model_id=placeholder.model_id,
        model_provider=placeholder.model_provider,
        input_hash=placeholder.input_hash,
        output_hash=placeholder.output_hash,
        input_token_count=placeholder.input_token_count,
        output_token_count=placeholder.output_token_count,
        decision_type=placeholder.decision_type,
        confidence_score=placeholder.confidence_score,
        reasoning_certificate_id=placeholder.reasoning_certificate_id,
        provenance_id=placeholder.provenance_id,
        session_id=placeholder.session_id,
        actor_id=placeholder.actor_id,
        policy_ids=placeholder.policy_ids,
        tags=placeholder.tags,
        annotation=placeholder.annotation,
        compliance_metadata=placeholder.compliance_metadata,
    )
    return real_entry


def append_entry(
    chain: ChainState, entry_input: AppendEntryInput
) -> Result[tuple[ChainState, ProofChainEntry], ChainError]:
    """Append an entry to the chain and return the updated state with the new entry."""
    validation = _validate_append_input(chain, entry_input)
    if isinstance(validation, Err):
        return validation

    entry = _build_entry(chain, entry_input)
    new_chain = ChainState(
        chain_id=chain.chain_id,
        entries=chain.entries + (entry,),
    )
    return ok((new_chain, entry))


def get_last_entry(chain: ChainState) -> ProofChainEntry | None:
    """Get the last entry in the chain, or None if empty."""
    return chain.entries[-1] if chain.entries else None


def validate_entry(
    entry: ProofChainEntry, expected_previous_hash: str | None = ...,  # type: ignore[assignment]
) -> Result[None, ValidationError]:
    """Validate a single entry's hash against its content."""
    # Build a copy with empty hash for recomputation
    placeholder = ProofChainEntry(
        entry_id=entry.entry_id,
        chain_id=entry.chain_id,
        sequence_number=entry.sequence_number,
        timestamp=entry.timestamp,
        entry_type=entry.entry_type,
        entry_hash="",
        previous_hash=entry.previous_hash,
        parent_entry_id=entry.parent_entry_id,
        model_id=entry.model_id,
        model_provider=entry.model_provider,
        input_hash=entry.input_hash,
        output_hash=entry.output_hash,
        input_token_count=entry.input_token_count,
        output_token_count=entry.output_token_count,
        decision_type=entry.decision_type,
        confidence_score=entry.confidence_score,
        reasoning_certificate_id=entry.reasoning_certificate_id,
        provenance_id=entry.provenance_id,
        session_id=entry.session_id,
        actor_id=entry.actor_id,
        policy_ids=entry.policy_ids,
        tags=entry.tags,
        annotation=entry.annotation,
        compliance_metadata=entry.compliance_metadata,
    )
    recomputed_hash = compute_entry_hash(placeholder)

    if recomputed_hash != entry.entry_hash:
        return err(
            HashMismatch(
                entry_id=entry.entry_id,
                sequence_number=entry.sequence_number,
                expected_hash=entry.entry_hash,
                actual_hash=recomputed_hash,
            )
        )

    if expected_previous_hash is not ... and entry.previous_hash != expected_previous_hash:
        return err(
            PreviousHashMismatch(
                entry_id=entry.entry_id,
                sequence_number=entry.sequence_number,
                expected_previous_hash=expected_previous_hash,
                actual_previous_hash=entry.previous_hash,
            )
        )

    return ok(None)


def validate_chain(chain: ChainState) -> Result[None, ValidationError]:
    """Validate the entire chain: sequence numbers, chain IDs, hash integrity, and linkage."""
    if not chain.entries:
        return ok(None)

    for i, entry in enumerate(chain.entries):
        if entry.chain_id != chain.chain_id:
            return err(
                ChainIdMismatch(
                    entry_id=entry.entry_id,
                    expected_chain_id=chain.chain_id,
                    actual_chain_id=entry.chain_id,
                )
            )

        if entry.sequence_number != i:
            return err(
                SequenceNumberMismatch(
                    entry_id=entry.entry_id,
                    expected_sequence_number=i,
                    actual_sequence_number=entry.sequence_number,
                )
            )

        previous_entry = chain.entries[i - 1] if i > 0 else None
        expected_prev = previous_entry.entry_hash if previous_entry is not None else None
        result = validate_entry(entry, expected_prev)
        if isinstance(result, Err):
            return result

    return ok(None)
