import type { Context, Next } from "hono";
import { verifyTenantToken } from "../jwt.js";

/**
 * Extract API key/token from the Authorization header.
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

export type AuthMode =
  | { readonly type: "none" }
  | { readonly type: "api-key"; readonly apiKeys: ReadonlySet<string> }
  | { readonly type: "jwt"; readonly secret: string };

export type AuthConfig = {
  readonly mode: AuthMode;
};

/**
 * Middleware that authenticates requests and sets tenantId on context.
 *
 * - mode "none": all requests pass, no tenantId set
 * - mode "api-key": validates against a static key set, no tenantId (legacy)
 * - mode "jwt": decodes JWT, validates signature, extracts tenantId
 */
export function tenantAuth(config: AuthConfig) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    if (config.mode.type === "none") {
      await next();
      return;
    }

    const token = extractApiKey(c.req.header("Authorization"));
    if (!token) {
      return c.json(
        { error: "Missing API key. Provide Authorization: Bearer <token>" },
        401,
      );
    }

    if (config.mode.type === "api-key") {
      if (!config.mode.apiKeys.has(token)) {
        return c.json({ error: "Invalid API key" }, 403);
      }
      await next();
      return;
    }

    // JWT mode
    const result = verifyTenantToken(token, config.mode.secret);
    if (!result.ok) {
      return c.json({ error: `Authentication failed: ${result.error}` }, 403);
    }

    c.set("tenantId", result.payload.tenantId);
    await next();
  };
}

/**
 * Legacy API key auth for backwards compatibility.
 * @deprecated Use tenantAuth instead.
 */
export function apiKeyAuth(config: { readonly apiKeys: ReadonlySet<string> }) {
  if (config.apiKeys.size === 0) {
    return tenantAuth({ mode: { type: "none" } });
  }
  return tenantAuth({ mode: { type: "api-key", apiKeys: config.apiKeys } });
}
