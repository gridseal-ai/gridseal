"""Tests for the Anthropic SDK wrapper with auto-capture."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gridseal.core.chain import validate_chain
from gridseal.core.hash import canonicalize, sha256
from gridseal.core.storage import InMemoryAdapter
from gridseal.core.types import Err, Ok


@dataclass
class MockTextBlock:
    type: str = "text"
    text: str = "Hello! How can I help you?"


@dataclass
class MockToolUseBlock:
    type: str = "tool_use"
    id: str = "tool-1"
    name: str = "get_weather"
    input: dict[str, Any] = field(default_factory=lambda: {"location": "NYC"})


@dataclass
class MockUsage:
    input_tokens: int = 30
    output_tokens: int = 20


@dataclass
class MockMessage:
    id: str = "msg_abc123"
    type: str = "message"
    role: str = "assistant"
    model: str = "claude-sonnet-4-20250514"
    content: list[MockTextBlock] = field(default_factory=lambda: [MockTextBlock()])
    usage: MockUsage | None = field(default_factory=MockUsage)
    stop_reason: str = "end_turn"


def _make_mock_client(message: MockMessage | None = None) -> Any:
    """Create a mock AsyncAnthropic client that returns the given message."""
    mock_client = MagicMock()
    mock_create = AsyncMock(return_value=message or MockMessage())
    mock_client.messages = MagicMock()
    mock_client.messages.create = mock_create
    return mock_client


@pytest.fixture
def storage() -> InMemoryAdapter:
    return InMemoryAdapter()


class TestGridSealAnthropic:
    """Test suite for the Anthropic adapter auto-capture functionality."""

    async def test_captures_message_as_audit_entry(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            result = await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        assert isinstance(result, Ok)
        captured = result.value
        assert captured.message.model == "claude-sonnet-4-20250514"
        assert len(captured.entry_id) > 0

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert len(stored) == 1
        entry = stored[0]
        assert entry.entry_type == "ai_decision"
        assert entry.model_id == "claude-sonnet-4-20250514"
        assert entry.model_provider == "anthropic"
        assert entry.input_token_count == 30
        assert entry.output_token_count == 20
        assert entry.decision_type == "generation"

    async def test_captures_input_hash_from_messages(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            messages = [{"role": "user", "content": "Hello"}]
            await wrapped.create_message(messages=messages, model="claude-sonnet-4-20250514")

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_input_hash = sha256(
            canonicalize({
                "messages": messages,
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
            })
        )
        assert entry.input_hash == expected_input_hash

    async def test_captures_output_hash_from_response(self, storage: InMemoryAdapter) -> None:
        message = MockMessage(
            content=[MockTextBlock(text="Test response")]
        )
        mock_client = _make_mock_client(message)

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hi"}],
                model="claude-sonnet-4-20250514",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        expected_output_hash = sha256(canonicalize("Test response"))
        assert entry.output_hash == expected_output_hash

    async def test_multiple_calls_build_valid_chain(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            for i in range(5):
                result = await wrapped.create_message(
                    messages=[{"role": "user", "content": f"Message {i}"}],
                    model="claude-sonnet-4-20250514",
                )
                assert isinstance(result, Ok)

        chain = wrapped.chain
        assert len(chain.entries) == 5
        validation = validate_chain(chain)
        assert isinstance(validation, Ok)

        for i in range(1, 5):
            assert chain.entries[i].previous_hash == chain.entries[i - 1].entry_hash

    async def test_session_id_and_actor_id_propagate(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
                session_id="session-42",
                actor_id="user-7",
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.session_id == "session-42"
        assert entry.actor_id == "user-7"

    async def test_custom_tags_and_annotation(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
                tags={"env": "test", "team": "ml"},
                annotation="Test call",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.tags == {"env": "test", "team": "ml"}
        assert entry.annotation == "Test call"

    async def test_custom_decision_type(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Classify this"}],
                model="claude-sonnet-4-20250514",
                decision_type="classification",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].decision_type == "classification"

    async def test_parent_entry_id_for_tree_structure(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            r1 = await wrapped.create_message(
                messages=[{"role": "user", "content": "Root call"}],
                model="claude-sonnet-4-20250514",
            )
            assert isinstance(r1, Ok)
            root_id = r1.value.entry_id

            r2 = await wrapped.create_message(
                messages=[{"role": "user", "content": "Child call"}],
                model="claude-sonnet-4-20250514",
                parent_entry_id=root_id,
            )
            assert isinstance(r2, Ok)

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[1].parent_entry_id == root_id

    async def test_handles_anthropic_api_error(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()
        mock_client.messages.create = AsyncMock(
            side_effect=ConnectionError("Connection refused")
        )

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            result = await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        assert isinstance(result, Err)
        assert result.error.type == "ANTHROPIC_API_ERROR"
        assert "Connection refused" in result.error.message

    async def test_handles_null_usage(self, storage: InMemoryAdapter) -> None:
        message = MockMessage(usage=None)
        object.__setattr__(message, "usage", None)
        mock_client = _make_mock_client(message)

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            result = await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        assert isinstance(result, Ok)
        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].input_token_count is None
        assert stored[0].output_token_count is None

    async def test_forwards_extra_kwargs_to_anthropic(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
                temperature=0.7,
                system="You are a helpful assistant.",
            )

        mock_client.messages.create.assert_called_once_with(
            model="claude-sonnet-4-20250514",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=1024,
            temperature=0.7,
            system="You are a helpful assistant.",
        )

    async def test_system_param_included_in_input_hash(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            messages = [{"role": "user", "content": "Hello"}]
            await wrapped.create_message(
                messages=messages,
                model="claude-sonnet-4-20250514",
                system="You are a pirate.",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_input_hash = sha256(
            canonicalize({
                "messages": messages,
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "system": "You are a pirate.",
            })
        )
        assert entry.input_hash == expected_input_hash

    async def test_entry_hash_is_valid_sha256(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert len(entry.entry_hash) == 64
        assert all(c in "0123456789abcdef" for c in entry.entry_hash)

    async def test_multiple_text_blocks_concatenated(self, storage: InMemoryAdapter) -> None:
        message = MockMessage(
            content=[
                MockTextBlock(text="First paragraph."),
                MockTextBlock(text="Second paragraph."),
            ]
        )
        mock_client = _make_mock_client(message)

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        expected = sha256(canonicalize("First paragraph.\nSecond paragraph."))
        assert entry.output_hash == expected

    async def test_tool_use_blocks_ignored_for_text_extraction(
        self, storage: InMemoryAdapter
    ) -> None:
        message = MockMessage(
            content=[
                MockTextBlock(text="Let me check the weather."),
                MockToolUseBlock(),
            ]
        )
        mock_client = _make_mock_client(message)

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "What is the weather?"}],
                model="claude-sonnet-4-20250514",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        expected = sha256(canonicalize("Let me check the weather."))
        assert entry.output_hash == expected

    async def test_empty_content_produces_null_output_hash(
        self, storage: InMemoryAdapter
    ) -> None:
        message = MockMessage(content=[])
        mock_client = _make_mock_client(message)

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        expected = sha256(canonicalize(None))
        assert entry.output_hash == expected

    async def test_custom_max_tokens(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_message(
                messages=[{"role": "user", "content": "Hello"}],
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
            )

        mock_client.messages.create.assert_called_once_with(
            model="claude-sonnet-4-20250514",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=4096,
        )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        expected_input_hash = sha256(
            canonicalize({
                "messages": [{"role": "user", "content": "Hello"}],
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 4096,
            })
        )
        assert entry.input_hash == expected_input_hash


class TestWrapAnthropic:
    """Tests for the wrap_anthropic convenience function."""

    def test_returns_gridseal_anthropic_instance(self) -> None:
        mock_client = _make_mock_client()
        storage = InMemoryAdapter()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import GridSealAnthropic, wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            assert isinstance(wrapped, GridSealAnthropic)

    def test_passes_session_and_actor(self) -> None:
        mock_client = _make_mock_client()
        storage = InMemoryAdapter()

        with patch("gridseal.adapters.anthropic.AsyncAnthropic", new=type(mock_client)):
            from gridseal.adapters.anthropic import wrap_anthropic

            wrapped = wrap_anthropic(
                mock_client,
                chain_id="test-chain",
                storage=storage,
                session_id="s1",
                actor_id="a1",
            )
            assert wrapped.session_id == "s1"
            assert wrapped.actor_id == "a1"
