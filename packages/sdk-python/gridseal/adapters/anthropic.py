"""Anthropic SDK wrapper that auto-captures AI decisions into a GridSeal proof chain."""

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
    from anthropic import AsyncAnthropic
    from anthropic.types import Message
except ImportError as exc:
    raise ImportError(
        "The anthropic package is required for the Anthropic adapter. "
        "Install it with: pip install gridseal-sdk[anthropic]"
    ) from exc


@dataclass(frozen=True, slots=True)
class CapturedMessage:
    """Result of a wrapped Anthropic call, containing both the response and the audit entry ID."""

    message: Message
    entry_id: str


@dataclass(frozen=True, slots=True)
class CaptureError:
    """Error from the capture/audit process (the Anthropic call itself succeeded)."""

    type: str
    message: str


@dataclass(slots=True)
class GridSealAnthropic:
    """Wraps an AsyncAnthropic client to auto-capture message completions into a proof chain.

    Each call to create_message captures the input, output, model info, and token
    counts into a new proof chain entry stored via the configured storage adapter.
    """

    client: AsyncAnthropic
    chain_id: str
    storage: StorageAdapter
    _chain: ChainState = field(init=False)
    session_id: str | None = None
    actor_id: str | None = None

    def __post_init__(self) -> None:
        self._chain = ChainState(chain_id=self.chain_id)

    async def create_message(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 1024,
        decision_type: DecisionType | None = "generation",
        tags: dict[str, str] | None = None,
        annotation: str | None = None,
        parent_entry_id: str | None = None,
        **kwargs: Any,  # noqa: ANN401
    ) -> Result[CapturedMessage, CaptureError]:
        """Make an Anthropic messages API call and auto-capture an audit entry.

        All extra keyword arguments are forwarded to the Anthropic API.
        """
        input_payload: dict[str, Any] = {
            "messages": messages,
            "model": model,
            "max_tokens": max_tokens,
            **kwargs,
        }
        input_hash = sha256(canonicalize(input_payload))

        try:
            response = await self.client.messages.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                **kwargs,
            )
        except Exception as exc:
            return err(CaptureError(type="ANTHROPIC_API_ERROR", message=str(exc)))

        output_data = _extract_message_data(response)
        output_hash = sha256(canonicalize(output_data["content"]))

        entry_id = _generate_entry_id()
        timestamp = datetime.now(tz=timezone.utc).isoformat()

        entry_input = AppendEntryInput(
            entry_id=entry_id,
            timestamp=timestamp,
            entry_type="ai_decision",
            parent_entry_id=parent_entry_id,
            model_id=response.model,
            model_provider="anthropic",
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

        store_result = await self.storage.put_entry(entry)
        if isinstance(store_result, Err):
            return err(
                CaptureError(
                    type="STORAGE_ERROR",
                    message=f"Failed to store entry: {store_result.error}",
                )
            )

        return ok(CapturedMessage(message=response, entry_id=entry_id))

    @property
    def chain(self) -> ChainState:
        """Access the current chain state."""
        return self._chain


def _extract_message_data(message: Message) -> dict[str, Any]:
    """Extract relevant data from an Anthropic Message response."""
    content: str | None = None
    if message.content:
        text_blocks = [block.text for block in message.content if block.type == "text"]
        if text_blocks:
            content = text_blocks[0] if len(text_blocks) == 1 else "\n".join(text_blocks)

    input_tokens: int | None = None
    output_tokens: int | None = None
    if message.usage is not None:
        input_tokens = message.usage.input_tokens
        output_tokens = message.usage.output_tokens

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


def wrap_anthropic(
    client: AsyncAnthropic,
    *,
    chain_id: str,
    storage: StorageAdapter,
    session_id: str | None = None,
    actor_id: str | None = None,
) -> GridSealAnthropic:
    """Wrap an AsyncAnthropic client for auto-capture of AI decisions.

    Returns a GridSealAnthropic instance that records every message
    as a proof chain entry.
    """
    return GridSealAnthropic(
        client=client,
        chain_id=chain_id,
        storage=storage,
        session_id=session_id,
        actor_id=actor_id,
    )
