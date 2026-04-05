"""OpenAI SDK wrapper that auto-captures AI decisions into a GridSeal proof chain."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from gridseal.core.chain import append_entry
from gridseal.core.hash import canonicalize, sha256
from gridseal.core.storage import StorageAdapter
from gridseal.core.types import (
    AppendEntryInput,
    ChainState,
    DecisionType,
    Err,
    Ok,
    Result,
    err,
    ok,
)

try:
    from openai import AsyncOpenAI
    from openai.types.chat import ChatCompletion
except ImportError:
    AsyncOpenAI = None  # type: ignore[assignment,misc]
    ChatCompletion = None  # type: ignore[assignment,misc]


@dataclass(frozen=True, slots=True)
class CapturedCompletion:
    """Result of a wrapped OpenAI call, containing both the response and the audit entry ID."""

    completion: ChatCompletion
    entry_id: str


@dataclass(frozen=True, slots=True)
class CaptureError:
    """Error from the capture/audit process (the OpenAI call itself succeeded)."""

    type: str
    message: str


@dataclass(slots=True)
class GridSealOpenAI:
    """Wraps an AsyncOpenAI client to auto-capture chat completions into a proof chain.

    Each call to create_completion captures the input, output, model info, and token
    counts into a new proof chain entry stored via the configured storage adapter.
    """

    client: AsyncOpenAI
    chain_id: str
    storage: StorageAdapter
    _chain: ChainState = field(init=False)
    session_id: str | None = None
    actor_id: str | None = None

    def __post_init__(self) -> None:
        self._chain = ChainState(chain_id=self.chain_id)

    async def create_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str = "gpt-4o",
        decision_type: DecisionType | None = "generation",
        tags: dict[str, str] | None = None,
        annotation: str | None = None,
        parent_entry_id: str | None = None,
        **kwargs: Any,  # noqa: ANN401
    ) -> Result[CapturedCompletion, CaptureError]:
        """Make an OpenAI chat completion call and auto-capture an audit entry.

        All extra keyword arguments are forwarded to the OpenAI API.
        """
        # Compute input hash from the canonical form of the messages
        input_payload = {"messages": messages, "model": model, **kwargs}
        input_hash = sha256(canonicalize(input_payload))

        # Make the actual OpenAI API call
        try:
            completion = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                **kwargs,
            )
        except Exception as exc:
            return err(CaptureError(type="OPENAI_API_ERROR", message=str(exc)))

        # Extract output data
        output_data = _extract_completion_data(completion)
        output_hash = sha256(canonicalize(output_data["content"]))

        # Build the audit entry
        entry_id = _generate_entry_id()
        timestamp = datetime.now(tz=timezone.utc).isoformat()

        entry_input = AppendEntryInput(
            entry_id=entry_id,
            timestamp=timestamp,
            entry_type="ai_decision",
            parent_entry_id=parent_entry_id,
            model_id=completion.model,
            model_provider="openai",
            input_hash=input_hash,
            output_hash=output_hash,
            input_token_count=output_data["input_tokens"],
            output_token_count=output_data["output_tokens"],
            decision_type=decision_type,
            session_id=self.session_id,
            actor_id=self.actor_id,
            tags=tags if tags is not None else {},
            annotation=annotation,
        )

        result = append_entry(self._chain, entry_input)
        if isinstance(result, Err):
            return err(
                CaptureError(
                    type="CHAIN_APPEND_ERROR",
                    message=f"Failed to append entry: {result.error}",
                )
            )

        new_chain, entry = result.value
        self._chain = new_chain

        # Persist to storage
        store_result = await self.storage.put_entry(entry)
        if isinstance(store_result, Err):
            return err(
                CaptureError(
                    type="STORAGE_ERROR",
                    message=f"Failed to store entry: {store_result.error}",
                )
            )

        return ok(CapturedCompletion(completion=completion, entry_id=entry_id))

    @property
    def chain(self) -> ChainState:
        """Access the current chain state."""
        return self._chain


def _extract_completion_data(completion: ChatCompletion) -> dict[str, Any]:
    """Extract relevant data from an OpenAI ChatCompletion response."""
    content: str | None = None
    if completion.choices:
        message = completion.choices[0].message
        content = message.content

    input_tokens: int | None = None
    output_tokens: int | None = None
    if completion.usage is not None:
        input_tokens = completion.usage.prompt_tokens
        output_tokens = completion.usage.completion_tokens

    return {
        "content": content,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }


def _generate_entry_id() -> str:
    """Generate a UUIDv7 for time-ordered entry IDs.

    Falls back to UUIDv4 if uuid7 is not available (Python <3.14).
    """
    try:
        return str(uuid.uuid7())
    except AttributeError:
        return str(uuid.uuid4())


def wrap_openai(
    client: AsyncOpenAI,
    *,
    chain_id: str,
    storage: StorageAdapter,
    session_id: str | None = None,
    actor_id: str | None = None,
) -> GridSealOpenAI:
    """Wrap an AsyncOpenAI client for auto-capture of AI decisions.

    Returns a GridSealOpenAI instance that records every chat completion
    as a proof chain entry.
    """
    if AsyncOpenAI is None:
        raise ImportError(
            "The openai package is required for the OpenAI adapter. "
            "Install it with: pip install gridseal-sdk[openai]"
        )
    return GridSealOpenAI(
        client=client,
        chain_id=chain_id,
        storage=storage,
        session_id=session_id,
        actor_id=actor_id,
    )
