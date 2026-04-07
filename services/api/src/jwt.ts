/**
 * Minimal JWT implementation using Node.js crypto (HMAC-SHA256).
 * No third-party JWT libraries - compliant with GridSeal crypto rules.
 */

import crypto from "node:crypto";

export type JwtPayload = {
  readonly tenantId: string;
  readonly iat?: number | undefined;
  readonly exp?: number | undefined;
};

type JwtHeader = {
  readonly alg: "HS256";
  readonly typ: "JWT";
};

const HEADER: JwtHeader = { alg: "HS256", typ: "JWT" };

function base64UrlEncode(data: Buffer): string {
  return data.toString("base64url");
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

function sign(input: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(input);
  return base64UrlEncode(hmac.digest());
}

/** Create a signed JWT containing a tenant ID. */
export function createTenantToken(
  tenantId: string,
  secret: string,
  expiresInSeconds?: number | undefined,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    tenantId,
    iat: now,
  };
  if (expiresInSeconds !== undefined) {
    payload["exp"] = now + expiresInSeconds;
  }

  const headerEncoded = base64UrlEncode(
    Buffer.from(JSON.stringify(HEADER), "utf-8"),
  );
  const payloadEncoded = base64UrlEncode(
    Buffer.from(JSON.stringify(payload), "utf-8"),
  );
  const signature = sign(`${headerEncoded}.${payloadEncoded}`, secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

export type VerifyResult =
  | { readonly ok: true; readonly payload: JwtPayload }
  | { readonly ok: false; readonly error: string };

/** Verify a JWT and extract the tenant payload. */
export function verifyTenantToken(
  token: string,
  secret: string,
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "Malformed token: expected 3 parts" };
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts as [string, string, string];

  const expectedSignature = sign(
    `${headerEncoded}.${payloadEncoded}`,
    secret,
  );

  const signatureBuf = Buffer.from(signatureEncoded, "utf-8");
  const expectedBuf = Buffer.from(expectedSignature, "utf-8");

  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return { ok: false, error: "Invalid signature" };
  }

  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecode(headerEncoded).toString("utf-8"));
  } catch {
    return { ok: false, error: "Malformed header" };
  }

  if (
    typeof header !== "object" ||
    header === null ||
    (header as Record<string, unknown>)["alg"] !== "HS256"
  ) {
    return { ok: false, error: "Unsupported algorithm" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString("utf-8"));
  } catch {
    return { ok: false, error: "Malformed payload" };
  }

  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Invalid payload" };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p["tenantId"] !== "string" || p["tenantId"].length === 0) {
    return { ok: false, error: "Missing or invalid tenantId in token" };
  }

  if (typeof p["exp"] === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (now >= p["exp"]) {
      return { ok: false, error: "Token expired" };
    }
  }

  return {
    ok: true,
    payload: {
      tenantId: p["tenantId"] as string,
      iat: typeof p["iat"] === "number" ? p["iat"] : undefined,
      exp: typeof p["exp"] === "number" ? p["exp"] : undefined,
    },
  };
}
