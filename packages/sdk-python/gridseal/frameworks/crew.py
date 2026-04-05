"""CrewAI-style framework adapter that auto-captures agent task executions into a GridSeal proof chain."""

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
class CapturedTaskResult[TOutput]:
    """Result of a wrapped crew task execution."""

    output: TOutput
    entry_id: str


@dataclass(frozen=True, slots=True)
class CrewCaptureError:
    """Error from the capture/audit process (the task function itself may have succeeded)."""

    type: str
    message: str


@dataclass(slots=True)
class GridSealCrew:
    """Wraps a crew workflow to auto-capture agent task executions into a proof chain.

    Each call to a wrapped task creates an audit entry recording the agent role,
    task name, input/output hashes, and metadata.
    """

    chain_id: str
    storage: StorageAdapter
    _chain: ChainState = field(init=False)
    model_provider: str = "crew"
    session_id: str | None = None
    actor_id: str | None = None

    def __post_init__(self) -> None:
        self._chain = ChainState(chain_id=self.chain_id)

    def wrap_task[TInput, TOutput](
        self,
        task_name: str,
        fn: Callable[[TInput], Awaitable[TOutput]],
        *,
        agent_role: str,
        decision_type: DecisionType | None = "generation",
        tags: dict[str, str] | None = None,
        annotation: str | None = None,
        parent_entry_id: str | None = None,
    ) -> Callable[[TInput], Awaitable[Result[CapturedTaskResult[TOutput], CrewCaptureError]]]:
        """Wrap a task function to auto-capture its execution as an audit entry.

        The agent_role is recorded as part of the entry metadata (model_id).
        """

        async def wrapped(
            input_data: TInput,
        ) -> Result[CapturedTaskResult[TOutput], CrewCaptureError]:
            input_payload: dict[str, Any] = {
                "task": task_name,
                "agentRole": agent_role,
                "input": input_data,
            }
            input_hash = sha256(canonicalize(input_payload))

            try:
                output = await fn(input_data)
            except Exception as exc:
                return err(CrewCaptureError(type="TASK_EXECUTION_ERROR", message=str(exc)))

            output_hash = sha256(canonicalize(output))

            entry_id = _generate_entry_id()
            timestamp = datetime.now(tz=timezone.utc).isoformat()

            merged_tags: dict[str, str] = {
                **(tags if tags is not None else {}),
                "agentRole": agent_role,
                "taskName": task_name,
            }

            entry_input = AppendEntryInput(
                entry_id=entry_id,
                timestamp=timestamp,
                entry_type="ai_decision",
                parent_entry_id=parent_entry_id,
                model_id=agent_role,
                model_provider=self.model_provider,
                input_hash=input_hash,
                output_hash=output_hash,
                input_token_count=None,
                output_token_count=None,
                decision_type=decision_type,
                session_id=self.session_id,
                actor_id=self.actor_id,
                tags=merged_tags,
                annotation=annotation,
            )

            result = append_entry(self._chain, entry_input)
            if isinstance(result, Err):
                return err(
                    CrewCaptureError(
                        type="CHAIN_APPEND_ERROR",
                        message=f"Failed to append entry: {result.error}",
                    )
                )

            new_chain, entry = result.value
            self._chain = new_chain

            store_result = await self.storage.put_entry(entry)
            if isinstance(store_result, Err):
                return err(
                    CrewCaptureError(
                        type="STORAGE_ERROR",
                        message=f"Failed to store entry: {store_result.error}",
                    )
                )

            return ok(CapturedTaskResult(output=output, entry_id=entry_id))

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


def wrap_crew(
    *,
    chain_id: str,
    storage: StorageAdapter,
    model_provider: str = "crew",
    session_id: str | None = None,
    actor_id: str | None = None,
) -> GridSealCrew:
    """Create a GridSealCrew wrapper for capturing agent task executions.

    Returns a GridSealCrew instance that records every task execution
    as a proof chain entry.
    """
    return GridSealCrew(
        chain_id=chain_id,
        storage=storage,
        model_provider=model_provider,
        session_id=session_id,
        actor_id=actor_id,
    )
