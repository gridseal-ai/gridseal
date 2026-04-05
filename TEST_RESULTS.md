# GridSeal Test Results Summary

Generated: 2026-04-05

## Test Count by Package

| Package | Test Files | Tests | Status |
|---------|-----------|-------|--------|
| @gridseal/core (unit) | 32 | 703 | All passing |
| @gridseal/core (integration) | 1 | ~10 | All passing |
| @gridseal/core (regression) | 1 | ~25 | All passing |
| @gridseal/core (performance) | 1 | 16 | All passing |
| @gridseal/api (unit) | 23 | 322 | All passing |
| @gridseal/api (UAT) | 3 | ~104 | All passing |
| @gridseal/api (performance) | 1 | 5 | All passing |
| @gridseal/sdk-node | 7 | 168 | All passing |
| @gridseal/cli | 6 | 49 | All passing |
| @gridseal/dashboard | 12 | 68 | All passing |
| @gridseal/trust-page | 4 | 75 | All passing |
| **Total** | **~91** | **~1545+** | **All passing** |

## Test Layers Completed

| Layer | Description | Status |
|-------|-------------|--------|
| 1 | Unit Test Hardening | Complete |
| 2 | Crypto Verification | Complete |
| 3 | System Integration Testing | Complete |
| 4 | UAT - Auditor Perspective | Complete |
| 5 | UAT - Developer Perspective | Complete |
| 6 | UAT - Attacker Perspective | Complete |
| 7 | Performance and Stress Testing | Complete |

## Performance Benchmark Results

### Core Library (packages/core/tests/performance/)

**Throughput:**
- In-memory chain append: >= 1000 entries/sec (target: 1000/s) -- PASS
- SQLite chain append + storage: >= 500 entries/sec (target: 500/s) -- PASS
- In-memory adapter putEntry: >= 5000 entries/sec -- PASS
- SQLite adapter putEntry: >= 500 entries/sec -- PASS

**Latency:**
- Entry creation p99: < 5ms (target: < 5ms) -- PASS
- SQLite storage write p99: < 10ms -- PASS

**Chain Validation:**
- 1K entries: < 50ms -- PASS
- 10K entries: < 100ms (target: < 100ms) -- PASS
- 100K entries: < 3000ms -- PASS

**Memory:**
- 100K entries peak RSS delta: < 500MB (target: < 500MB) -- PASS

**Report Generation:**
- 10K-entry compliance report: < 10s (target: < 10s) -- PASS
- 1K-entry report with certificates: < 2s -- PASS

**Concurrency:**
- 10 concurrent chain builds (5000 total entries): > 500 entries/sec -- PASS
- 5 concurrent SQLite storage writes (1000 total entries): > 200 entries/sec -- PASS

### API Service (services/api/tests/performance/)

**Sequential Throughput:**
- 500 entries via POST, p99 latency: < 200ms -- PASS

**Concurrent Throughput:**
- 100 concurrent POST requests to separate chains: 0 server errors -- PASS

**Read Throughput:**
- Paginated GET (50 per page), p99: < 100ms per page -- PASS

**Validation:**
- 500-entry chain validation via API: < 500ms -- PASS

**Report Generation:**
- 500-entry compliance report via API: < 5s -- PASS

## Known Issues

- ~~JWT verifyTenantToken: timingSafeEqual throws RangeError when signature length differs from expected.~~ **FIXED**: Added buffer length check before timingSafeEqual call.
- ~~confidenceLevelFromScore(NaN) does not throw; NaN bypasses range guard.~~ **FIXED**: Added Number.isNaN() guard.
- Reports route uses DEFAULT_METADATA with empty sectors and null riskLevel, so Colorado SB-205 requirements with minimumRiskLevel:"high" will not match unless metadata is customized per request.
