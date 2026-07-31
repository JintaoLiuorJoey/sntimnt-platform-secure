import { describe, expect, it } from "vitest";
import {
  parseTotpVerificationCode,
} from "../src/mfa-request.js";

describe("TOTP verification request parsing", () => {
  it("accepts an exact six-digit verification code", () => {
    expect(
      parseTotpVerificationCode(
        JSON.stringify({ userCode: "123456" }),
      ),
    ).toBe("123456");
  });

  it("accepts an API Gateway base64-encoded JSON body", () => {
    const body = Buffer.from(
      JSON.stringify({ userCode: "654321" }),
      "utf8",
    ).toString("base64");

    expect(
      parseTotpVerificationCode(body, true),
    ).toBe("654321");
  });

  it("rejects an absent request body", () => {
    expect(
      parseTotpVerificationCode(undefined),
    ).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(
      parseTotpVerificationCode("{"),
    ).toBeNull();
  });

  it("rejects unexpected request properties", () => {
    expect(
      parseTotpVerificationCode(
        JSON.stringify({
          userCode: "123456",
          accessToken: "must-not-be-accepted",
        }),
      ),
    ).toBeNull();
  });

  it.each([
    ["a numeric value", 123456],
    ["five digits", "12345"],
    ["seven digits", "1234567"],
    ["non-digit characters", "12 456"],
  ])(
    "rejects a verification code containing %s",
    (_description, userCode) => {
      expect(
        parseTotpVerificationCode(
          JSON.stringify({ userCode }),
        ),
      ).toBeNull();
    },
  );
});
