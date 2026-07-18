/**
 * Single source of truth for placeholder portfolio values shared
 * across the Dashboard and Performance screens.
 */

export const CURRENT_PORTFOLIO_VALUE = 124350;

export const formatPortfolioValue = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
