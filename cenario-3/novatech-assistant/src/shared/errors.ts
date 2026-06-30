// Custom error taxonomy. Each error carries an HTTP status and a stable machine
// code so handlers can map failures to responses without string matching.

/** Base class for application errors. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    // new.target keeps the concrete subclass name (ValidationError, ...).
    this.name = new.target.name;
  }
}

/** One field-level validation problem, safe to return to the client. */
export interface FieldIssue {
  field: string;
  message: string;
}

/** Input failed schema validation. Maps to HTTP 400. */
export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly issues: FieldIssue[],
  ) {
    super(message, 400, "VALIDATION_ERROR");
  }
}
