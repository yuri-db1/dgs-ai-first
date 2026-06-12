import pino from "pino";

/**
 * Structured logger shared across the project.
 *
 * Coding standard (see handler stub / AGENTS.md): NEVER use console.log — emit
 * structured events through this logger so logs are queryable and consistent.
 * Level is configurable via LOG_LEVEL (defaults to "info").
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
