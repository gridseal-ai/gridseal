"""Tests for chain operations: create, append, validate."""

from gridseal.core.chain import (
    append_entry,
    create_chain,
    get_last_entry,
    validate_chain,
    validate_entry,
)
from gridseal.core.hash import compute_entry_hash
from gridseal.core.types import (
    AppendEntryInput,
    ChainState,
    Err,
    Ok,
    ProofChainEntry,
)


def _make_input(entry_id: str, **kwargs: object) -> AppendEntryInput:
    defaults = {
        "timestamp": "2026-04-04T12:00:00.000Z",
        "entry_type": "ai_decision",
    }
    defaults.update(kwargs)
    return AppendEntryInput(entry_id=entry_id, **defaults)  # type: ignore[arg-type]


class TestCreateChain:
    def test_creates_empty_chain(self) -> None:
        chain = create_chain("chain-001")
        assert chain.chain_id == "chain-001"
        assert chain.entries == ()

    def test_different_ids_create_different_chains(self) -> None:
        c1 = create_chain("chain-001")
        c2 = create_chain("chain-002")
        assert c1.chain_id != c2.chain_id


class TestAppendEntry:
    def test_appends_first_entry_with_null_previous_hash(self) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1"))
        assert isinstance(result, Ok)
        new_chain, entry = result.value
        assert entry.sequence_number == 0
        assert entry.previous_hash is None
        assert entry.chain_id == "chain-001"
        assert len(entry.entry_hash) == 64

    def test_second_entry_links_to_first_via_previous_hash(self) -> None:
        chain = create_chain("chain-001")
        r1 = append_entry(chain, _make_input("entry-1"))
        assert isinstance(r1, Ok)
        chain1, entry1 = r1.value

        r2 = append_entry(chain1, _make_input("entry-2"))
        assert isinstance(r2, Ok)
        _, entry2 = r2.value
        assert entry2.previous_hash == entry1.entry_hash
        assert entry2.sequence_number == 1

    def test_rejects_duplicate_entry_id(self) -> None:
        chain = create_chain("chain-001")
        r1 = append_entry(chain, _make_input("entry-1"))
        assert isinstance(r1, Ok)
        chain1 = r1.value[0]

        r2 = append_entry(chain1, _make_input("entry-1"))
        assert isinstance(r2, Err)
        assert r2.error.type == "DUPLICATE_ENTRY_ID"

    def test_rejects_nonexistent_parent(self) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1", parent_entry_id="ghost"))
        assert isinstance(result, Err)
        assert result.error.type == "PARENT_NOT_FOUND"

    def test_appends_with_tier2_fields(self) -> None:
        chain = create_chain("chain-001")
        result = append_entry(
            chain,
            _make_input(
                "entry-1",
                model_id="gpt-4o",
                model_provider="openai",
                input_token_count=100,
                output_token_count=200,
                decision_type="generation",
            ),
        )
        assert isinstance(result, Ok)
        _, entry = result.value
        assert entry.model_id == "gpt-4o"
        assert entry.model_provider == "openai"
        assert entry.input_token_count == 100
        assert entry.output_token_count == 200
        assert entry.decision_type == "generation"

    def test_chain_of_10_entries_maintains_integrity(self) -> None:
        chain = create_chain("chain-001")
        for i in range(10):
            result = append_entry(chain, _make_input(f"entry-{i}"))
            assert isinstance(result, Ok)
            chain = result.value[0]

        assert len(chain.entries) == 10
        for i, entry in enumerate(chain.entries):
            assert entry.sequence_number == i
            if i == 0:
                assert entry.previous_hash is None
            else:
                assert entry.previous_hash == chain.entries[i - 1].entry_hash

    def test_tree_structured_entries_with_parent(self) -> None:
        chain = create_chain("chain-001")
        r1 = append_entry(chain, _make_input("root"))
        assert isinstance(r1, Ok)
        chain, root = r1.value

        r2 = append_entry(chain, _make_input("child-1", parent_entry_id="root"))
        assert isinstance(r2, Ok)
        chain, child1 = r2.value
        assert child1.parent_entry_id == "root"

        r3 = append_entry(chain, _make_input("child-2", parent_entry_id="root"))
        assert isinstance(r3, Ok)
        chain, child2 = r3.value
        assert child2.parent_entry_id == "root"


class TestGetLastEntry:
    def test_returns_none_for_empty_chain(self) -> None:
        chain = create_chain("chain-001")
        assert get_last_entry(chain) is None

    def test_returns_last_entry(self) -> None:
        chain = create_chain("chain-001")
        for i in range(3):
            result = append_entry(chain, _make_input(f"entry-{i}"))
            assert isinstance(result, Ok)
            chain = result.value[0]
        last = get_last_entry(chain)
        assert last is not None
        assert last.entry_id == "entry-2"


class TestValidateEntry:
    def test_valid_entry_passes(self) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1"))
        assert isinstance(result, Ok)
        _, entry = result.value

        validation = validate_entry(entry)
        assert isinstance(validation, Ok)

    def test_tampered_entry_fails(self) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1"))
        assert isinstance(result, Ok)
        _, entry = result.value

        # Tamper with the entry by changing the timestamp
        tampered = ProofChainEntry(
            entry_id=entry.entry_id,
            chain_id=entry.chain_id,
            sequence_number=entry.sequence_number,
            timestamp="2026-04-04T13:00:00.000Z",
            entry_type=entry.entry_type,
            entry_hash=entry.entry_hash,
            previous_hash=entry.previous_hash,
            parent_entry_id=entry.parent_entry_id,
        )
        validation = validate_entry(tampered)
        assert isinstance(validation, Err)
        assert validation.error.type == "HASH_MISMATCH"

    def test_previous_hash_mismatch_detected(self) -> None:
        chain = create_chain("chain-001")
        r1 = append_entry(chain, _make_input("entry-1"))
        assert isinstance(r1, Ok)
        _, entry = r1.value

        validation = validate_entry(entry, "wrong-hash")
        assert isinstance(validation, Err)
        assert validation.error.type == "PREVIOUS_HASH_MISMATCH"


class TestValidateChain:
    def test_empty_chain_is_valid(self) -> None:
        chain = create_chain("chain-001")
        assert isinstance(validate_chain(chain), Ok)

    def test_single_entry_chain_is_valid(self) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1"))
        assert isinstance(result, Ok)
        chain = result.value[0]
        assert isinstance(validate_chain(chain), Ok)

    def test_multi_entry_chain_is_valid(self) -> None:
        chain = create_chain("chain-001")
        for i in range(5):
            result = append_entry(chain, _make_input(f"entry-{i}"))
            assert isinstance(result, Ok)
            chain = result.value[0]
        assert isinstance(validate_chain(chain), Ok)

    def test_detects_tampered_entry_in_middle_of_chain(self) -> None:
        chain = create_chain("chain-001")
        for i in range(5):
            result = append_entry(chain, _make_input(f"entry-{i}"))
            assert isinstance(result, Ok)
            chain = result.value[0]

        # Tamper with entry at index 2
        entries = list(chain.entries)
        original = entries[2]
        tampered = ProofChainEntry(
            entry_id=original.entry_id,
            chain_id=original.chain_id,
            sequence_number=original.sequence_number,
            timestamp="1999-01-01T00:00:00.000Z",
            entry_type=original.entry_type,
            entry_hash=original.entry_hash,
            previous_hash=original.previous_hash,
            parent_entry_id=original.parent_entry_id,
        )
        entries[2] = tampered
        tampered_chain = ChainState(chain_id=chain.chain_id, entries=tuple(entries))

        validation = validate_chain(tampered_chain)
        assert isinstance(validation, Err)
        assert validation.error.type == "HASH_MISMATCH"
        assert validation.error.entry_id == original.entry_id
