import type { TrustPageData } from "./aggregate-types.js";
import { TRUST_PAGE_CSS } from "./styles.js";
import {
  renderVerificationBadge,
  renderOverviewStats,
  renderHumanReview,
  renderTimeline,
  renderEntryTypeTable,
  renderDecisionTypeTable,
  renderModelUsageTable,
  renderComplianceAvailability,
  renderCertificates,
  renderProvenance,
  renderPolicies,
} from "./render-sections.js";

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Format milliseconds as a human-readable duration. */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${String(ms)}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${String(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remainSec = seconds % 60;
    return remainSec > 0
      ? `${String(minutes)}m ${String(remainSec)}s`
      : `${String(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  if (hours < 24) {
    return remainMin > 0
      ? `${String(hours)}h ${String(remainMin)}m`
      : `${String(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0
    ? `${String(days)}d ${String(remainHours)}h`
    : `${String(days)}d`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toUTCString();
}

/** Render TrustPageData into a complete, self-contained HTML document. */
export function renderTrustPage(data: TrustPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trust Page - ${escapeHtml(data.chainId)}</title>
  <style>${TRUST_PAGE_CSS}</style>
</head>
<body>
  <div class="header">
    <h1>GridSeal Trust Page</h1>
    <p class="chain-id">Chain: ${escapeHtml(data.chainId)}</p>
    <p>Generated ${escapeHtml(formatTimestamp(data.generatedAt))}</p>
    ${renderVerificationBadge(data)}
  </div>

  <div class="section">
    <h2>Overview</h2>
    ${renderOverviewStats(data)}
  </div>

  <div class="section">
    <h2>Human Review</h2>
    ${renderHumanReview(data)}
  </div>

  <div class="section">
    <h2>Timeline</h2>
    ${renderTimeline(data)}
  </div>

  <div class="section">
    <h2>Entry Types</h2>
    ${renderEntryTypeTable(data.entryTypeCounts)}
  </div>

  <div class="section">
    <h2>AI Decision Types</h2>
    ${renderDecisionTypeTable(data.decisionTypeCounts)}
  </div>

  <div class="section">
    <h2>Model Usage</h2>
    ${renderModelUsageTable(data.modelUsage)}
  </div>

  <div class="section">
    <h2>Compliance Report Availability</h2>
    ${renderComplianceAvailability(data)}
  </div>

  <div class="section">
    <h2>Reasoning Certificates</h2>
    ${renderCertificates(data.certificates)}
  </div>

  <div class="section">
    <h2>Model Provenance</h2>
    ${renderProvenance(data.provenanceRecords)}
  </div>

  <div class="section">
    <h2>Compliance Policies</h2>
    ${renderPolicies(data.policyIds)}
  </div>

  <div class="footer">
    <p>GridSeal - Tamper-evident audit trail for AI decisions</p>
    <p>Last verification: ${escapeHtml(formatTimestamp(data.lastVerificationTimestamp))}</p>
    <p>Chain verification uses SHA-256 hash chaining. Each entry's hash includes its content and the previous entry's hash.</p>
  </div>
</body>
</html>`;
}
