"""Tests for the LangGraph framework adapter with auto-capture."""

from __future__ import annotations

from typing import Any

import pytest

from gridseal.core.chain import validate_chain
from gridseal.core.hash import canonicalize, sha256
from gridseal.core.storage import InMemoryAdapter
from gridseal.core.types import Err, Ok
from gridseal.frameworks.langgraph import (
    GridSealLangGraph,
    LangGraphCaptureError,
    wrap_langgraph,
)


async def _mock_node(input_data: dict[str, Any]) -> dict[str, Any]:
    """Mock LangGraph node that appends a response message."""
    messages = list(input_data.get("messages", []))
    messages.append(f"Response {input_data.get('count', 0)}")
    return {"messages": messages}


async def _failing_node(input_data: dict[str, Any]) -> dict[str, Any]:
    raise RuntimeError("LLM rate limit exceeded")


@pytest.fixture
def storage() -> InMemoryAdapter:
    return InMemoryAdapter()


class TestGridSealLangGraph:
    """Test suite for the LangGraph adapter auto-capture functionality."""

    async def test_captures_node_execution_as_audit_entry(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node("llm_node", _mock_node)
        result = await node({"messages": ["Hello"], "count": 1})

        assert isinstance(result, Ok)
        captured = result.value
        assert captured.output == {"messages": ["Hello", "Response 1"]}
        assert len(captured.entry_id) > 0

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert len(stored) == 1
        entry = stored[0]
        assert entry.entry_type == "ai_decision"
        assert entry.model_id == "llm_node"
        assert entry.model_provider == "langgraph"
        assert entry.decision_type == "generation"
        assert entry.input_token_count is None
        assert entry.output_token_count is None

    async def test_captures_input_hash_from_full_input_object(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)
        node = wrapped.wrap_node("hash_node", _mock_node)

        input_data = {"messages": ["Hello"], "count": 1}
        await node(input_data)

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_input_hash = sha256(canonicalize(input_data))
        assert entry.input_hash == expected_input_hash

    async def test_captures_output_hash_from_full_output_object(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)
        node = wrapped.wrap_node("output_node", _mock_node)

        await node({"messages": ["Hello"], "count": 1})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_output = {"messages": ["Hello", "Response 1"]}
        expected_output_hash = sha256(canonicalize(expected_output))
        assert entry.output_hash == expected_output_hash

    async def test_multiple_executions_build_valid_chain(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        for i in range(5):
            node = wrapped.wrap_node(f"node_{i}", _mock_node)
            result = await node({"messages": [f"msg_{i}"], "count": i})
            assert isinstance(result, Ok)

        chain = wrapped.chain
        assert len(chain.entries) == 5
        validation = validate_chain(chain)
        assert isinstance(validation, Ok)

        for i in range(1, 5):
            assert chain.entries[i].previous_hash == chain.entries[i - 1].entry_hash

    async def test_propagates_session_id_and_actor_id(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(
            chain_id="test-chain",
            storage=storage,
            session_id="session-42",
            actor_id="graph-runner",
        )

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.session_id == "session-42"
        assert entry.actor_id == "graph-runner"

    async def test_records_custom_tags_and_annotation(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node(
            "tagged_node",
            _mock_node,
            tags={"env": "staging", "graph": "rag-pipeline"},
            annotation="RAG retrieval step",
        )
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.tags == {"env": "staging", "graph": "rag-pipeline"}
        assert entry.annotation == "RAG retrieval step"

    async def test_supports_custom_decision_type(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node(
            "classify_node", _mock_node, decision_type="classification"
        )
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].decision_type == "classification"

    async def test_supports_parent_entry_id_for_tree_structure(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        parent_node = wrapped.wrap_node("parent_node", _mock_node)
        r1 = await parent_node({"messages": [], "count": 0})
        assert isinstance(r1, Ok)
        parent_id = r1.value.entry_id

        child_node = wrapped.wrap_node(
            "child_node", _mock_node, parent_entry_id=parent_id
        )
        r2 = await child_node({"messages": [], "count": 1})
        assert isinstance(r2, Ok)

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[1].parent_entry_id == parent_id

    async def test_returns_node_execution_error_when_node_fails(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node("failing_node", _failing_node)
        result = await node({"messages": [], "count": 0})

        assert isinstance(result, Err)
        assert result.error.type == "NODE_EXECUTION_ERROR"
        assert "LLM rate limit exceeded" in result.error.message

    async def test_uses_custom_model_provider(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(
            chain_id="test-chain", storage=storage, model_provider="custom-graph"
        )

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].model_provider == "custom-graph"

    async def test_uses_none_for_session_and_actor_when_not_provided(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].session_id is None
        assert stored[0].actor_id is None

    async def test_defaults_tags_to_empty_dict_when_not_provided(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].tags == {}

    async def test_produces_entry_hashes_that_are_valid_sha256(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert len(entry.entry_hash) == 64
        assert all(c in "0123456789abcdef" for c in entry.entry_hash)

    async def test_sets_model_id_to_node_name(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node_a = wrapped.wrap_node("retriever", _mock_node)
        node_b = wrapped.wrap_node("generator", _mock_node)

        await node_a({"messages": [], "count": 0})
        await node_b({"messages": [], "count": 1})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].model_id == "retriever"
        assert stored[1].model_id == "generator"

    async def test_chain_property_returns_current_state(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        empty_chain = wrapped.chain
        assert empty_chain.chain_id == "test-chain"
        assert len(empty_chain.entries) == 0

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        chain_after = wrapped.chain
        assert len(chain_after.entries) == 1

    async def test_sets_first_entry_previous_hash_to_none(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        node = wrapped.wrap_node("test_node", _mock_node)
        await node({"messages": [], "count": 0})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].previous_hash is None

    async def test_assigns_incrementing_sequence_numbers(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        for i in range(3):
            node = wrapped.wrap_node(f"node_{i}", _mock_node)
            await node({"messages": [], "count": i})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].sequence_number == 0
        assert stored[1].sequence_number == 1
        assert stored[2].sequence_number == 2

    async def test_handles_none_output_from_node(
        self, storage: InMemoryAdapter
    ) -> None:
        async def null_node(input_data: Any) -> None:  # noqa: ANN401
            return None

        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)
        node = wrapped.wrap_node("null_node", null_node)
        result = await node({"messages": [], "count": 0})

        assert isinstance(result, Ok)
        assert result.value.output is None

        stored = await storage.get_entries_by_chain_id("test-chain")
        expected_output_hash = sha256(canonicalize(None))
        assert stored[0].output_hash == expected_output_hash

    async def test_handles_string_output_from_node(
        self, storage: InMemoryAdapter
    ) -> None:
        async def string_node(input_data: Any) -> str:  # noqa: ANN401
            return "simple result"

        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)
        node = wrapped.wrap_node("string_node", string_node)
        result = await node("input text")

        assert isinstance(result, Ok)
        assert result.value.output == "simple result"

        stored = await storage.get_entries_by_chain_id("test-chain")
        expected_output_hash = sha256(canonicalize("simple result"))
        assert stored[0].output_hash == expected_output_hash

    async def test_wraps_same_function_with_different_names(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)

        step1 = wrapped.wrap_node("step_1", _mock_node)
        step2 = wrapped.wrap_node("step_2", _mock_node)
        step3 = wrapped.wrap_node("step_3", _mock_node)

        await step1({"messages": ["a"], "count": 1})
        await step2({"messages": ["b"], "count": 2})
        await step3({"messages": ["c"], "count": 3})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert len(stored) == 3
        assert stored[0].model_id == "step_1"
        assert stored[1].model_id == "step_2"
        assert stored[2].model_id == "step_3"

        chain = wrapped.chain
        validation = validate_chain(chain)
        assert isinstance(validation, Ok)


class TestWrapLangGraph:
    """Tests for the wrap_langgraph convenience function."""

    def test_returns_gridseal_langgraph_instance(self) -> None:
        storage = InMemoryAdapter()
        wrapped = wrap_langgraph(chain_id="test-chain", storage=storage)
        assert isinstance(wrapped, GridSealLangGraph)

    def test_passes_session_and_actor(self) -> None:
        storage = InMemoryAdapter()
        wrapped = wrap_langgraph(
            chain_id="test-chain",
            storage=storage,
            session_id="s1",
            actor_id="a1",
        )
        assert wrapped.session_id == "s1"
        assert wrapped.actor_id == "a1"

    def test_passes_custom_model_provider(self) -> None:
        storage = InMemoryAdapter()
        wrapped = wrap_langgraph(
            chain_id="test-chain",
            storage=storage,
            model_provider="my-graph",
        )
        assert wrapped.model_provider == "my-graph"


class TestGridSealLangGraphOverhead:
    """Verify SDK wrapper adds less than 2ms overhead per call."""

    async def test_adds_less_than_2ms_overhead_per_call(self) -> None:
        import time

        storage = InMemoryAdapter()
        wrapped = wrap_langgraph(chain_id="bench-chain", storage=storage)
        node = wrapped.wrap_node("bench_node", _mock_node)

        # Warm up
        for i in range(5):
            await node({"messages": [f"Warmup {i}"], "count": i})

        # Measure 100 calls
        times: list[float] = []
        for i in range(100):
            start = time.perf_counter()
            await node({"messages": [f"Bench {i}"], "count": i})
            elapsed_ms = (time.perf_counter() - start) * 1000
            times.append(elapsed_ms)

        times.sort()
        p99 = times[int(len(times) * 0.99)]
        assert p99 < 2, f"p99 overhead was {p99:.3f}ms, expected < 2ms"
