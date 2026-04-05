import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router";
import { ChainsPage } from "./pages/chains-page";
import { ChainDetailPage } from "./pages/chain-detail-page";
import { EntryDetailPage } from "./pages/entry-detail-page";
import { CertificatePage } from "./pages/certificate-page";
import { ProvenancePage } from "./pages/provenance-page";

export function App(): ReactNode {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-gray-700">
              GridSeal
            </Link>
            <span className="text-xs text-gray-400">Audit Dashboard</span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Routes>
            <Route path="/" element={<ChainsPage />} />
            <Route path="/chains/:chainId" element={<ChainDetailPage />} />
            <Route path="/chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
            <Route path="/certificates/:certificateId" element={<CertificatePage />} />
            <Route path="/provenance/:provenanceId" element={<ProvenancePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
