import { useState, useCallback } from "react";
import { listChains, validateChainApi } from "../api.js";
import { useAsync } from "../hooks/use-async.js";
import type { ValidationResult } from "../api.js";

type VerifyResult = {
  readonly chainId: string;
  readonly result: ValidationResult;
  readonly timestamp: string;
};

export function ChainVerifyPage() {
  const chainsResult = useAsync(() => listChains(), []);
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);

  const verify = useCallback(async (chainId: string) => {
    setVerifying(chainId);
    try {
      const result = await validateChainApi(chainId);
      setResults((prev) => [
        { chainId, result, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setResults((prev) => [
        {
          chainId,
          result: {
            valid: false,
            chainId,
            entryCount: 0,
            error: { type: "REQUEST_FAILED", message },
          },
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setVerifying(null);
    }
  }, []);

  const verifyAll = useCallback(async () => {
    if (chainsResult.status !== "success" || !chainsResult.data) return;
    for (const chain of chainsResult.data.chains) {
      await verify(chain.chainId);
    }
  }, [chainsResult, verify]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-celestir-text">Chain Verification</h1>
          <p className="text-sm text-celestir-text-muted mt-1">
            Verify cryptographic integrity of proof chains
          </p>
        </div>
        {chainsResult.status === "success" &&
          chainsResult.data &&
          chainsResult.data.chains.length > 0 && (
            <button
              onClick={verifyAll}
              disabled={verifying !== null}
              className="px-5 py-2.5 rounded-lg bg-celestir-aurora hover:bg-celestir-aurora-light disabled:opacity-40 text-[13px] font-semibold text-white transition-all shadow-[0_0_16px_rgba(27,107,154,0.2)] hover:shadow-[0_0_24px_rgba(27,107,154,0.3)]"
            >
              Verify All Chains
            </button>
          )}
      </div>

      {chainsResult.status === "loading" && (
        <div className="h-1 bg-celestir-navy-800 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-celestir-aurora rounded-full animate-pulse" />
        </div>
      )}
      {chainsResult.status === "error" && <p className="text-celestir-alert-light text-sm">{chainsResult.error}</p>}
      {chainsResult.status === "success" && chainsResult.data && (
        <div className="space-y-2">
          {chainsResult.data.chains.length === 0 && (
            <p className="text-celestir-text-muted text-sm">No chains found.</p>
          )}
          {chainsResult.data.chains.map((chain) => (
            <div
              key={chain.chainId}
              className="glass-panel flex items-center justify-between rounded-lg px-5 py-4 transition-all"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-[13px] text-celestir-text-secondary">{chain.chainId}</span>
                <span className="text-[11px] font-mono text-celestir-text-muted">{chain.entryCount} entries</span>
              </div>
              <button
                onClick={() => verify(chain.chainId)}
                disabled={verifying === chain.chainId}
                className="px-4 py-2 rounded-md bg-celestir-navy-800/80 border border-celestir-navy-700/40 hover:border-celestir-aurora/30 hover:bg-celestir-navy-700/50 disabled:opacity-40 text-[12px] font-medium text-celestir-text-secondary transition-all"
              >
                {verifying === chain.chainId ? "Verifying..." : "Verify"}
              </button>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-celestir-text-muted">Results</h2>
          {results.map((r, i) => (
            <div
              key={i}
              className={`glass-panel rounded-lg px-5 py-4 animate-fade-in ${
                r.result.valid
                  ? "!border-celestir-verify/20 shadow-[0_0_12px_rgba(46,204,113,0.06)]"
                  : "!border-celestir-alert/20 shadow-[0_0_12px_rgba(220,38,38,0.06)]"
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`status-dot ${r.result.valid ? "status-dot-verified" : "status-dot-rejected"}`} />
                  <span className="font-mono text-[13px] text-celestir-text-secondary">{r.chainId}</span>
                  <span
                    className={`text-[12px] font-bold tracking-wide ${
                      r.result.valid ? "text-celestir-verify" : "text-celestir-alert-light"
                    }`}
                  >
                    {r.result.valid ? "VERIFIED" : "FAILED"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono text-celestir-text-muted">
                  <span>{r.result.entryCount} entries</span>
                  <span>{new Date(r.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
              {r.result.error && (
                <p className="mt-3 text-[12px] text-celestir-alert-light font-mono pl-7">
                  {r.result.error.type}: {r.result.error.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
