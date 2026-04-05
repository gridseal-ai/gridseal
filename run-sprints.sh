#!/bin/bash
set -e

LOG="/Users/rohit/Documents/celestir-rd/gridseal/sprint-runner.log"
echo "=== Sprint Runner Started: $(date) ===" > "$LOG"

###############################################################################
# SPRINT 3: Compliance + Reasoning Engine
###############################################################################
echo "=== SPRINT 3 STARTING: $(date) ===" >> "$LOG"

continuous-claude \
  --owner gridseal-ai --repo gridseal \
  -p "Read CLAUDE.md and spec.pdf. You are building GridSeal Sprint 3: Compliance and Reasoning Engine.

The core library and SDK layer are already complete on main. Do not modify packages/core schema or hash chain logic unless fixing a bug.

Work through these tasks in order, one per iteration:

1. Regulatory reference database. Create packages/core/src/compliance/regulations/ with structured data files for: Colorado AI Act (SB 205, Section 6-1-1703 requirements), NIST AI RMF (all 4 functions: Govern, Map, Measure, Manage with subcategory references), EU AI Act Article 12 (record-keeping) and Article 13 (transparency), HIPAA 164.312(b) audit control requirements. Each regulation is a TypeScript module exporting its requirements as typed objects.

2. Auto-tagging engine. Given a Proof Chain entry, determine which regulatory requirements apply based on entry metadata (data type, decision type, sector tags, authority level). Returns an array of applicable regulation references. Full unit tests covering all 4 regulations.

3. Compliance report generator. Takes a chain segment and produces a structured report object mapping entries to regulatory requirements. Export as JSON. Export as PDF using @react-pdf/renderer or pdfmake. The report must include: chain integrity verification result, entries grouped by regulation, reasoning certificate summaries where present, gaps identified (entries missing required fields).

4. Semi-formal reasoning certificate engine. Build packages/core/src/certificate/engine.ts that takes an AI decision context and produces a structured certificate with premises, execution trace, formal conclusion, and unsupported claims sections. The engine provides templates for common decision types (classification, recommendation, approval/denial, risk scoring). Each template defines what premises and traces are required.

5. Authority boundary enforcement. Policy-as-code engine that reads a YAML configuration defining: autonomous actions (no approval needed), gated actions (require human approval), escalated actions (exceed agent authority). Runtime enforcement function that checks an incoming action against policy and returns allow/deny/escalate. All decisions logged as Proof Chain entries. Full test coverage including edge cases (missing policy, unknown action type, malformed YAML).

6. AIBOM generation. Model provenance records conforming to CycloneDX ML-BOM v1.7. Given model metadata (name, version, provider, training data hash, prompt template hash), produce a valid CycloneDX component. Validate output against the CycloneDX JSON schema. Unit tests verify schema conformance.

7. Integration tests for the full compliance pipeline. Start with an empty chain, append 50 entries across different decision types and sectors, run auto-tagging, generate compliance reports for all 4 regulations, verify reports contain correct mappings. This is the end-to-end proof that Sprint 3 works.

Follow all code standards in CLAUDE.md. 90%+ test coverage. No stubs. No TODOs. No placeholder implementations. Every function does real work." \
  --max-duration 12h \
  -m 0 \
  --merge-strategy squash \
  -r "Run pnpm test and pnpm lint. Verify test coverage is 90%+ on packages/core. Check that no file exceeds 300 lines. Check that all regulatory data is accurate to the actual regulation text, not fabricated section numbers. Verify YAML parsing handles malformed input without crashing. Run pnpm build to confirm no type errors." \
  2>&1 | tee -a "$LOG"

echo "=== SPRINT 3 COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# SPRINT 4: Dashboard + Trust Page
###############################################################################
echo "=== SPRINT 4 STARTING: $(date) ===" >> "$LOG"

continuous-claude \
  --owner gridseal-ai --repo gridseal \
  -p "Read CLAUDE.md and spec.pdf. You are building GridSeal Sprint 4: Dashboard, Trust Page, and Decision Tree Visualization.

The core library, SDK layer, and compliance engine are complete on main. This sprint builds the user-facing web application.

Work through these tasks in order, one per iteration:

1. API service foundation. Create services/api/ using Hono framework on Node.js. Routes: POST /entries (append entry to chain), GET /entries (list with pagination, filter by date/model/actor/session), GET /entries/:id (single entry with full detail), GET /chain/verify (run chain validation, return integrity status), GET /reports/:regulation (generate compliance report for a regulation). Authentication via API key in Authorization header. Input validation with zod schemas. Connect to PostgreSQL via Drizzle ORM. Include database migration files. Full integration tests against a test database (use SQLite for test, Postgres adapter for production).

2. Multi-tenant isolation. Each API key belongs to a tenant. Tenants can only access their own entries. Tenant ID is embedded in the API key (signed JWT). All queries filter by tenant_id. Test that tenant A cannot read tenant B entries.

3. Dashboard frontend. Create services/dashboard/ using React 19, Vite, TailwindCSS (utility classes only). Pages: Audit Trail Explorer (table view with search, filter by date range, model, actor, session_id, pagination), Entry Detail (full 24-field view with reasoning certificate expandable panel), Chain Verification (one-click verify, shows integrity status with pass/fail per segment). Use fetch to call the API. No state management library, just React hooks. Responsive layout. No component library, build from scratch with Tailwind.

4. Decision tree visualization. When viewing a session (multi-agent workflow), render the agent delegation tree. Root node is the orchestrator entry. Child nodes are sub-agent entries linked via parent_entry_id. Each node shows: agent_role, authority_level, review_status, and a summary. Clicking a node expands to show full entry detail. Use SVG rendering, not a third-party graph library. The tree must handle 50+ nodes without performance issues.

5. Trust Page generator. Create services/trust-page/ that generates a static HTML page for each tenant showing: models in use (aggregated from entries), total entries and chain integrity status, human review rate (percentage of entries with review_status approved or rejected), compliance report availability (which regulations have been mapped), last verification timestamp. Served as a static page at /{tenant-slug}/trust. Styled with TailwindCSS. Must look professional without a design system. Clean typography, adequate whitespace, Celestir celestial color palette (midnight navy 0A1628, aurora blue 1B6B9A, stardust 4DA8DA).

6. Embeddable trust badge. A small SVG badge that tenants embed on their website. Shows chain integrity status (verified/unverified) and links to their Trust Page. Served as an SVG endpoint: GET /badge/:tenant-slug.svg. Badge updates in real time based on latest chain verification.

7. LangGraph adapter. Create packages/sdk-node/src/frameworks/langgraph.ts. Intercepts LangGraph node executions and tool calls. Automatically creates tree-structured Proof Chain entries with parent_entry_id linking. Each graph node execution becomes an entry. Each tool call within a node becomes a child entry. Integration test using a mock LangGraph workflow with 3 nodes and 2 tool calls.

8. End-to-end test. Playwright test that: calls the API to create 20 entries across 2 sessions, loads the dashboard, verifies the audit trail explorer shows all entries, clicks into a multi-agent session and verifies the decision tree renders correctly, runs chain verification and confirms pass, visits the Trust Page and verifies all sections render, checks the trust badge SVG returns valid SVG with correct status. This is the proof that Sprint 4 works as a complete product.

Follow all code standards in CLAUDE.md. Services code needs 80%+ coverage. Frontend tests use Vitest for unit, Playwright for E2E. No component libraries, no shadcn, no material UI. Build clean UI with raw Tailwind. The dashboard must feel fast and professional, not like a prototype." \
  --max-duration 16h \
  -m 0 \
  --merge-strategy squash \
  -r "Run pnpm test and pnpm lint across all packages and services. Run pnpm build to verify no type errors. Check that the API responds to all routes correctly by running integration tests. Verify no file exceeds 300 lines. Check that all database queries use parameterized statements via Drizzle, no raw SQL. Verify the dashboard loads without console errors. Check that TailwindCSS uses only utility classes, no custom CSS files." \
  2>&1 | tee -a "$LOG"

echo "=== SPRINT 4 COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# SPRINT 4.5: Rigorous Multi-Layer Testing
###############################################################################
echo "=== SPRINT 4.5 STARTING: $(date) ===" >> "$LOG"

continuous-claude \
  --owner gridseal-ai --repo gridseal \
  -p "Read CLAUDE.md and spec.pdf. You are running a rigorous, multi-layer, multi-perspective test suite build for GridSeal. The core library, SDK, compliance engine, API, dashboard, and Trust Page are complete on main.

Your job is NOT to add features. Your job is to break what exists, find every weakness, and add tests that prove the system is correct under real-world conditions. No mocks. No stubs. Every test hits real code paths with real data. If a test requires a database, use a real SQLite or Postgres instance. If a test requires an API, start the real API server.

Work through these testing layers in order, one per iteration:

LAYER 1: UNIT TEST HARDENING
Review every existing unit test in the repo. For each test file:
- Delete any test that uses mocks, stubs, spies, or jest.fn() to fake behavior. Replace with tests that exercise the real implementation.
- Delete any test that only checks a function was called or returns truthy. Replace with tests that verify actual output values against expected values.
- Add boundary tests: empty inputs, null fields, maximum-length strings, unicode characters, entries with all 24 fields populated, entries with only required fields.
- Add arithmetic edge cases for hash chain: chain of length 0, chain of length 1, chain of exactly MAX_INT entries (simulate with counter).
- Add determinism tests: create the same entry twice with identical inputs, verify the hash is identical. Create entries with fields in different order, verify serialization produces identical output.
- Target: every public function in packages/core has at least 3 tests covering normal path, edge case, and error path.

LAYER 2: CRYPTO VERIFICATION
Build a dedicated test suite at packages/core/tests/regression/crypto-verification.test.ts:
- Import NIST SHA-256 test vectors (from csrc.nist.gov/projects/cryptographic-algorithm-validation-program). Verify GridSeal hash output matches NIST expected output for each vector.
- Create a chain of 100 entries. Export the raw data. Independently recompute every hash using a completely separate implementation (write a second hash function that does the same thing differently). Verify all hashes match. This proves the primary implementation is correct without trusting it.
- Tamper test: create a 1000-entry chain. For each position 0 through 999, tamper with that entry (flip one bit in the input_hash), run validation, assert it fails at exactly that position and reports the correct entry_id.
- Replay test: take a valid chain, duplicate an entry in the middle, verify validation catches the duplicate.
- Ordering test: take a valid chain, swap two adjacent entries, verify validation catches the swap.

LAYER 3: SYSTEM INTEGRATION TESTING (SIT)
Build tests at services/api/tests/integration/ that test the full stack end-to-end with real infrastructure:
- Start the real Hono API server on a random port.
- Connect to a real SQLite database (fresh per test run, deleted after).
- Test the complete lifecycle: create tenant API key, append 100 entries via POST /entries, query entries via GET /entries with every filter combination (date range, model, actor, session_id), verify chain via GET /chain/verify, generate compliance report via GET /reports/colorado-ai-act, verify report contains all 100 entries correctly mapped.
- Concurrent write test: launch 10 parallel HTTP clients, each appending 100 entries simultaneously (1000 total). After all complete, verify chain integrity, verify no entries were lost, verify no hash collisions, verify total count is exactly 1000.
- Large volume test: append 10,000 entries sequentially. Verify chain validates in under 100ms. Verify GET /entries pagination works correctly across all pages. Verify compliance report generates in under 5 seconds.
- Tenant isolation test: create 2 tenants, each appends 50 entries. Verify tenant A GET /entries returns exactly 50 entries. Verify tenant A cannot access tenant B entries by guessing entry IDs. Verify tenant A chain verification only covers tenant A entries.
- Malformed input test: send invalid JSON to POST /entries. Send entries with missing required fields. Send entries with wrong types. Send SQL injection strings in every string field. Send entries with hash values that are not valid SHA-256 hex strings. Verify every case returns appropriate 400 error with actionable message, not 500.
- Authentication test: call every endpoint without API key (expect 401). Call with malformed API key (expect 401). Call with expired key if applicable. Call with valid key for wrong tenant (expect 403 on data access).

LAYER 4: USER ACCEPTANCE TESTING (UAT) - AUDITOR PERSPECTIVE
Build tests at services/api/tests/uat/auditor.test.ts that simulate what a compliance auditor would do:
- Create a realistic scenario: 500 entries over a simulated 30-day period, across 5 different AI models, with 3 agent sessions (multi-agent workflows with parent-child relationships), mix of review_status values (60% approved, 20% pending, 10% rejected, 10% escalated), 50 entries with reasoning certificates, 100 entries with tool_calls.
- Auditor query 1: show me all entries for model X between date A and date B. Verify correct count and contents.
- Auditor query 2: show me the complete decision tree for session S. Verify tree structure is correct (all parent-child links resolve, no orphans, no cycles).
- Auditor query 3: verify chain integrity for the entire 30-day period. Must return a pass with details on entries verified.
- Auditor query 4: generate Colorado AI Act compliance report. Verify report includes all required sections per SB 205 Section 6-1-1703.
- Auditor query 5: show me all entries where authority_level was escalated. Verify each has an escalation_trigger.
- Auditor query 6: show me all entries with unsupported_claims in their reasoning certificate. Verify the claims are surfaced in the report.
- Auditor query 7: verify the AIBOM for model X. Confirm model_provenance fields are present and hash values are valid.

LAYER 5: USER ACCEPTANCE TESTING (UAT) - DEVELOPER PERSPECTIVE
Build tests at services/api/tests/uat/developer.test.ts simulating a developer integrating GridSeal:
- SDK integration test: import the Node.js SDK, configure with a test API key pointing at the real test server, wrap a mock AI function (that returns a fixed string), call it 10 times, verify 10 entries appear in the dashboard API, verify each entry has correct input_hash, output_hash, model_id, and timestamp.
- Framework adapter test: use the LangGraph adapter with a real (simple) LangGraph workflow. Run the workflow. Verify the Proof Chain contains the correct tree structure matching the graph topology.
- Onboarding time test: measure wall-clock time from npm install to first verified audit entry. Assert it takes under 5 minutes (this tests documentation completeness and SDK ergonomics, not just code).
- Error recovery test: start the API, append 50 entries, kill the API mid-write on entry 51, restart the API, verify the chain is valid (50 entries, not corrupted), append 50 more, verify all 100 validate.

LAYER 6: USER ACCEPTANCE TESTING (UAT) - ATTACKER PERSPECTIVE
Build tests at services/api/tests/uat/security.test.ts:
- API key brute force: send 1000 requests with random API keys. Verify all return 401. Verify response time does not leak information about key validity (constant-time comparison).
- Chain tampering via API: attempt to POST an entry with a prev_hash that does not match the actual last entry. Verify rejection.
- Direct database tampering: connect to the test database directly (bypassing API), modify an entry hash, then call GET /chain/verify. Verify it detects the tampering and reports the exact position.
- Replay attack: capture a valid POST /entries request, replay it 100 times. Verify the chain handles duplicates correctly (either rejects them or each gets a unique position with correct prev_hash).
- Oversized payload: send a 10MB entry body. Verify rejection with appropriate error, not OOM crash.
- Header injection: send entries with newlines and carriage returns in string fields. Verify sanitization.

LAYER 7: PERFORMANCE AND STRESS TESTING
Build tests at packages/core/tests/performance/:
- Throughput benchmark: measure entries-per-second for chain append. Must exceed 1000 entries/second for in-memory adapter, 500 entries/second for SQLite adapter.
- Latency benchmark: measure p50, p95, p99 latency for entry creation. p99 must be under 5ms.
- Chain validation benchmark: validate chains of 1K, 10K, 100K entries. Record times. 10K must complete in under 100ms.
- Memory benchmark: append 100K entries, measure peak RSS. Must not exceed 500MB.
- API throughput: send 100 concurrent requests to POST /entries. Measure p99 response time. Must be under 200ms.
- Report generation benchmark: generate compliance report for a 10K-entry chain. Must complete in under 10 seconds.

After all layers are complete, create a test summary at the repo root called TEST_RESULTS.md (gitignored) documenting: total test count, pass rate, coverage percentage per package, performance benchmark results, and any issues found and fixed during testing.

Follow all code standards in CLAUDE.md. No mocks. No stubs. No jest.fn(). Every test hits real code. Every assertion checks actual values. Test names describe behavior and expected outcome." \
  --max-duration 16h \
  -m 0 \
  --merge-strategy squash \
  -r "Run pnpm test across all packages and services. Verify zero test failures. Run pnpm test:coverage and verify 90%+ on packages/core, 80%+ on services. Check that no test file uses jest.fn(), vi.fn(), sinon, or any mocking library. Grep the entire test directory for mock, stub, spy, jest.fn, vi.fn and reject if any are found in test assertions (import of testing utilities is fine, faking behavior of GridSeal code is not). Verify all performance benchmarks meet their targets. Run pnpm build to confirm no type errors." \
  2>&1 | tee -a "$LOG"

echo "=== SPRINT 4.5 COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# SPRINT 4.6: Fix and Verify
###############################################################################
echo "=== SPRINT 4.6 STARTING: $(date) ===" >> "$LOG"

continuous-claude \
  --owner gridseal-ai --repo gridseal \
  -p "Read CLAUDE.md and spec.pdf. You are running the fix-and-verify cycle for GridSeal.

Sprint 4.5 just completed a rigorous 7-layer test suite. Your job is to find and fix every remaining issue, then prove the fixes are correct.

Work through this process on each iteration:

STEP 1: RUN THE FULL TEST SUITE
Run pnpm test across all packages and services. Run pnpm test:coverage. Run pnpm lint. Run pnpm build. Collect every failure, every warning, every coverage gap below target (90% core, 80% services).

STEP 2: CATEGORIZE FAILURES
For each failure, determine the root cause:
- Is it a bug in the implementation code? Fix the implementation, not the test.
- Is it a bug in the test itself (wrong assertion, race condition, environment dependency)? Fix the test to correctly test the real behavior.
- Is it a flaky test (passes sometimes, fails sometimes)? Find the non-determinism and eliminate it. Do not add retries or skip annotations.
- Is it a coverage gap? Write a real test that exercises the uncovered code path. Do not write a test just to hit the line. The test must verify meaningful behavior.

STEP 3: FIX ONE CATEGORY PER ITERATION
Pick the highest-severity failures first. Fix them. Run the full suite again to confirm:
- The fix resolves the original failure.
- The fix does not introduce new failures (regression check).
- Coverage did not decrease.

STEP 4: ADD A REGRESSION TEST
For every bug found and fixed, add a test in the appropriate tests/regression/ directory. Name the test after what went wrong: 'rejects entries with non-hex hash strings after input validation fix'. Reference the commit hash of the fix in a code comment.

STEP 5: REPEAT
Continue iterating until a full run of pnpm test, pnpm lint, pnpm build, and pnpm test:coverage all pass with zero failures, zero warnings, and coverage meets targets.

When you reach a clean run with zero failures: run the entire suite three more times to confirm no flaky tests. If any test fails on any of the three runs, that test is flaky. Fix the flakiness and restart the three-run verification.

Do not stop until you have three consecutive clean runs.

Follow all code standards in CLAUDE.md. No mocks. No stubs. No skipped tests. No relaxed thresholds. Every fix is a real fix. Every regression test prevents the same bug from returning." \
  --max-duration 8h \
  -m 0 \
  --merge-strategy squash \
  -r "Run pnpm test three times in sequence. All three runs must pass with zero failures. Run pnpm test:coverage and verify 90%+ on packages/core, 80%+ on services. Run pnpm lint with zero warnings. Run pnpm build with zero type errors. Grep test directories for .skip, .only, xit, xdescribe, and reject if any are found. Verify no test uses setTimeout or artificial delays to work around race conditions." \
  2>&1 | tee -a "$LOG"

echo "=== SPRINT 4.6 COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# CLEANUP: README revision
###############################################################################
echo "=== README REVISION STARTING: $(date) ===" >> "$LOG"

continuous-claude \
  --owner gridseal-ai --repo gridseal \
  -p "Read CLAUDE.md. You are rewriting the README.md for GridSeal.

The current README is a minimal placeholder. Rewrite it to be attractive, grounded, and concise. Follow these rules exactly:

TONE: Professional, direct, confident. No hype. No buzzwords. No fluff. Write like an engineer explaining their work to a smart peer who has 2 minutes.

CONTENT (in this order, keep the whole thing under 150 lines):
1. One-liner: what GridSeal is (tamper-evident audit trail for AI systems)
2. Why it matters (3-4 sentences max): AI systems make decisions that affect people. Regulations are arriving (EU AI Act, Colorado AI Act, NIST AI RMF, HIPAA). Organizations need proof of what their AI did, why, and whether a human reviewed it. GridSeal provides that proof as a cryptographically verifiable chain.
3. Who uses it and why (brief, no bullet point walls):
   - Government agencies deploying AI for public services (benefits, immigration, law enforcement) need audit trails for accountability and FOIA compliance
   - Financial services using AI for lending, underwriting, fraud detection need records for fair lending laws and examiner reviews
   - Healthcare organizations using AI for diagnostics or treatment recommendations need HIPAA audit controls
   - Any company shipping AI products in the EU after August 2026 needs Article 12 record-keeping
   - AI platform companies building multi-agent systems need provenance tracking across agent delegation chains
4. What it does (short feature list, not a wall of text): hash-chained entries, reasoning certificates, compliance auto-tagging, AIBOM/model provenance, storage adapters, SDK wrappers for major AI providers, decision tree tracking for multi-agent workflows
5. Quick install + minimal usage example (npm install, wrap an AI call, verify chain)
6. License line (AGPL-3.0)

DO NOT INCLUDE:
- Emojis
- Em dashes or en dashes (use regular dashes or commas)
- Contributing section, code of conduct, acknowledgments
- Badges (build status, coverage, etc.)
- Table of contents
- The word 'comprehensive', 'robust', 'seamless', 'leverage', 'utilize', 'facilitate'
- Any reference to AI generation, Claude, or LLMs building this
- Author names (use 'Gridseal by Celestir' if attribution is needed)

PROCESS:
Write the README three times. After each draft, review it critically:
- Draft 1: Get the content right. Check facts against the actual codebase (read package.json, src/index.ts exports, etc.)
- Draft 2: Cut every sentence that does not earn its place. Tighten language. Remove anything that sounds like marketing copy.
- Draft 3: Final pass for tone. Read it as a skeptical senior engineer. Remove anything that would make them roll their eyes. Check for em dashes, flowery language, AI markers.

Only commit the third draft." \
  --max-duration 2h \
  -m 0 \
  --merge-strategy squash \
  -r "Read the committed README.md. Check for: em dashes, en dashes, emojis, the words 'comprehensive', 'robust', 'seamless', 'leverage', 'utilize', 'facilitate'. Check that the install example actually works with the current package name. Check line count is under 150. Verify the tone is direct and grounded, not salesy." \
  2>&1 | tee -a "$LOG"

echo "=== README REVISION COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# CLEANUP: Remove AI markers (em dashes, etc.)
###############################################################################
echo "=== AI MARKER CLEANUP STARTING: $(date) ===" >> "$LOG"

continuous-claude \
  --owner gridseal-ai --repo gridseal \
  -p "Read CLAUDE.md. You are doing a cleanup pass to remove AI-generation markers from the codebase.

Search the entire repository for these AI writing patterns and fix them:

1. Em dashes (—) in code comments, docstrings, error messages, README, docs, and test descriptions. Replace with regular dashes (-) or rewrite the sentence to not need a dash.
2. En dashes (–) same treatment.
3. Overly formal or flowery language in comments/docs that screams AI-generated. Simplify to direct, plain English.
4. Phrases like 'leverages', 'utilizes', 'facilitates', 'encompasses', 'robust', 'seamless', 'comprehensive' — replace with simpler words (uses, helps, includes, strong, smooth, full).
5. Any lingering references to Claude, AI generation, LLM, or 'generated by' in source code, comments, or docs.
6. Unnecessary hedging language: 'it is worth noting that', 'it should be noted', 'essentially', 'fundamentally'.
7. Check commit-worthy files only (not node_modules, dist, coverage, etc).

Do NOT change:
- Actual code logic or variable names
- Test assertions or expected values
- Content that legitimately discusses AI (like the product docs describing what GridSeal does for AI systems)

Work through one file type per iteration (e.g., .ts files, then .py files, then .md files). Run pnpm test and pnpm lint after each iteration to confirm nothing broke." \
  --max-duration 4h \
  -m 0 \
  --merge-strategy squash \
  -r "Grep the entire repo for em dashes (—), en dashes (–), and the words 'leverages', 'utilizes', 'facilitates', 'encompasses' in source code and docs. Report any remaining instances. Run pnpm test and pnpm lint to verify nothing broke." \
  2>&1 | tee -a "$LOG"

echo "=== AI MARKER CLEANUP COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# CLEANUP: Rewrite git author on all commits
###############################################################################
echo "=== AUTHOR REWRITE STARTING: $(date) ===" >> "$LOG"

cd /Users/rohit/Documents/celestir-rd/gridseal

# Remove run-sprints.sh from entire git history and rewrite author in one pass
git filter-branch -f \
  --env-filter '
    export GIT_AUTHOR_NAME="Gridseal Team"
    export GIT_AUTHOR_EMAIL="gridseal@celestir.com"
    export GIT_COMMITTER_NAME="Gridseal Team"
    export GIT_COMMITTER_EMAIL="gridseal@celestir.com"
  ' \
  --index-filter '
    git rm --cached --ignore-unmatch run-sprints.sh
  ' \
  --prune-empty -- --all 2>&1 | tee -a "$LOG"

git push --force origin main 2>&1 | tee -a "$LOG"

echo "=== AUTHOR REWRITE COMPLETE: $(date) ===" >> "$LOG"

###############################################################################
# CLEANUP: Remove run-sprints.sh and other build artifacts from repo
###############################################################################
echo "=== FINAL CLEANUP STARTING: $(date) ===" >> "$LOG"

cd /Users/rohit/Documents/celestir-rd/gridseal

# Remove from git tracking but keep locally
git rm --cached run-sprints.sh 2>/dev/null

# Add to .gitignore so it stays local-only
grep -qxF 'run-sprints.sh' .gitignore || echo "run-sprints.sh" >> .gitignore
git add .gitignore

git commit -m "chore: remove build script from tracking"
git push origin main 2>&1 | tee -a "$LOG"

echo "=== FINAL CLEANUP COMPLETE: $(date) ===" >> "$LOG"
echo "=== ALL SPRINTS FINISHED: $(date) ===" >> "$LOG"
