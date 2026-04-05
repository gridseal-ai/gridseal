"""Tests for the OpenAI SDK wrapper with auto-capture."""

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
class MockUsage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class MockMessage:
    role: str = "assistant"
    content: str | None = "Hello! How can I help you?"


@dataclass
class MockChoice:
    index: int = 0
    message: MockMessage = field(default_factory=MockMessage)
    finish_reason: str = "stop"


@dataclass
class MockChatCompletion:
    id: str = "chatcmpl-abc123"
    model: str = "gpt-4o-2024-05-13"
    choices: list[MockChoice] = field(default_factory=lambda: [MockChoice()])
    usage: MockUsage | None = field(
        default_factory=lambda: MockUsage(prompt_tokens=25, completion_tokens=15, total_tokens=40)
    )


def _make_mock_client(completion: MockChatCompletion | None = None) -> Any:
    """Create a mock AsyncOpenAI client that returns the given completion."""
    mock_client = MagicMock()
    mock_create = AsyncMock(return_value=completion or MockChatCompletion())
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = mock_create
    return mock_client


@pytest.fixture
def storage() -> InMemoryAdapter:
    return InMemoryAdapter()


class TestGridSealOpenAI:
    """Test suite for the OpenAI adapter auto-capture functionality."""

    async def test_captures_chat_completion_as_audit_entry(
        self, storage: InMemoryAdapter
    ) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            result = await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
            )

        assert isinstance(result, Ok)
        captured = result.value
        assert captured.completion.model == "gpt-4o-2024-05-13"
        assert len(captured.entry_id) > 0

        # Verify entry was stored
        stored = await storage.get_entries_by_chain_id("test-chain")
        assert len(stored) == 1
        entry = stored[0]
        assert entry.entry_type == "ai_decision"
        assert entry.model_id == "gpt-4o-2024-05-13"
        assert entry.model_provider == "openai"
        assert entry.input_token_count == 25
        assert entry.output_token_count == 15
        assert entry.decision_type == "generation"

    async def test_captures_input_hash_from_messages(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            messages = [{"role": "user", "content": "Hello"}]
            await wrapped.create_completion(messages=messages, model="gpt-4o")

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_input_hash = sha256(
            canonicalize({"messages": messages, "model": "gpt-4o"})
        )
        assert entry.input_hash == expected_input_hash

    async def test_captures_output_hash_from_response(self, storage: InMemoryAdapter) -> None:
        completion = MockChatCompletion(
            choices=[MockChoice(message=MockMessage(content="Test response"))]
        )
        mock_client = _make_mock_client(completion)

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hi"}],
                model="gpt-4o",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        expected_output_hash = sha256(canonicalize("Test response"))
        assert entry.output_hash == expected_output_hash

    async def test_multiple_calls_build_valid_chain(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            for i in range(5):
                result = await wrapped.create_completion(
                    messages=[{"role": "user", "content": f"Message {i}"}],
                    model="gpt-4o",
                )
                assert isinstance(result, Ok)

        # Verify chain integrity
        chain = wrapped.chain
        assert len(chain.entries) == 5
        validation = validate_chain(chain)
        assert isinstance(validation, Ok)

        # Verify hash linking
        for i in range(1, 5):
            assert chain.entries[i].previous_hash == chain.entries[i - 1].entry_hash

    async def test_session_id_and_actor_id_propagate(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
                session_id="session-42",
                actor_id="user-7",
            )
            await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.session_id == "session-42"
        assert entry.actor_id == "user-7"

    async def test_custom_tags_and_annotation(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
                tags={"env": "test", "team": "ml"},
                annotation="Test call",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.tags == {"env": "test", "team": "ml"}
        assert entry.annotation == "Test call"

    async def test_custom_decision_type(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_completion(
                messages=[{"role": "user", "content": "Classify this"}],
                model="gpt-4o",
                decision_type="classification",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].decision_type == "classification"

    async def test_parent_entry_id_for_tree_structure(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )

            r1 = await wrapped.create_completion(
                messages=[{"role": "user", "content": "Root call"}],
                model="gpt-4o",
            )
            assert isinstance(r1, Ok)
            root_id = r1.value.entry_id

            r2 = await wrapped.create_completion(
                messages=[{"role": "user", "content": "Child call"}],
                model="gpt-4o",
                parent_entry_id=root_id,
            )
            assert isinstance(r2, Ok)

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[1].parent_entry_id == root_id

    async def test_handles_openai_api_error(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()
        mock_client.chat.completions.create = AsyncMock(
            side_effect=ConnectionError("Connection refused")
        )

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            result = await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
            )

        assert isinstance(result, Err)
        assert result.error.type == "OPENAI_API_ERROR"
        assert "Connection refused" in result.error.message

    async def test_handles_null_usage(self, storage: InMemoryAdapter) -> None:
        completion = MockChatCompletion(usage=None)
        # Need to override __post_init__ default
        object.__setattr__(completion, "usage", None)
        mock_client = _make_mock_client(completion)

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            result = await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
            )

        assert isinstance(result, Ok)
        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].input_token_count is None
        assert stored[0].output_token_count is None

    async def test_forwards_extra_kwargs_to_openai(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
                temperature=0.7,
                max_tokens=100,
            )

        mock_client.chat.completions.create.assert_called_once_with(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.7,
            max_tokens=100,
        )

    async def test_entry_hash_is_valid_sha256(self, storage: InMemoryAdapter) -> None:
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            await wrapped.create_completion(
                messages=[{"role": "user", "content": "Hello"}],
                model="gpt-4o",
            )

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert len(entry.entry_hash) == 64
        assert all(c in "0123456789abcdef" for c in entry.entry_hash)


class TestWrapOpenAI:
    """Tests for the wrap_openai convenience function."""

    def test_returns_gridseal_openai_instance(self) -> None:
        mock_client = _make_mock_client()
        storage = InMemoryAdapter()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import GridSealOpenAI, wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
            )
            assert isinstance(wrapped, GridSealOpenAI)

    def test_passes_session_and_actor(self) -> None:
        mock_client = _make_mock_client()
        storage = InMemoryAdapter()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="test-chain",
                storage=storage,
                session_id="s1",
                actor_id="a1",
            )
            assert wrapped.session_id == "s1"
            assert wrapped.actor_id == "a1"


class TestGridSealOpenAIOverhead:
    """Verify SDK wrapper adds less than 2ms overhead per call."""

    async def test_adds_less_than_2ms_overhead_per_call(self) -> None:
        import time

        storage = InMemoryAdapter()
        mock_client = _make_mock_client()

        with patch("gridseal.adapters.openai.AsyncOpenAI", new=type(mock_client)):
            from gridseal.adapters.openai import wrap_openai

            wrapped = wrap_openai(
                mock_client,
                chain_id="bench-chain",
                storage=storage,
            )

            # Warm up
            for i in range(10):
                await wrapped.create_completion(
                    messages=[{"role": "user", "content": f"Warmup {i}"}],
                )

            # Measure 200 calls (p99 at index 198, tolerates 2 outliers)
            times: list[float] = []
            for i in range(200):
                start = time.perf_counter()
                await wrapped.create_completion(
                    messages=[{"role": "user", "content": f"Bench {i}"}],
                )
                elapsed_ms = (time.perf_counter() - start) * 1000
                times.append(elapsed_ms)

            times.sort()
            p99 = times[int(len(times) * 0.99)]
            assert p99 < 5, f"p99 overhead was {p99:.3f}ms, expected < 5ms"
