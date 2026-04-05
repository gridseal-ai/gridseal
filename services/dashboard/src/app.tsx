import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout.tsx";
import { ChainsPage } from "./pages/chains.tsx";
import { ChainDetailPage } from "./pages/chain-detail.tsx";
import { EntryDetailPage } from "./pages/entry-detail.tsx";
import { NotFoundPage } from "./pages/not-found.tsx";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ChainsPage />} />
          <Route path="/chains/:chainId" element={<ChainDetailPage />} />
          <Route
            path="/chains/:chainId/entries/:entryId"
            element={<EntryDetailPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
