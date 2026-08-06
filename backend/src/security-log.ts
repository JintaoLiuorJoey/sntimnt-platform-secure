const EVENT_NAME_PATTERN =
  /^[a-z][a-z0-9_]{2,63}$/;

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const ERROR_NAME_PATTERN =
  /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export interface SafeSecurityLog {
  readonly event: string;
  readonly requestId?: string;
  readonly errorName?: string;
}

function safeRequestId(
  value: string | null | undefined,
): string | undefined {
  if (
    typeof value !== "string" ||
    !REQUEST_ID_PATTERN.test(value)
  ) {
    return undefined;
  }

  return value;
}

function safeErrorName(
  error: unknown,
): string | undefined {
  if (error === undefined) {
    return undefined;
  }

  if (
    error instanceof Error &&
    ERROR_NAME_PATTERN.test(error.name)
  ) {
    return error.name;
  }

  return "Error";
}

export function safeSecurityLog(
  event: string,
  options: {
    readonly requestId?: string | null;
    readonly error?: unknown;
  } = {},
): SafeSecurityLog {
  if (!EVENT_NAME_PATTERN.test(event)) {
    throw new Error(
      "Security log event name is invalid.",
    );
  }

  const requestId =
    safeRequestId(options.requestId);

  const errorName =
    safeErrorName(options.error);

  return Object.freeze({
    event,
    ...(requestId ? { requestId } : {}),
    ...(errorName ? { errorName } : {}),
  });
}
