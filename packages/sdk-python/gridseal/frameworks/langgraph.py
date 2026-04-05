"""LangGraph framework adapter that auto-captures graph node executions into a GridSeal proof chain."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from gridseal.core.chain import append_entry
from gridseal.core.hash import canonicalize, sha256
from gridseal.core.storage import StorageAdapter
from gridseal.core.types import (
    AppendEntryInput,
    ChainState,
    DecisionType,
    Err,
    Result,
    err,
    ok,
)


@dataclass(frozen=True, slots=True)
class CapturedNodeResult[TOutput]:
    """Result of a wrapped LangGraph node execution."""

    output: TOutput
    entry_id: str


@dataclass(frozen=True, slots=True)
class LangGraphCaptureError:
    """Error from the capture/audit process (the node function itself may have succeeded)."""

    type: str
    message: str


@dataclass(slots=True)
class GridSealLangGraph:
    """Wraps a LangGraph workflow to auto-capture node executions into a proof chain.

    Each call to a wrapped node creates an audit entry recording input hash,
    output hash, node name, and metadata.
    """

    chain_id: str
    storage: StorageAdapter
    _chain: ChainState = field(init=False)
    model_provider: str = "langgraph"
    session_id: str | None = None
    actor_id: str | None = None

    def __post_init__(self) -> None:
        self._chain = ChainState(chain_id=self.chain_id)

    def wrap_node[TInput, TOutput](
        self,
        name: str,
        fn: Callable[[TInput], Awaitable[TOutput]],
        *,
        decision_type: DecisionType | None = "generation",
        tags: dict[str, str] | None = None,
        annotation: str | None = None,
        parent_entry_id: str | None = None,
    ) -> Callable[[TInput], Awaitable[Result[CapturedNodeResult[TOutput], LangGraphCaptureError]]]:
        """Wrap a LangGraph node function to auto-capture its execution as an audit entry."""

        async def wrapped(
            input_data: TInput,
        ) -> Result[CapturedNodeResult[TOutput], LangGraphCaptureError]:
            input_hash = sha256(canonicalize(input_data))

            try:
                output = await fn(input_data)
            except Exception as exc:
                return err(LangGraphCaptureError(type="NODE_EXECUTION_ERROR", message=str(exc)))

            output_hash = sha256(canonicalize(output))

            entry_id = _generate_entry_id()
            timestamp = datetime.now(tz=timezone.utc).isoformat()

            entry_input = AppendEntryInput(
                entry_id=entry_id,
                timestamp=timestamp,
                entry_type="ai_decision",
                parent_entry_id=parent_entry_id,
                model_id=name,
                model_provider=self.model_provider,
                input_hash=input_hash,
                output_hash=output_hash,
                input_token_count=None,
                output_token_count=None,
                decision_type=decision_type,
                session_id=self.session_id,
                actor_id=self.actor_id,
                tags=tags if tags is not None else {},
                annotation=annotation,
            )

            result = append_entry(self._chain, entry_input)
            if isinstance(result, Err):
                return err(
                    LangGraphCaptureError(
                        type="CHAIN_APPEND_ERROR",
                        message=f"Failed to append entry: {result.error}",
                    )
                )

            new_chain, entry = result.value
            self._chain = new_chain

            store_result = await self.storage.put_entry(entry)
            if isinstance(store_result, Err):
                return err(
                    LangGraphCaptureError(
                        type="STORAGE_ERROR",
                        message=f"Failed to store entry: {store_result.error}",
                    )
                )

            return ok(CapturedNodeResult(output=output, entry_id=entry_id))

        return wrapped

    @property
    def chain(self) -> ChainState:
        """Access the current chain state."""
        return self._chain


def _generate_entry_id() -> str:
    """Generate a UUIDv7 for time-ordered entry IDs.

    Falls back to UUIDv4 if uuid7 is not available (Python <3.14).
    """
    try:
        return str(uuid.uuid7())
    except AttributeError:
        return str(uuid.uuid4())


def wrap_langgraph(
    *,
    chain_id: str,
    storage: StorageAdapter,
    model_provider: str = "langgraph",
    session_id: str | None = None,
    actor_id: str | None = None,
) -> GridSealLangGraph:
    """Create a GridSealLangGraph wrapper for capturing LangGraph node executions.

    Returns a GridSealLangGraph instance that records every node execution
    as a proof chain entry.
    """
    return GridSealLangGraph(
        chain_id=chain_id,
        storage=storage,
        model_provider=model_provider,
        session_id=session_id,
        actor_id=actor_id,
    )
