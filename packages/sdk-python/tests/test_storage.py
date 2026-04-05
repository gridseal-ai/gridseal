"""Tests for the in-memory storage adapter."""

import pytest

from gridseal.core.chain import append_entry, create_chain
from gridseal.core.storage import InMemoryAdapter
from gridseal.core.types import AppendEntryInput, Err, Ok


def _make_input(entry_id: str, **kwargs: object) -> AppendEntryInput:
    defaults = {
        "timestamp": "2026-04-04T12:00:00.000Z",
        "entry_type": "ai_decision",
    }
    defaults.update(kwargs)
    return AppendEntryInput(entry_id=entry_id, **defaults)  # type: ignore[arg-type]


@pytest.fixture
def storage() -> InMemoryAdapter:
    return InMemoryAdapter()


class TestInMemoryAdapter:
    async def test_put_and_get_entry(self, storage: InMemoryAdapter) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1"))
        assert isinstance(result, Ok)
        _, entry = result.value

        put_result = await storage.put_entry(entry)
        assert isinstance(put_result, Ok)

        get_result = await storage.get_entry("entry-1")
        assert isinstance(get_result, Ok)
        assert get_result.value.entry_id == "entry-1"
        assert get_result.value.entry_hash == entry.entry_hash

    async def test_rejects_duplicate_entry(self, storage: InMemoryAdapter) -> None:
        chain = create_chain("chain-001")
        result = append_entry(chain, _make_input("entry-1"))
        assert isinstance(result, Ok)
        _, entry = result.value

        await storage.put_entry(entry)
        dup_result = await storage.put_entry(entry)
        assert isinstance(dup_result, Err)
        assert dup_result.error.type == "DUPLICATE_ENTRY"

    async def test_get_nonexistent_entry_returns_error(self, storage: InMemoryAdapter) -> None:
        result = await storage.get_entry("ghost")
        assert isinstance(result, Err)
        assert result.error.type == "ENTRY_NOT_FOUND"

    async def test_get_entries_by_chain_id_returns_sorted(self, storage: InMemoryAdapter) -> None:
        chain = create_chain("chain-001")
        for i in range(5):
            r = append_entry(chain, _make_input(f"entry-{i}"))
            assert isinstance(r, Ok)
            chain, entry = r.value
            await storage.put_entry(entry)

        entries = await storage.get_entries_by_chain_id("chain-001")
        assert len(entries) == 5
        for i, entry in enumerate(entries):
            assert entry.sequence_number == i

    async def test_get_entries_by_unknown_chain_returns_empty(
        self, storage: InMemoryAdapter
    ) -> None:
        entries = await storage.get_entries_by_chain_id("unknown")
        assert entries == ()

    async def test_get_chain_length(self, storage: InMemoryAdapter) -> None:
        chain = create_chain("chain-001")
        for i in range(3):
            r = append_entry(chain, _make_input(f"entry-{i}"))
            assert isinstance(r, Ok)
            chain, entry = r.value
            await storage.put_entry(entry)

        length = await storage.get_chain_length("chain-001")
        assert length == 3

    async def test_get_chain_length_unknown_returns_zero(
        self, storage: InMemoryAdapter
    ) -> None:
        length = await storage.get_chain_length("unknown")
        assert length == 0

    async def test_list_chain_ids(self, storage: InMemoryAdapter) -> None:
        for cid in ("chain-a", "chain-b"):
            chain = create_chain(cid)
            r = append_entry(chain, _make_input(f"entry-{cid}"))
            assert isinstance(r, Ok)
            await storage.put_entry(r.value[1])

        ids = await storage.list_chain_ids()
        assert set(ids) == {"chain-a", "chain-b"}

    async def test_clear_removes_all_data(self, storage: InMemoryAdapter) -> None:
        chain = create_chain("chain-001")
        r = append_entry(chain, _make_input("entry-1"))
        assert isinstance(r, Ok)
        await storage.put_entry(r.value[1])

        await storage.clear()
        assert await storage.get_chain_length("chain-001") == 0
        assert await storage.list_chain_ids() == ()
