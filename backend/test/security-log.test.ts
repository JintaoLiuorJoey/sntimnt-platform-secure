import {
  describe,
  expect,
  it,
} from "vitest";
import {
  safeSecurityLog,
} from "../src/security-log.js";

describe("safe security logging contract", () => {
  it("emits only allowlisted event metadata", () => {
    const error =
      new Error(
        "routing=021000021 account=000123456789 token=secret",
      );

    const entry =
      safeSecurityLog(
        "business_decrypt_failed",
        {
          requestId: "request-123",
          error,
        },
      );

    expect(entry).toEqual({
      event: "business_decrypt_failed",
      requestId: "request-123",
      errorName: "Error",
    });

    const serialized =
      JSON.stringify(entry);

    expect(serialized).not.toContain(
      error.message,
    );
    expect(serialized).not.toContain(
      "021000021",
    );
    expect(serialized).not.toContain(
      "000123456789",
    );
    expect(serialized).not.toContain(
      "secret",
    );
    expect(serialized).not.toContain(
      "stack",
    );
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it("preserves only a safe error class name", () => {
    const error =
      new TypeError(
        "investor@example.com",
      );

    expect(
      safeSecurityLog(
        "business_record_rejected",
        {
          error,
        },
      ),
    ).toEqual({
      event: "business_record_rejected",
      errorName: "TypeError",
    });
  });

  it("omits malformed request identifiers", () => {
    expect(
      safeSecurityLog(
        "business_read_failed",
        {
          requestId:
            "request id investor@example.com",
        },
      ),
    ).toEqual({
      event: "business_read_failed",
    });
  });

  it("normalizes non-Error failures without serializing their values", () => {
    const entry =
      safeSecurityLog(
        "business_kms_failed",
        {
          error: {
            accessToken: "secret-token",
          },
        },
      );

    expect(entry).toEqual({
      event: "business_kms_failed",
      errorName: "Error",
    });

    expect(
      JSON.stringify(entry),
    ).not.toContain("secret-token");
  });

  it.each([
    "",
    "BusinessDecryptFailed",
    "business decrypt failed",
    "business/decrypt/failed",
  ])(
    "rejects an invalid event name: %s",
    (event) => {
      expect(() =>
        safeSecurityLog(event),
      ).toThrow(
        "Security log event name is invalid.",
      );
    },
  );
});
