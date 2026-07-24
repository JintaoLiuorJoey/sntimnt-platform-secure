import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function pkceChallenge(verifier: string): string {
  return sha256(verifier);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function safeInternalReturnTo(value: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const base = new URL("https://app.example.invalid");
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return fallback;

    const blocked = new Set([
      "/login",
      "/401",
      "/403",
      "/unauthorized",
      "/forbidden",
      "/api/auth/login",
      "/api/auth/callback",
    ]);
    if (blocked.has(parsed.pathname)) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
