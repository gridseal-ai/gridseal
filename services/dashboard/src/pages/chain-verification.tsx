import { useState, useCallback } from "react";
import { fetchChains, validateChain } from "../api/client.js";
import { useAsync } from "../hooks/use-async.js";
import type { ValidationResult } from "../types.js";

type VerificationRun = {
  readonly chainId: string;
  readonly result: ValidationResult;
  readonly timestamp: string;
};

export function ChainVerificationPage(): React.JSX.Element {
  const chainsState = useAsync(() => fetchChains(), []);
  const [runs, setRuns] = useState<VerificationRun[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);

  const handleVerify = useCallback(async (chainId: string) => {
    setVerifying(chainId);
    try {
      const result = await validateChain(chainId);
      setRuns((prev) => [
        { chainId, result, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setRuns((prev) => [
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

  const handleVerifyAll = useCallback(async () => {
    if (chainsState.status !== "success" || !chainsState.data) return;
    for (const chain of chainsState.data.chains) {
      await handleVerify(chain.chainId);
    }
  }, [chainsState, handleVerify]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Chain Verification</h1>
          <p className="text-sm text-slate-500 mt-1">
            Verify cryptographic integrity of proof chains.
          </p>
        </div>
        {chainsState.status === "success" &&
          chainsState.data &&
          chainsState.data.chains.length > 0 && (
            <button
              onClick={handleVerifyAll}
              disabled={verifying !== null}
              className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              Verify All Chains
            </button>
          )}
      </div>

      {/* Chain list with verify buttons */}
      {chainsState.status === "loading" && (
        <p className="text-slate-500">Loading chains...</p>
      )}
      {chainsState.status === "error" && (
        <p className="text-red-400">{chainsState.error}</p>
      )}
      {chainsState.status === "success" && chainsState.data && (
        <div className="space-y-3">
          {chainsState.data.chains.length === 0 && (
            <p className="text-slate-500">No chains found.</p>
          )}
          {chainsState.data.chains.map((chain) => (
            <div
              key={chain.chainId}
              className="flex items-center justify-between bg-slate-900/30 border border-slate-800 rounded-lg px-4 py-3"
            >
              <div>
                <span className="font-mono text-sm text-slate-300">
                  {chain.chainId}
                </span>
                <span className="ml-3 text-xs text-slate-500">
                  {chain.entryCount} entries
                </span>
              </div>
              <button
                onClick={() => handleVerify(chain.chainId)}
                disabled={verifying === chain.chainId}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm transition-colors"
              >
                {verifying === chain.chainId ? "Verifying..." : "Verify"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {runs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Results
          </h2>
          {runs.map((run, i) => (
            <div
              key={i}
              className={`border rounded-lg px-4 py-3 ${
                run.result.valid
                  ? "border-emerald-800 bg-emerald-950/30"
                  : "border-red-800 bg-red-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      run.result.valid ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                  <span className="font-mono text-sm text-slate-300">
                    {run.chainId}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      run.result.valid ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {run.result.valid ? "PASS" : "FAIL"}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {run.result.entryCount} entries
                  <span className="ml-2">
                    {new Date(run.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              {run.result.error && (
                <p className="mt-2 text-sm text-red-400">
                  {run.result.error.type}: {run.result.error.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
