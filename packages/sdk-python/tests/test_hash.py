"""Tests for SHA-256 hashing and deterministic canonicalization."""

from gridseal.core.hash import canonicalize, compute_entry_hash, serialize_for_hashing, sha256
from gridseal.core.types import ProofChainEntry


class TestSha256:
    """SHA-256 hash function tests using NIST FIPS 180-4 test vectors."""

    def test_nist_empty_string(self) -> None:
        assert sha256("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def test_nist_abc(self) -> None:
        assert sha256("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

    def test_nist_long_string(self) -> None:
        assert (
            sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
            == "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        )

    def test_returns_lowercase_hex(self) -> None:
        result = sha256("test")
        assert result == result.lower()
        assert len(result) == 64


class TestCanonicalize:
    """Deterministic serialization matching TypeScript canonicalize exactly."""

    def test_null(self) -> None:
        assert canonicalize(None) == "null"

    def test_string(self) -> None:
        assert canonicalize("hello") == '"hello"'

    def test_empty_string(self) -> None:
        assert canonicalize("") == '""'

    def test_string_with_special_chars(self) -> None:
        assert canonicalize('a "b" c') == '"a \\"b\\" c"'

    def test_integer(self) -> None:
        assert canonicalize(42) == "42"

    def test_zero(self) -> None:
        assert canonicalize(0) == "0"

    def test_float(self) -> None:
        assert canonicalize(0.95) == "0.95"

    def test_boolean_true(self) -> None:
        assert canonicalize(True) == "true"

    def test_boolean_false(self) -> None:
        assert canonicalize(False) == "false"

    def test_empty_array(self) -> None:
        assert canonicalize([]) == "[]"

    def test_array(self) -> None:
        assert canonicalize(["a", "b"]) == '["a","b"]'

    def test_empty_object(self) -> None:
        assert canonicalize({}) == "{}"

    def test_object_sorted_keys(self) -> None:
        assert canonicalize({"b": 2, "a": 1}) == '{"a":1,"b":2}'

    def test_nested_object(self) -> None:
        result = canonicalize({"z": {"b": 2, "a": 1}, "a": [1, "x"]})
        assert result == '{"a":[1,"x"],"z":{"a":1,"b":2}}'

    def test_tuple_treated_as_array(self) -> None:
        assert canonicalize(("a", "b")) == '["a","b"]'


class TestCrossCompatibility:
    """Verify Python hashes match TypeScript output for identical inputs."""

    def test_minimal_entry_hash_matches_typescript(self) -> None:
        entry = ProofChainEntry(
            entry_id="019505f0-0000-7000-8000-000000000001",
            chain_id="chain-001",
            sequence_number=0,
            timestamp="2026-04-04T12:00:00.000Z",
            entry_type="ai_decision",
            entry_hash="",
            previous_hash=None,
            parent_entry_id=None,
        )
        result = compute_entry_hash(entry)
        assert result == "23dfc8db0add7d51a0e3bffc55d45b0b3975970e221147aeee3da7bfaa8d9c58"

    def test_full_entry_hash_matches_typescript(self) -> None:
        entry = ProofChainEntry(
            entry_id="019505f0-0000-7000-8000-000000000001",
            chain_id="chain-001",
            sequence_number=0,
            timestamp="2026-04-04T12:00:00.000Z",
            entry_type="ai_decision",
            entry_hash="",
            previous_hash=None,
            parent_entry_id=None,
            model_id="claude-sonnet-4-20250514",
            model_provider="anthropic",
            input_hash="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            output_hash="f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
            input_token_count=150,
            output_token_count=300,
            decision_type="generation",
            confidence_score=0.95,
            reasoning_certificate_id="cert-001",
            provenance_id="prov-001",
            session_id="session-001",
            actor_id="user-42",
            policy_ids=("colorado-ai-act", "eu-ai-act"),
            tags={"environment": "production", "team": "ml-ops"},
            annotation="Routine inference call",
            compliance_metadata={"riskLevel": "limited", "assessmentDate": "2026-04-01"},
        )
        result = compute_entry_hash(entry)
        assert result == "08d55303123250a24d3d7f5b7360721066d29172d401ed22bc57876313de7f6c"

    def test_any_field_change_produces_different_hash(self) -> None:
        entry1 = ProofChainEntry(
            entry_id="019505f0-0000-7000-8000-000000000001",
            chain_id="chain-001",
            sequence_number=0,
            timestamp="2026-04-04T12:00:00.000Z",
            entry_type="ai_decision",
            entry_hash="",
            previous_hash=None,
            parent_entry_id=None,
        )
        entry2 = ProofChainEntry(
            entry_id="019505f0-0000-7000-8000-000000000002",
            chain_id="chain-001",
            sequence_number=0,
            timestamp="2026-04-04T12:00:00.000Z",
            entry_type="ai_decision",
            entry_hash="",
            previous_hash=None,
            parent_entry_id=None,
        )
        assert compute_entry_hash(entry1) != compute_entry_hash(entry2)
