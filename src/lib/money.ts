// All arithmetic happens in integer minor units (paise/cents). Floats never touch a stored amount.

export const MINOR_UNITS_PER_MAJOR = 100;

export function toMinor(major: string | number): number {
  const value = typeof major === "string" ? Number(major.replace(/,/g, "")) : major;
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * MINOR_UNITS_PER_MAJOR);
}

export function toMajor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toMajor(minor));
}

/**
 * Largest-remainder (Hamilton) apportionment.
 *
 * Floors every weighted amount, then hands the leftover minor units out one at a time to whoever
 * lost the most to rounding. Guarantees the parts sum to exactly `totalMinor`, which plain
 * division does not — that's the classic "splits to 19.99 instead of 20.00" bug.
 *
 * Ties break toward the earlier index so the result is deterministic.
 */
export function apportion(totalMinor: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return new Array(n).fill(0);

  const negative = totalMinor < 0;
  const magnitude = Math.abs(totalMinor);

  // Integer numerator keeps the floor exact; no floating-point drift before the floor.
  const floors = weights.map((w) => Math.floor((magnitude * w) / totalWeight));
  const remainders = weights.map((w, i) => (magnitude * w) / totalWeight - floors[i]);

  let leftover = magnitude - floors.reduce((sum, v) => sum + v, 0);

  const order = remainders
    .map((frac, i) => ({ frac, i }))
    .sort((a, b) => (b.frac === a.frac ? a.i - b.i : b.frac - a.frac));

  const result = [...floors];
  for (let k = 0; leftover > 0 && k < order.length; k++, leftover--) {
    result[order[k].i] += 1;
  }

  return negative ? result.map((v) => -v) : result;
}

export function splitEqual(totalMinor: number, participantCount: number): number[] {
  return apportion(totalMinor, new Array(participantCount).fill(1));
}

/** `percents` are whole percents (e.g. 33.5). Converted to integer basis points before weighting. */
export function splitByPercent(totalMinor: number, percents: number[]): number[] {
  return apportion(totalMinor, percents.map((p) => Math.round(p * 100)));
}

/** `units` are relative shares, e.g. [2, 1, 1] for "Ravi eats double". */
export function splitByShares(totalMinor: number, units: number[]): number[] {
  return apportion(totalMinor, units.map((u) => Math.max(0, Math.round(u))));
}

export function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

export type SplitMethod = "equal" | "exact" | "percent" | "shares";

/**
 * Turns raw form input into per-participant minor-unit amounts.
 * `exact` is passed through untouched — the user typed the amounts, so we validate rather than round.
 */
export function computeShares(
  method: SplitMethod,
  totalMinor: number,
  inputs: number[]
): number[] {
  switch (method) {
    case "equal":
      return splitEqual(totalMinor, inputs.length);
    case "exact":
      return inputs.map((v) => Math.round(v));
    case "percent":
      return splitByPercent(totalMinor, inputs);
    case "shares":
      return splitByShares(totalMinor, inputs);
  }
}

export function reconciliationError(
  method: SplitMethod,
  totalMinor: number,
  shares: number[],
  inputs: number[],
  currency: string
): string | null {
  if (shares.length === 0) return "Pick at least one person to split between.";
  if (shares.some((v) => v < 0)) return "Shares can't be negative.";

  if (method === "percent") {
    const totalPercent = sum(inputs.map((p) => Math.round(p * 100)));
    if (totalPercent !== 10_000) {
      return `Percentages add up to ${(totalPercent / 100).toFixed(2)}%, not 100%.`;
    }
  }

  if (method === "shares" && sum(inputs) <= 0) {
    return "Give at least one person a share.";
  }

  const shareTotal = sum(shares);
  if (shareTotal !== totalMinor) {
    const diff = totalMinor - shareTotal;
    const direction = diff > 0 ? "short by" : "over by";
    return `Shares are ${direction} ${formatMoney(Math.abs(diff), currency)}.`;
  }

  return null;
}
