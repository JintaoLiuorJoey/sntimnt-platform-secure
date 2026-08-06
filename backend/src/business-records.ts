export const INVESTMENT_ACCOUNT_KIND =
  "investment-account" as const;

export const INVESTMENT_ACCOUNT_SCHEMA_VERSION =
  1 as const;

export const INVESTMENT_ACCOUNT_SORT_KEY_PREFIX =
  "BUSINESS#INVESTMENT_ACCOUNT#" as const;

export const MAX_INVESTMENT_ACCOUNTS_PER_OWNER =
  100 as const;

export const INVESTMENT_ACCOUNT_STATUSES = [
  "pending-funding",
  "active",
  "restricted",
  "closed",
] as const;

export type InvestmentAccountStatus =
  (typeof INVESTMENT_ACCOUNT_STATUSES)[number];

export const INVESTMENT_ACCOUNT_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

export interface InvestmentAccountRecord {
  pk: string;
  sk: string;
  kind: typeof INVESTMENT_ACCOUNT_KIND;
  schemaVersion:
    typeof INVESTMENT_ACCOUNT_SCHEMA_VERSION;
  accountId: string;
  displayName: string;
  status: InvestmentAccountStatus;
  baseCurrency: "USD";
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentAccountSummary {
  id: string;
  displayName: string;
  status: InvestmentAccountStatus;
  baseCurrency: "USD";
  createdAt: string;
  updatedAt: string;
}