import type { StorageAdapter } from "@gridseal/core";
import { validateChain } from "@gridseal/core";

/** Badge status derived from chain verification. */
export type BadgeStatus = "verified" | "unverified" | "no_data";

/** Data needed to render a badge. */
export type BadgeData = {
  readonly status: BadgeStatus;
  readonly entryCount: number;
  readonly chainCount: number;
  readonly trustPageUrl: string | null;
};

/** Options for generating a badge. */
export type BadgeOptions = {
  /** Tenant slug used in the badge URL path. */
  readonly tenantSlug: string;
  /** Optional chain ID to check a specific chain. If omitted, all chains are checked. */
  readonly chainId?: string | undefined;
  /** Base URL for constructing the trust page link. */
  readonly baseUrl?: string | undefined;
};

/** Compute badge status from storage. */
export async function computeBadgeData(
  storage: StorageAdapter,
  options: BadgeOptions,
): Promise<BadgeData> {
  const { chainId, baseUrl } = options;

  if (chainId) {
    const entries = await storage.getEntriesByChainId(chainId);
    if (entries.length === 0) {
      return { status: "no_data", entryCount: 0, chainCount: 0, trustPageUrl: null };
    }
    const result = validateChain({ chainId, entries: [...entries] });
    const trustPageUrl = baseUrl
      ? `${baseUrl}/chains/${encodeURIComponent(chainId)}/trust`
      : null;
    return {
      status: result.ok ? "verified" : "unverified",
      entryCount: entries.length,
      chainCount: 1,
      trustPageUrl,
    };
  }

  const chainIds = await storage.listChainIds();
  if (chainIds.length === 0) {
    return { status: "no_data", entryCount: 0, chainCount: 0, trustPageUrl: null };
  }

  let totalEntries = 0;
  let allValid = true;
  let firstChainId: string | null = null;

  for (const cid of chainIds) {
    const entries = await storage.getEntriesByChainId(cid);
    totalEntries += entries.length;
    if (entries.length > 0) {
      if (firstChainId === null) {
        firstChainId = cid;
      }
      const result = validateChain({ chainId: cid, entries: [...entries] });
      if (!result.ok) {
        allValid = false;
      }
    }
  }

  if (totalEntries === 0) {
    return { status: "no_data", entryCount: 0, chainCount: chainIds.length, trustPageUrl: null };
  }

  const trustPageUrl =
    baseUrl && firstChainId
      ? `${baseUrl}/chains/${encodeURIComponent(firstChainId)}/trust`
      : null;

  return {
    status: allValid ? "verified" : "unverified",
    entryCount: totalEntries,
    chainCount: chainIds.length,
    trustPageUrl,
  };
}

/** Colors for the badge. */
const COLORS = {
  label: "#0A1628",
  verified: "#1B6B9A",
  unverified: "#c0392b",
  noData: "#6b7280",
  text: "#ffffff",
} as const;

/** Measure approximate text width for a sans-serif font at 11px. */
function measureText(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (ch === "i" || ch === "l" || ch === "!" || ch === "." || ch === "|") {
      width += 4;
    } else if (ch === "m" || ch === "w" || ch === "M" || ch === "W") {
      width += 9;
    } else if (ch >= "A" && ch <= "Z") {
      width += 7.5;
    } else {
      width += 6.5;
    }
  }
  return Math.ceil(width);
}

/**
 * Render a shield-style SVG badge showing chain integrity status.
 * The badge links to the trust page when a URL is provided.
 */
export function renderBadgeSvg(data: BadgeData): string {
  const labelText = "GridSeal";
  const statusText =
    data.status === "verified"
      ? "verified"
      : data.status === "unverified"
        ? "unverified"
        : "no data";

  const statusColor =
    data.status === "verified"
      ? COLORS.verified
      : data.status === "unverified"
        ? COLORS.unverified
        : COLORS.noData;

  const labelPadding = 12;
  const statusPadding = 12;
  const labelWidth = measureText(labelText) + labelPadding;
  const statusWidth = measureText(statusText) + statusPadding;
  const totalWidth = labelWidth + statusWidth;
  const height = 20;

  const labelX = labelWidth / 2;
  const statusX = labelWidth + statusWidth / 2;

  const escapedUrl = data.trustPageUrl
    ? data.trustPageUrl
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    : null;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(totalWidth)}" height="${String(height)}" role="img" aria-label="${labelText}: ${statusText}">
  <title>${labelText}: ${statusText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${String(totalWidth)}" height="${String(height)}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${String(labelWidth)}" height="${String(height)}" fill="${COLORS.label}"/>
    <rect x="${String(labelWidth)}" width="${String(statusWidth)}" height="${String(height)}" fill="${statusColor}"/>
    <rect width="${String(totalWidth)}" height="${String(height)}" fill="url(#s)"/>
  </g>
  <g fill="${COLORS.text}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${String(labelX)}" y="15" fill="#010101" fill-opacity=".3">${labelText}</text>
    <text x="${String(labelX)}" y="14">${labelText}</text>
    <text aria-hidden="true" x="${String(statusX)}" y="15" fill="#010101" fill-opacity=".3">${statusText}</text>
    <text x="${String(statusX)}" y="14">${statusText}</text>
  </g>
</svg>`;

  if (escapedUrl) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(totalWidth)}" height="${String(height)}">
  <a xlink:href="${escapedUrl}">
    ${svgContent}
  </a>
</svg>`;
  }

  return svgContent;
}
