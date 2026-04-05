import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Layout } from "./components/layout.js";
import { AuditTrailPage } from "./pages/audit-trail.js";
import { EntryDetailPage } from "./pages/entry-detail.js";
import { ChainVerificationPage } from "./pages/chain-verification.js";
import { SessionTreePage } from "./pages/session-tree.js";
import { NotFoundPage } from "./pages/not-found.js";

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/chains" replace />} />
          <Route path="/chains" element={<AuditTrailPage />} />
          <Route
            path="/chains/:chainId/entries/:entryId"
            element={<EntryDetailPage />}
          />
          <Route
            path="/chains/:chainId/sessions/:sessionId"
            element={<SessionTreePage />}
          />
          <Route path="/verify" element={<ChainVerificationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
