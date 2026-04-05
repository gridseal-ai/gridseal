"""Tests for the CrewAI framework adapter with auto-capture."""

from __future__ import annotations

from typing import Any

import pytest

from gridseal.core.chain import validate_chain
from gridseal.core.hash import canonicalize, sha256
from gridseal.core.storage import InMemoryAdapter
from gridseal.core.types import Err, Ok
from gridseal.frameworks.crew import (
    GridSealCrew,
    CrewCaptureError,
    wrap_crew,
)


async def _mock_task(input_data: dict[str, Any]) -> dict[str, Any]:
    """Mock crew task that returns a result based on input query."""
    return {"answer": f"Result for: {input_data['query']}", "confidence": 0.95}


async def _failing_task(input_data: dict[str, Any]) -> dict[str, Any]:
    raise RuntimeError("Agent context window exceeded")


@pytest.fixture
def storage() -> InMemoryAdapter:
    return InMemoryAdapter()


class TestGridSealCrew:
    """Test suite for the CrewAI adapter auto-capture functionality."""

    async def test_captures_task_execution_as_audit_entry(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        result = await task({"query": "AI safety"})

        assert isinstance(result, Ok)
        captured = result.value
        assert captured.output["answer"] == "Result for: AI safety"
        assert captured.output["confidence"] == 0.95
        assert len(captured.entry_id) > 0

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert len(stored) == 1
        entry = stored[0]
        assert entry.entry_type == "ai_decision"
        assert entry.model_id == "researcher"
        assert entry.model_provider == "crew"
        assert entry.decision_type == "generation"
        assert entry.input_token_count is None
        assert entry.output_token_count is None

    async def test_captures_input_hash_including_task_name_and_agent_role(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        input_data = {"query": "AI safety"}
        await task(input_data)

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_input_hash = sha256(
            canonicalize({
                "task": "research",
                "agentRole": "researcher",
                "input": input_data,
            })
        )
        assert entry.input_hash == expected_input_hash

    async def test_captures_output_hash_from_task_output(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "AI safety"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]

        expected_output = {"answer": "Result for: AI safety", "confidence": 0.95}
        expected_output_hash = sha256(canonicalize(expected_output))
        assert entry.output_hash == expected_output_hash

    async def test_sets_model_id_to_agent_role(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task1 = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        task2 = wrapped.wrap_task("write", _mock_task, agent_role="writer")

        await task1({"query": "data"})
        await task2({"query": "report"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].model_id == "researcher"
        assert stored[1].model_id == "writer"

    async def test_includes_agent_role_and_task_name_in_tags(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "AI"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.tags["agentRole"] == "researcher"
        assert entry.tags["taskName"] == "research"

    async def test_merges_custom_tags_with_agent_role_and_task_name(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task(
            "research",
            _mock_task,
            agent_role="researcher",
            tags={"env": "prod", "priority": "high"},
        )
        await task({"query": "AI"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.tags == {
            "env": "prod",
            "priority": "high",
            "agentRole": "researcher",
            "taskName": "research",
        }

    async def test_multiple_executions_build_valid_chain(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        for i in range(5):
            task = wrapped.wrap_task(
                f"task_{i}", _mock_task, agent_role=f"agent_{i}"
            )
            result = await task({"query": f"query_{i}"})
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
        wrapped = wrap_crew(
            chain_id="test-chain",
            storage=storage,
            session_id="crew-session-1",
            actor_id="crew-orchestrator",
        )

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "test"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert entry.session_id == "crew-session-1"
        assert entry.actor_id == "crew-orchestrator"

    async def test_records_annotation(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task(
            "summarize",
            _mock_task,
            agent_role="summarizer",
            annotation="Final summary step",
        )
        await task({"query": "all findings"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].annotation == "Final summary step"

    async def test_supports_custom_decision_type(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task(
            "classify",
            _mock_task,
            agent_role="classifier",
            decision_type="classification",
        )
        await task({"query": "categorize this"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].decision_type == "classification"

    async def test_supports_parent_entry_id_for_tree_structure(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        plan_task = wrapped.wrap_task("plan", _mock_task, agent_role="planner")
        r1 = await plan_task({"query": "plan project"})
        assert isinstance(r1, Ok)
        plan_id = r1.value.entry_id

        exec_task = wrapped.wrap_task(
            "execute",
            _mock_task,
            agent_role="executor",
            parent_entry_id=plan_id,
        )
        r2 = await exec_task({"query": "do step 1"})
        assert isinstance(r2, Ok)

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[1].parent_entry_id == plan_id

    async def test_returns_task_execution_error_when_task_fails(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task(
            "failing", _failing_task, agent_role="broken-agent"
        )
        result = await task({"query": "too much data"})

        assert isinstance(result, Err)
        assert result.error.type == "TASK_EXECUTION_ERROR"
        assert "Agent context window exceeded" in result.error.message

    async def test_uses_custom_model_provider(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(
            chain_id="test-chain", storage=storage, model_provider="custom-crew"
        )

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "test"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].model_provider == "custom-crew"

    async def test_uses_none_for_session_and_actor_when_not_provided(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "test"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].session_id is None
        assert stored[0].actor_id is None

    async def test_produces_entry_hashes_that_are_valid_sha256(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "test"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        entry = stored[0]
        assert len(entry.entry_hash) == 64
        assert all(c in "0123456789abcdef" for c in entry.entry_hash)

    async def test_chain_property_returns_current_state(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        empty_chain = wrapped.chain
        assert empty_chain.chain_id == "test-chain"
        assert len(empty_chain.entries) == 0

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "test"})

        chain_after = wrapped.chain
        assert len(chain_after.entries) == 1

    async def test_sets_first_entry_previous_hash_to_none(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        task = wrapped.wrap_task("research", _mock_task, agent_role="researcher")
        await task({"query": "test"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].previous_hash is None

    async def test_assigns_incrementing_sequence_numbers(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)

        for i in range(3):
            task = wrapped.wrap_task(
                f"task_{i}", _mock_task, agent_role=f"agent_{i}"
            )
            await task({"query": f"q_{i}"})

        stored = await storage.get_entries_by_chain_id("test-chain")
        assert stored[0].sequence_number == 0
        assert stored[1].sequence_number == 1
        assert stored[2].sequence_number == 2

    async def test_handles_none_output_from_task(
        self, storage: InMemoryAdapter
    ) -> None:
        async def null_task(input_data: Any) -> None:  # noqa: ANN401
            return None

        wrapped = wrap_crew(chain_id="test-chain", storage=storage)
        task = wrapped.wrap_task("null_task", null_task, agent_role="null-agent")
        result = await task({"query": "test"})

        assert isinstance(result, Ok)
        assert result.value.output is None

        stored = await storage.get_entries_by_chain_id("test-chain")
        expected_output_hash = sha256(canonicalize(None))
        assert stored[0].output_hash == expected_output_hash

    async def test_simulates_multi_agent_crew_workflow(
        self, storage: InMemoryAdapter
    ) -> None:
        wrapped = wrap_crew(
            chain_id="crew-workflow",
            storage=storage,
            session_id="crew-session-1",
        )

        async def research_fn(data: dict[str, Any]) -> dict[str, Any]:
            return {"findings": ["finding 1", "finding 2"]}

        async def write_fn(data: dict[str, Any]) -> dict[str, Any]:
            return {"draft": "Based on findings..."}

        async def review_fn(data: dict[str, Any]) -> dict[str, Any]:
            return {"approved": True, "feedback": "Looks good"}

        research = wrapped.wrap_task("gather_data", research_fn, agent_role="researcher")
        write = wrapped.wrap_task("write_report", write_fn, agent_role="writer")
        review = wrapped.wrap_task("review_report", review_fn, agent_role="reviewer")

        r1 = await research({"query": "AI governance"})
        assert isinstance(r1, Ok)

        r2 = await write({"query": "write report"})
        assert isinstance(r2, Ok)

        r3 = await review({"query": "review draft"})
        assert isinstance(r3, Ok)

        chain = wrapped.chain
        assert len(chain.entries) == 3

        validation = validate_chain(chain)
        assert isinstance(validation, Ok)

        stored = await storage.get_entries_by_chain_id("crew-workflow")
        assert stored[0].tags["agentRole"] == "researcher"
        assert stored[1].tags["agentRole"] == "writer"
        assert stored[2].tags["agentRole"] == "reviewer"


class TestWrapCrew:
    """Tests for the wrap_crew convenience function."""

    def test_returns_gridseal_crew_instance(self) -> None:
        storage = InMemoryAdapter()
        wrapped = wrap_crew(chain_id="test-chain", storage=storage)
        assert isinstance(wrapped, GridSealCrew)

    def test_passes_session_and_actor(self) -> None:
        storage = InMemoryAdapter()
        wrapped = wrap_crew(
            chain_id="test-chain",
            storage=storage,
            session_id="s1",
            actor_id="a1",
        )
        assert wrapped.session_id == "s1"
        assert wrapped.actor_id == "a1"

    def test_passes_custom_model_provider(self) -> None:
        storage = InMemoryAdapter()
        wrapped = wrap_crew(
            chain_id="test-chain",
            storage=storage,
            model_provider="my-crew",
        )
        assert wrapped.model_provider == "my-crew"
