import type { Context, Next } from "hono";

/**
 * Extract API key from the Authorization header.
 * Accepts format: "Bearer <key>" or plain "<key>".
 */
function extractApiKey(header: string | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed === "Bearer") return null;
  if (trimmed.startsWith("Bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  return trimmed || null;
}

export type AuthConfig = {
  /** Set of valid API keys. If empty/undefined, auth is disabled. */
  readonly apiKeys: ReadonlySet<string>;
};

/** Middleware that validates API key from Authorization header. */
export function apiKeyAuth(config: AuthConfig) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    if (config.apiKeys.size === 0) {
      await next();
      return;
    }

    const apiKey = extractApiKey(c.req.header("Authorization"));
    if (!apiKey) {
      return c.json(
        { error: "Missing API key. Provide Authorization: Bearer <key>" },
        401,
      );
    }

    if (!config.apiKeys.has(apiKey)) {
      return c.json({ error: "Invalid API key" }, 403);
    }

    await next();
  };
}
