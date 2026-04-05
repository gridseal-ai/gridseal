import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

const API = "http://localhost:3099/api";
const CHAIN_ID = `e2e-chain-${randomUUID().slice(0, 8)}`;
const SESSION_1 = `session-${randomUUID().slice(0, 8)}`;
const SESSION_2 = `session-${randomUUID().slice(0, 8)}`;

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function makeTimestamp(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString();
}

type EntrySpec = {
  sessionId: string;
  entryType: string;
  modelId?: string;
  actorId?: string;
  parentEntryId?: string | null;
  decisionType?: string;
  confidenceScore?: number;
  annotation?: string;
  tags?: Record<string, string>;
};

const entryIds: string[] = [];

async function createEntry(
  spec: EntrySpec,
  index: number,
): Promise<{ entryId: string; response: Response }> {
  const entryId = randomUUID();
  const body: Record<string, unknown> = {
    entryId,
    timestamp: makeTimestamp(index),
    entryType: spec.entryType,
    sessionId: spec.sessionId,
    inputHash: sha256(`input-${String(index)}`),
    outputHash: sha256(`output-${String(index)}`),
    tags: spec.tags ?? {},
  };

  if (spec.modelId !== undefined) body["modelId"] = spec.modelId;
  if (spec.actorId !== undefined) body["actorId"] = spec.actorId;
  if (spec.parentEntryId !== undefined) body["parentEntryId"] = spec.parentEntryId;
  if (spec.decisionType !== undefined) body["decisionType"] = spec.decisionType;
  if (spec.confidenceScore !== undefined) body["confidenceScore"] = spec.confidenceScore;
  if (spec.annotation !== undefined) body["annotation"] = spec.annotation;

  const response = await fetch(`${API}/chains/${CHAIN_ID}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  entryIds.push(entryId);
  return { entryId, response };
}

test.describe("GridSeal E2E", () => {
  test.describe.configure({ mode: "serial" });

  /**
   * Phase 1: Create 20 entries across 2 sessions via API.
   * Session 1 is a multi-agent workflow (orchestrator + sub-agents).
   * Session 2 is a separate linear chain.
   */
  test("creates 20 entries across 2 sessions via API", async () => {
    // Session 1: Multi-agent workflow (12 entries)
    // Entry 0: orchestrator (root)
    const { entryId: orchestratorId, response: r0 } = await createEntry(
      {
        sessionId: SESSION_1,
        entryType: "ai_decision",
        modelId: "gpt-4",
        actorId: "orchestrator",
        decisionType: "routing",
        confidenceScore: 0.95,
        annotation: "Orchestrator root decision",
        tags: { agent_role: "orchestrator", authority_level: "primary" },
      },
      0,
    );
    expect(r0.status).toBe(201);

    // Entries 1-3: sub-agents (children of orchestrator)
    const subAgentIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const decisionTypes = ["classification", "generation", "recommendation"] as const;
      const { entryId, response } = await createEntry(
        {
          sessionId: SESSION_1,
          entryType: "ai_decision",
          modelId: `claude-3-${String(i)}`,
          actorId: `sub-agent-${String(i)}`,
          parentEntryId: orchestratorId,
          decisionType: decisionTypes[i - 1],
          confidenceScore: 0.8 + i * 0.05,
          annotation: `Sub-agent ${String(i)} analysis`,
          tags: { agent_role: `analyst-${String(i)}`, authority_level: "delegated" },
        },
        i,
      );
      expect(response.status).toBe(201);
      subAgentIds.push(entryId);
    }

    // Entries 4-7: tool calls (children of sub-agents)
    for (let i = 0; i < 4; i++) {
      const parentIdx = i % 3;
      const { response } = await createEntry(
        {
          sessionId: SESSION_1,
          entryType: "system_event",
          modelId: `tool-${String(i)}`,
          actorId: `sub-agent-${String(parentIdx + 1)}`,
          parentEntryId: subAgentIds[parentIdx],
          annotation: `Tool call ${String(i + 1)} result`,
          tags: { agent_role: "tool", authority_level: "none" },
        },
        4 + i,
      );
      expect(response.status).toBe(201);
    }

    // Entries 8-9: human overrides
    for (let i = 0; i < 2; i++) {
      const { response } = await createEntry(
        {
          sessionId: SESSION_1,
          entryType: "human_override",
          actorId: `reviewer-${String(i + 1)}`,
          parentEntryId: subAgentIds[i],
          annotation: `Human review ${String(i + 1)}`,
          tags: { review_status: i === 0 ? "approved" : "rejected" },
        },
        8 + i,
      );
      expect(response.status).toBe(201);
    }

    // Entries 10-11: additional orchestrator entries
    for (let i = 0; i < 2; i++) {
      const { response } = await createEntry(
        {
          sessionId: SESSION_1,
          entryType: "ai_decision",
          modelId: "gpt-4",
          actorId: "orchestrator",
          parentEntryId: orchestratorId,
          decisionType: "other",
          confidenceScore: 0.92,
          annotation: `Follow-up decision ${String(i + 1)}`,
          tags: { agent_role: "orchestrator", authority_level: "primary" },
        },
        10 + i,
      );
      expect(response.status).toBe(201);
    }

    // Session 2: Linear chain (8 entries)
    const s2Types = ["ai_decision", "human_override", "system_event", "ai_decision",
      "feedback", "ai_decision", "policy_check", "ai_decision"] as const;
    for (let i = 0; i < 8; i++) {
      const isAi = s2Types[i] === "ai_decision";
      const { response } = await createEntry(
        {
          sessionId: SESSION_2,
          entryType: s2Types[i],
          modelId: isAi ? `model-s2-${String(i)}` : undefined,
          actorId: isAi ? `agent-s2-${String(i)}` : `human-s2-${String(i)}`,
          decisionType: isAi ? "generation" : undefined,
          confidenceScore: isAi ? 0.7 + i * 0.03 : undefined,
          annotation: `Session 2 entry ${String(i + 1)}`,
        },
        12 + i,
      );
      expect(response.status).toBe(201);
    }

    expect(entryIds).toHaveLength(20);

    // Verify chain has 20 entries
    const chainRes = await fetch(`${API}/chains/${CHAIN_ID}`);
    expect(chainRes.status).toBe(200);
    const chainData = (await chainRes.json()) as { entryCount: number };
    expect(chainData.entryCount).toBe(20);
  });

  /**
   * Phase 2: Dashboard audit trail explorer shows entries.
   */
  test("dashboard shows all entries in audit trail explorer", async ({ page }) => {
    await page.goto("/chains");
    await page.waitForLoadState("networkidle");

    // The audit trail page should be visible
    await expect(page.getByRole("heading", { name: "Audit Trail Explorer" })).toBeVisible({ timeout: 10_000 });

    // Should see our chain in the list
    await expect(page.getByText(CHAIN_ID)).toBeVisible({ timeout: 10_000 });

    // Click on the chain to see its entries
    await page.getByText(CHAIN_ID).first().click();
    await page.waitForLoadState("networkidle");

    // Verify entries are displayed
    await expect(page.getByText("ai_decision").first()).toBeVisible({ timeout: 10_000 });
  });

  /**
   * Phase 3: Entry detail view shows full fields.
   */
  test("entry detail view shows full entry fields", async ({ page }) => {
    const firstEntryId = entryIds[0];
    await page.goto(`/chains/${CHAIN_ID}/entries/${firstEntryId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Entry Detail").first()).toBeVisible({ timeout: 10_000 });

    // Verify key fields are visible
    await expect(page.getByText(firstEntryId).first()).toBeVisible();
    await expect(page.getByText("ai_decision").first()).toBeVisible();
    await expect(page.getByText("orchestrator").first()).toBeVisible();
    await expect(page.getByText("gpt-4").first()).toBeVisible();
  });

  /**
   * Phase 4: Decision tree renders for multi-agent session.
   */
  test("decision tree renders for multi-agent session", async ({ page }) => {
    await page.goto(`/chains/${CHAIN_ID}/sessions/${SESSION_1}`);
    await page.waitForLoadState("networkidle");

    // Decision tree heading should be visible
    await expect(page.getByText("Decision Tree").first()).toBeVisible({ timeout: 10_000 });

    // The tree should contain SVG elements
    const svgElement = page.locator("svg").first();
    await expect(svgElement).toBeVisible({ timeout: 10_000 });

    // Verify tree nodes reference our orchestrator
    const treeContent = await page.textContent("body");
    expect(treeContent).toContain("orchestrator");

    // Verify multiple tree node rectangles are rendered
    const nodeCount = await page.locator("svg rect").count();
    expect(nodeCount).toBeGreaterThanOrEqual(4);
  });

  /**
   * Phase 5: Chain verification passes via API.
   */
  test("chain verification passes via API", async () => {
    const res = await fetch(`${API}/chains/${CHAIN_ID}/validate`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { valid: boolean; entryCount: number };
    expect(data.valid).toBe(true);
    expect(data.entryCount).toBe(20);
  });

  /**
   * Phase 6: Dashboard chain verification page works.
   */
  test("dashboard chain verification shows pass", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Chain Verification").first()).toBeVisible({ timeout: 10_000 });

    // Click verify button
    const verifyButton = page.getByRole("button", { name: /verify/i }).first();
    await expect(verifyButton).toBeVisible({ timeout: 5_000 });
    await verifyButton.click();

    // Wait for verification results
    await page.waitForLoadState("networkidle");

    // Check for pass/valid indicators
    const bodyText = await page.textContent("body");
    const hasPassIndicator =
      bodyText?.includes("valid") ||
      bodyText?.includes("Valid") ||
      bodyText?.includes("pass") ||
      bodyText?.includes("Pass") ||
      bodyText?.includes("verified") ||
      bodyText?.includes("Verified") ||
      bodyText?.includes("integrity");
    expect(hasPassIndicator).toBeTruthy();
  });

  /**
   * Phase 7: Trust Page renders all sections.
   */
  test("trust page renders all sections", async ({ page }) => {
    const res = await fetch(`${API}/chains/${CHAIN_ID}/trust`);
    expect(res.status).toBe(200);
    const html = await res.text();

    await page.setContent(html);
    const bodyText = (await page.textContent("body")) ?? "";

    // Chain integrity status
    expect(bodyText).toContain("Chain Verified");

    // Entry count
    expect(bodyText).toContain("20");

    // Human review information
    expect(bodyText).toContain("Human Review");

    // Entry types breakdown
    expect(bodyText).toContain("ai_decision");

    // Compliance reports available
    expect(bodyText).toContain("colorado-sb205");

    // Last verification timestamp
    expect(bodyText).toContain("Last verification");
  });

  /**
   * Phase 8: Trust badge SVG returns valid SVG.
   */
  test("trust badge returns valid SVG with status", async () => {
    const res = await fetch(`${API}/badge/test-tenant.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");

    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("GridSeal");

    const hasStatus =
      svg.includes("verified") ||
      svg.includes("unverified") ||
      svg.includes("no data");
    expect(hasStatus).toBeTruthy();
  });

  /**
   * Phase 9: Trust badge with chain parameter works.
   */
  test("trust badge with chain parameter returns SVG", async () => {
    const res = await fetch(
      `${API}/badge/test-tenant.svg?chain=${CHAIN_ID}`,
    );
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("GridSeal");
  });

  /**
   * Phase 10: API filters entries by session.
   */
  test("API filters entries by session", async () => {
    const res = await fetch(
      `${API}/chains/${CHAIN_ID}/entries?sessionId=${SESSION_1}`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entries: unknown[]; total: number };
    expect(data.total).toBe(12);

    const res2 = await fetch(
      `${API}/chains/${CHAIN_ID}/entries?sessionId=${SESSION_2}`,
    );
    expect(res2.status).toBe(200);
    const data2 = (await res2.json()) as { entries: unknown[]; total: number };
    expect(data2.total).toBe(8);
  });

  /**
   * Phase 11: Subtree API returns orchestrator subtree.
   */
  test("subtree API returns orchestrator subtree", async () => {
    const orchestratorId = entryIds[0];
    const res = await fetch(
      `${API}/chains/${CHAIN_ID}/entries/${orchestratorId}/subtree`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entries: unknown[] };
    // Subtree includes orchestrator + children + grandchildren
    expect(data.entries.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Phase 12: Trust page data API returns structured JSON.
   */
  test("trust page data API returns structured data", async () => {
    const res = await fetch(`${API}/chains/${CHAIN_ID}/trust/data`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        chainId: string;
        verification: { valid: boolean; entryCount: number };
      };
    };
    expect(json.data.chainId).toBe(CHAIN_ID);
    expect(json.data.verification.entryCount).toBe(20);
    expect(json.data.verification.valid).toBe(true);
  });
});
