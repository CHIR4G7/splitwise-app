import { describe, expect, it } from "vitest";
import { formatExpenseDate, formatMonthShort, getLocalDateString, getYesterdayDateString, parseLocalDate } from "./date";

// ─── getLocalDateString ───────────────────────────────────────────────────────

describe("getLocalDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getLocalDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats a known date correctly using local components", () => {
    // Construct a local midnight date directly (avoids UTC shifting)
    const date = new Date(2026, 7, 15); // August 15 2026 local
    expect(getLocalDateString(date)).toBe("2026-08-15");
  });

  it("pads single-digit month and day", () => {
    const date = new Date(2026, 0, 5); // Jan 5
    expect(getLocalDateString(date)).toBe("2026-01-05");
  });

  it("returns today when called with no argument", () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    expect(getLocalDateString()).toBe(`${year}-${month}-${day}`);
  });
});

// ─── getYesterdayDateString ───────────────────────────────────────────────────

describe("getYesterdayDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(getYesterdayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is exactly one day before today", () => {
    const today = getLocalDateString();
    const yesterday = getYesterdayDateString();
    // Parse both as local dates and compare
    const todayDate = parseLocalDate(today);
    const yestDate = parseLocalDate(yesterday);
    const diffMs = todayDate.getTime() - yestDate.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });
});

// ─── parseLocalDate ───────────────────────────────────────────────────────────

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD as local midnight, not UTC", () => {
    // This is the core timezone-shift bug guard.
    // new Date("2026-08-15") parses as UTC, which shifts to Aug 14 in UTC-X timezones.
    // parseLocalDate must return a Date whose local year/month/day match the string.
    const date = parseLocalDate("2026-08-15");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // 0-indexed
    expect(date.getDate()).toBe(15);
  });

  it("truncates to first 10 chars (handles ISO datetime strings)", () => {
    const date = parseLocalDate("2026-08-15T12:34:56Z");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(15);
  });

  it("handles empty string gracefully", () => {
    const date = parseLocalDate("");
    expect(date).toBeInstanceOf(Date);
    expect(Number.isNaN(date.getTime())).toBe(false);
  });

  it("parses year boundary dates correctly", () => {
    const jan1 = parseLocalDate("2026-01-01");
    expect(jan1.getFullYear()).toBe(2026);
    expect(jan1.getMonth()).toBe(0);
    expect(jan1.getDate()).toBe(1);

    const dec31 = parseLocalDate("2025-12-31");
    expect(dec31.getFullYear()).toBe(2025);
    expect(dec31.getMonth()).toBe(11);
    expect(dec31.getDate()).toBe(31);
  });

  it("parseLocalDate(getLocalDateString(date)) round-trips correctly", () => {
    const original = new Date(2026, 5, 20); // June 20
    const str = getLocalDateString(original);
    const parsed = parseLocalDate(str);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(20);
  });
});

// ─── formatExpenseDate ────────────────────────────────────────────────────────

describe("formatExpenseDate", () => {
  it("returns a non-empty human-readable string for a valid date", () => {
    const result = formatExpenseDate("2026-08-15");
    expect(result).toBeTruthy();
    expect(result).toContain("2026");
  });

  it("includes the correct day number", () => {
    const result = formatExpenseDate("2026-08-15");
    expect(result).toContain("15");
  });

  it("returns empty string for empty input", () => {
    expect(formatExpenseDate("")).toBe("");
  });

  it("does not shift the date due to UTC parsing", () => {
    // In a UTC-5 timezone, "2026-01-01" as UTC midnight is Dec 31 local.
    // formatExpenseDate must show Jan 1, not Dec 31.
    const result = formatExpenseDate("2026-01-01");
    expect(result).toContain("2026");
    expect(result).not.toMatch(/Dec/i);
  });
});

// ─── formatMonthShort ─────────────────────────────────────────────────────────

describe("formatMonthShort", () => {
  it("returns short month name", () => {
    const result = formatMonthShort("2026-08-01");
    // Should be locale-dependent short month, e.g. "Aug"
    expect(result).toBeTruthy();
    expect(result.length).toBeLessThan(10);
  });

  it("returns empty string for empty input", () => {
    expect(formatMonthShort("")).toBe("");
  });

  it("different months return different strings", () => {
    const jan = formatMonthShort("2026-01-01");
    const aug = formatMonthShort("2026-08-01");
    expect(jan).not.toBe(aug);
  });
});

// ─── Timezone shift guard ─────────────────────────────────────────────────────

describe("timezone shift guard", () => {
  it("getLocalDateString never produces yesterday for a given local date", () => {
    // Simulate the UTC-shift bug: if we used new Date().toISOString().slice(0,10),
    // it would return UTC date which can be yesterday in western timezones.
    // getLocalDateString uses local components, so it always matches the wall clock.
    const testDates = [
      new Date(2026, 0, 1),   // Jan 1
      new Date(2026, 5, 15),  // Jun 15
      new Date(2026, 11, 31)  // Dec 31
    ];
    for (const d of testDates) {
      const str = getLocalDateString(d);
      const reparsed = parseLocalDate(str);
      expect(reparsed.getDate()).toBe(d.getDate());
      expect(reparsed.getMonth()).toBe(d.getMonth());
      expect(reparsed.getFullYear()).toBe(d.getFullYear());
    }
  });
});
