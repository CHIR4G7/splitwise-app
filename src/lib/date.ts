/**
 * Date utility helpers that avoid UTC timezone shifting bugs.
 *
 * When string dates like "2026-08-15" are parsed by `new Date("2026-08-15")`, standard JavaScript
 * parses them as UTC midnight. In timezones west of UTC (e.g. Americas), formatting that Date
 * in local time results in the previous day ("2026-08-14").
 *
 * These utilities use local calendar components to ensure dates remain exact.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-").map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
}

export function formatExpenseDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatMonthShort(monthStr: string): string {
  if (!monthStr) return "";
  const date = parseLocalDate(monthStr);
  return date.toLocaleDateString(undefined, { month: "short" });
}
