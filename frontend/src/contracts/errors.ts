/** A field-level problem, mapped from FastAPI's 422 `detail` array. */
export type FieldError = {
  /** Dotted path into the request body, e.g. "prompt" or "steps". */
  field: string;
  message: string;
};

/**
 * Every failure that leaves the service layer is one of these. Screens branch on
 * `status`, never on a message string.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  readonly fieldErrors: FieldError[];
  /** True when the request never reached the server (offline, DNS, CORS). */
  readonly isNetworkError: boolean;

  constructor(init: {
    status: number;
    message: string;
    detail?: string | null;
    fieldErrors?: FieldError[];
    isNetworkError?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.detail = init.detail ?? null;
    this.fieldErrors = init.fieldErrors ?? [];
    this.isNetworkError = init.isNetworkError ?? false;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
