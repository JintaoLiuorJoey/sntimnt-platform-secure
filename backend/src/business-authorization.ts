import { sha256 } from "./security.js";
import type { SessionRecord } from "./types.js";

export type InvestorBusinessScopeDecision =
  | {
      status: "authentication-required";
    }
  | {
      status: "forbidden";
    }
  | {
      status: "allow";
      ownerPartitionKey: string;
    };

const OWNER_PARTITION_PREFIX = "BUSINESS#OWNER#";

export function investorBusinessScope(
  record: SessionRecord | null,
): InvestorBusinessScopeDecision {
  if (
    !record ||
    typeof record.subject !== "string" ||
    record.subject.length === 0
  ) {
    return {
      status: "authentication-required",
    };
  }

  if (!record.user.roles.includes("investor")) {
    return {
      status: "forbidden",
    };
  }

  return {
    status: "allow",
    ownerPartitionKey: `${OWNER_PARTITION_PREFIX}${sha256(record.subject)}`,
  };
}