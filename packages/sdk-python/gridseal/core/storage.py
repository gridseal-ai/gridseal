"""Storage adapter protocol and in-memory implementation."""

from __future__ import annotations

from typing import Protocol

from gridseal.core.types import (
    Err,
    Ok,
    ProofChainEntry,
    Result,
    StorageDuplicateEntry,
    StorageEntryNotFound,
    StorageError,
    err,
    ok,
)


class StorageAdapter(Protocol):
    """Protocol for persistent storage of proof chain entries."""

    async def put_entry(
        self, entry: ProofChainEntry
    ) -> Result[ProofChainEntry, StorageError]: ...

    async def get_entry(
        self, entry_id: str
    ) -> Result[ProofChainEntry, StorageError]: ...

    async def get_entries_by_chain_id(
        self, chain_id: str
    ) -> tuple[ProofChainEntry, ...]: ...

    async def get_chain_length(self, chain_id: str) -> int: ...

    async def list_chain_ids(self) -> tuple[str, ...]: ...

    async def clear(self) -> None: ...


class InMemoryAdapter:
    """In-memory storage adapter backed by dicts."""

    def __init__(self) -> None:
        self._entries: dict[str, ProofChainEntry] = {}
        self._chain_index: dict[str, list[str]] = {}

    async def put_entry(
        self, entry: ProofChainEntry
    ) -> Result[ProofChainEntry, StorageError]:
        if entry.entry_id in self._entries:
            return err(StorageDuplicateEntry(entry_id=entry.entry_id))
        self._entries[entry.entry_id] = entry
        chain_entries = self._chain_index.get(entry.chain_id)
        if chain_entries is not None:
            chain_entries.append(entry.entry_id)
        else:
            self._chain_index[entry.chain_id] = [entry.entry_id]
        return ok(entry)

    async def get_entry(
        self, entry_id: str
    ) -> Result[ProofChainEntry, StorageError]:
        entry = self._entries.get(entry_id)
        if entry is None:
            return err(StorageEntryNotFound(entry_id=entry_id))
        return ok(entry)

    async def get_entries_by_chain_id(
        self, chain_id: str
    ) -> tuple[ProofChainEntry, ...]:
        entry_ids = self._chain_index.get(chain_id)
        if entry_ids is None:
            return ()
        entries = []
        for eid in entry_ids:
            entry = self._entries.get(eid)
            if entry is not None:
                entries.append(entry)
        entries.sort(key=lambda e: e.sequence_number)
        return tuple(entries)

    async def get_chain_length(self, chain_id: str) -> int:
        entry_ids = self._chain_index.get(chain_id)
        return len(entry_ids) if entry_ids is not None else 0

    async def list_chain_ids(self) -> tuple[str, ...]:
        return tuple(self._chain_index.keys())

    async def clear(self) -> None:
        self._entries.clear()
        self._chain_index.clear()
