import type { Context } from "hono";
import type { z } from "zod";

type ParseError = {
  readonly error: string;
  readonly details: ReadonlyArray<{ path: string; message: string }>;
};

type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: Response };

/** Parse and validate JSON request body against a Zod schema. */
export async function parseBody<T extends z.ZodType>(
  c: Context,
  schema: T
): Promise<ParseResult<z.infer<T>>> {
  const body: unknown = await c.req.json().catch(() => null);
  if (body === null) {
    return {
      ok: false,
      response: c.json(
        { error: "Request body must be valid JSON" } satisfies { error: string },
        400
      ),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return {
      ok: false,
      response: c.json(
        { error: "Validation failed", details } satisfies ParseError,
        400
      ),
    };
  }
  return { ok: true, value: result.data as z.infer<T> };
}

/** Parse and validate query parameters against a Zod schema. */
export function parseQuery<T extends z.ZodType>(
  c: Context,
  schema: T
): ParseResult<z.infer<T>> {
  const query = c.req.query();
  const result = schema.safeParse(query);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return {
      ok: false,
      response: c.json(
        { error: "Invalid query parameters", details } satisfies ParseError,
        400
      ),
    };
  }
  return { ok: true, value: result.data as z.infer<T> };
}
