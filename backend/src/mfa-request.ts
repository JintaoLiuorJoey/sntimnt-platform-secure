const MAX_TOTP_REQUEST_BYTES = 256;

function decodedBody(
  body: string,
  isBase64Encoded: boolean,
): string | null {
  if (!isBase64Encoded) {
    return body;
  }

  const normalized = body.replace(/\s/g, "");

  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    return null;
  }

  try {
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function parseTotpVerificationCode(
  body: string | undefined,
  isBase64Encoded = false,
): string | null {
  if (!body) {
    return null;
  }

  const decoded = decodedBody(body, isBase64Encoded);

  if (
    decoded === null ||
    Buffer.byteLength(decoded, "utf8") >
      MAX_TOTP_REQUEST_BYTES
  ) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const keys = Object.keys(candidate);

  if (
    keys.length !== 1 ||
    keys[0] !== "userCode" ||
    typeof candidate.userCode !== "string" ||
    !/^[0-9]{6}$/.test(candidate.userCode)
  ) {
    return null;
  }

  return candidate.userCode;
}
