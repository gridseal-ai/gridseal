import type { ErrorHandler } from "hono";

/** Global error handler for the Hono app. */
export const errorHandler: ErrorHandler = (error, c) => {
  const status = "status" in error && typeof error.status === "number"
    ? error.status
    : 500;

  const safeStatus = (status >= 200 && status <= 599 ? status : 500) as 400 | 500;

  if (safeStatus >= 500) {
    return c.json({ error: "Internal server error" }, safeStatus);
  }

  return c.json({ error: error.message }, safeStatus);
};
