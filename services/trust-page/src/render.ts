import type { TrustPageData } from "./aggregate.js";
import { TRUST_PAGE_CSS } from "./styles.js";

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
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

function renderVerificationBadge(data: TrustPageData): string {
  if (data.verification.valid) {
    return `<div class="badge badge-valid">
      <span class="badge-icon">&#x2713;</span> Chain Verified
    </div>
    <p>${escapeHtml(formatNumber(data.verification.entryCount))} entries, all hashes valid</p>`;
  }
  let errorHtml = "";
  if (data.verification.errorDetail !== null) {
    errorHtml = `<div class="error-detail">
      <strong>${escapeHtml(data.verification.errorType ?? "UNKNOWN")}</strong>:
      ${escapeHtml(data.verification.errorDetail)}
    </div>`;
  }
  return `<div class="badge badge-invalid">
      <span class="badge-icon">&#x2717;</span> Verification Failed
    </div>
    ${errorHtml}`;
}

function renderOverviewStats(data: TrustPageData): string {
  const totalTokensIn = data.modelUsage.reduce(
    (sum, m) => sum + m.totalInputTokens,
    0,
  );
  const totalTokensOut = data.modelUsage.reduce(
    (sum, m) => sum + m.totalOutputTokens,
    0,
  );
  const reviewPercent = Math.round(data.humanReview.reviewRate * 100);
  return `<div class="grid">
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(data.verification.entryCount))}</div>
      <div class="stat-label">Total Entries</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(data.modelUsage.length))}</div>
      <div class="stat-label">Models Used</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(data.uniqueActors.length))}</div>
      <div class="stat-label">Unique Actors</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(data.uniqueSessions.length))}</div>
      <div class="stat-label">Sessions</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(totalTokensIn + totalTokensOut))}</div>
      <div class="stat-label">Total Tokens</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(String(reviewPercent))}%</div>
      <div class="stat-label">Human Review Rate</div>
    </div>
  </div>`;
}

function renderEntryTypeTable(
  counts: TrustPageData["entryTypeCounts"],
): string {
  const entries = Object.entries(counts).sort(
    (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
  );
  if (entries.length === 0) {
    return `<p class="empty">No entries recorded.</p>`;
  }
  const rows = entries
    .map(
      ([type, count]) =>
        `<tr><td>${escapeHtml(type)}</td><td>${escapeHtml(formatNumber(count ?? 0))}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Entry Type</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDecisionTypeTable(
  counts: TrustPageData["decisionTypeCounts"],
): string {
  const entries = Object.entries(counts).sort(
    (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
  );
  if (entries.length === 0) {
    return `<p class="empty">No AI decisions recorded.</p>`;
  }
  const rows = entries
    .map(
      ([type, count]) =>
        `<tr><td>${escapeHtml(type)}</td><td>${escapeHtml(formatNumber(count ?? 0))}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Decision Type</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderModelUsageTable(
  models: TrustPageData["modelUsage"],
): string {
  if (models.length === 0) {
    return `<p class="empty">No model usage recorded.</p>`;
  }
  const rows = models
    .map(
      (m) => `<tr>
          <td>${escapeHtml(m.modelId)}</td>
          <td>${escapeHtml(m.modelProvider)}</td>
          <td>${escapeHtml(formatNumber(m.entryCount))}</td>
          <td>${escapeHtml(formatNumber(m.totalInputTokens))}</td>
          <td>${escapeHtml(formatNumber(m.totalOutputTokens))}</td>
        </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr>
      <th>Model</th><th>Provider</th><th>Calls</th><th>Input Tokens</th><th>Output Tokens</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTimeline(data: TrustPageData): string {
  const { timeline } = data;
  if (timeline.firstEntryTimestamp === null) {
    return `<p class="empty">No timeline data available.</p>`;
  }
  const duration =
    timeline.durationMs !== null
      ? formatDuration(timeline.durationMs)
      : "N/A";
  return `<div class="grid">
    <div class="stat">
      <div class="stat-value" style="font-size:0.9rem">${escapeHtml(formatTimestamp(timeline.firstEntryTimestamp))}</div>
      <div class="stat-label">First Entry</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="font-size:0.9rem">${escapeHtml(formatTimestamp(timeline.lastEntryTimestamp ?? timeline.firstEntryTimestamp))}</div>
      <div class="stat-label">Last Entry</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(duration)}</div>
      <div class="stat-label">Duration</div>
    </div>
  </div>`;
}

function renderHumanReview(data: TrustPageData): string {
  const { humanReview } = data;
  const total = humanReview.approved + humanReview.rejected + humanReview.pending;
  if (total === 0) {
    return `<p class="empty">No entries have been reviewed.</p>`;
  }
  const approvedPct = total > 0 ? (humanReview.approved / total) * 100 : 0;
  const rejectedPct = total > 0 ? (humanReview.rejected / total) * 100 : 0;
  const pendingPct = total > 0 ? (humanReview.pending / total) * 100 : 0;
  const reviewPercent = Math.round(humanReview.reviewRate * 100);
  return `<div class="grid">
    <div class="stat">
      <div class="stat-value">${escapeHtml(String(reviewPercent))}%</div>
      <div class="stat-label">Review Rate</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(humanReview.approved))}</div>
      <div class="stat-label">Approved</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(humanReview.rejected))}</div>
      <div class="stat-label">Rejected</div>
    </div>
    <div class="stat">
      <div class="stat-value">${escapeHtml(formatNumber(humanReview.pending))}</div>
      <div class="stat-label">Pending</div>
    </div>
  </div>
  <div class="review-bar">
    <div class="review-approved" style="width:${String(Math.round(approvedPct))}%"></div>
    <div class="review-rejected" style="width:${String(Math.round(rejectedPct))}%"></div>
    <div class="review-pending" style="width:${String(Math.round(pendingPct))}%"></div>
  </div>`;
}

function renderComplianceAvailability(data: TrustPageData): string {
  if (data.complianceAvailability.length === 0) {
    return `<p class="empty">No compliance regulations configured.</p>`;
  }
  const items = data.complianceAvailability
    .map(
      (c) =>
        `<li class="compliance-item">
          <span class="compliance-check">${c.available ? "&#x2713;" : "&#x2013;"}</span>
          <span>${escapeHtml(c.regulationId)}</span>
        </li>`,
    )
    .join("");
  return `<ul class="compliance-list">${items}</ul>`;
}

function renderCertificates(
  certs: TrustPageData["certificates"],
): string {
  if (certs.length === 0) {
    return `<p class="empty">No reasoning certificates attached.</p>`;
  }
  const rows = certs
    .map(
      (c) => `<tr>
          <td class="mono">${escapeHtml(c.certificateId.slice(0, 8))}...</td>
          <td>${escapeHtml(c.modelId)}</td>
          <td>${escapeHtml(formatNumber(c.claimCount))}</td>
          <td>${escapeHtml(formatNumber(c.unsupportedClaimCount))}</td>
          <td>
            ${escapeHtml(c.confidenceLevel)} (${escapeHtml(String(Math.round(c.confidenceScore * 100)))}%)
            <div class="confidence-bar"><div class="confidence-fill" style="width:${String(Math.round(c.confidenceScore * 100))}%"></div></div>
          </td>
        </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr>
      <th>ID</th><th>Model</th><th>Claims</th><th>Unsupported</th><th>Confidence</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderProvenance(
  records: TrustPageData["provenanceRecords"],
): string {
  if (records.length === 0) {
    return `<p class="empty">No model provenance records attached.</p>`;
  }
  const rows = records
    .map(
      (p) => `<tr>
          <td>${escapeHtml(p.modelName)}</td>
          <td>${escapeHtml(p.modelVersion)}</td>
          <td>${escapeHtml(p.modelProvider)}</td>
          <td>${escapeHtml(formatNumber(p.datasetCount))}</td>
          <td>${escapeHtml(formatNumber(p.metricCount))}</td>
          <td>${escapeHtml(formatNumber(p.ethicalConsiderationCount))}</td>
        </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr>
      <th>Model</th><th>Version</th><th>Provider</th><th>Datasets</th><th>Metrics</th><th>Ethics</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderPolicies(policyIds: ReadonlyArray<string>): string {
  if (policyIds.length === 0) {
    return `<p class="empty">No compliance policies evaluated.</p>`;
  }
  return policyIds
    .map((id) => `<span class="tag">${escapeHtml(id)}</span>`)
    .join(" ");
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
