import { describe, expect, it } from "vitest";
import {
  apportion,
  computeShares,
  formatMoney,
  reconciliationError,
  splitByPercent,
  splitByShares,
  splitEqual,
  sum,
  toMajor,
  toMinor
} from "./money";

// ─── toMinor / toMajor ───────────────────────────────────────────────────────

describe("toMinor", () => {
  it("converts decimal major to minor units", () => {
    expect(toMinor("100.00")).toBe(10000);
    expect(toMinor("1.50")).toBe(150);
    expect(toMinor("0.01")).toBe(1);
  });

  it("handles numeric input", () => {
    expect(toMinor(100)).toBe(10000);
    expect(toMinor(0.5)).toBe(50);
  });

  it("strips commas", () => {
    expect(toMinor("1,000.00")).toBe(100000);
  });

  it("returns NaN for non-numeric strings", () => {
    expect(Number.isNaN(toMinor("abc"))).toBe(true);
  });

  it("rounds floating point imprecision correctly", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });
});

describe("toMajor", () => {
  it("converts minor units to decimal", () => {
    expect(toMajor(10000)).toBe(100);
    expect(toMajor(150)).toBe(1.5);
    expect(toMajor(1)).toBe(0.01);
  });
});

// ─── apportion ────────────────────────────────────────────────────────────────

describe("apportion", () => {
  it("always sums to exactly totalMinor", () => {
    // Classic off-by-one: 3-way split of 100 can't divide evenly
    const parts = apportion(100, [1, 1, 1]);
    expect(sum(parts)).toBe(100);
  });

  it("distributes remainder to highest fractional loss first", () => {
    // 100 split 3 ways: floor=33, leftover=1 → first person gets 34
    const parts = apportion(100, [1, 1, 1]);
    expect(parts).toEqual([34, 33, 33]);
  });

  it("handles weighted splits that sum exactly", () => {
    const parts = apportion(200, [1, 1]);
    expect(parts).toEqual([100, 100]);
    expect(sum(parts)).toBe(200);
  });

  it("handles zero weights array", () => {
    const parts = apportion(100, []);
    expect(parts).toEqual([]);
  });

  it("returns all zeros when all weights are zero", () => {
    const parts = apportion(100, [0, 0, 0]);
    expect(parts).toEqual([0, 0, 0]);
  });

  it("handles asymmetric weights", () => {
    // 300 split 2:1 → 200, 100
    const parts = apportion(300, [2, 1]);
    expect(parts).toEqual([200, 100]);
    expect(sum(parts)).toBe(300);
  });

  it("sums correctly for prime totals that don't divide evenly", () => {
    const parts = apportion(997, [1, 1, 1, 1]);
    expect(sum(parts)).toBe(997);
  });
});

// ─── splitEqual ───────────────────────────────────────────────────────────────

describe("splitEqual", () => {
  it("splits evenly between 4 people", () => {
    const parts = splitEqual(1000, 4);
    expect(parts).toEqual([250, 250, 250, 250]);
  });

  it("sums to total even for odd splits", () => {
    const parts = splitEqual(1001, 3);
    expect(sum(parts)).toBe(1001);
  });

  it("handles single participant", () => {
    expect(splitEqual(500, 1)).toEqual([500]);
  });
});

// ─── splitByPercent ───────────────────────────────────────────────────────────

describe("splitByPercent", () => {
  it("splits 50/50", () => {
    const parts = splitByPercent(1000, [50, 50]);
    expect(parts).toEqual([500, 500]);
  });

  it("splits 33.33/33.33/33.34 while summing exactly to total", () => {
    const parts = splitByPercent(1000, [33.33, 33.33, 33.34]);
    expect(sum(parts)).toBe(1000);
  });

  it("handles 75/25 split", () => {
    const parts = splitByPercent(400, [75, 25]);
    expect(parts).toEqual([300, 100]);
  });
});

// ─── splitByShares ────────────────────────────────────────────────────────────

describe("splitByShares", () => {
  it("splits 2:1:1 shares correctly", () => {
    const parts = splitByShares(400, [2, 1, 1]);
    expect(parts).toEqual([200, 100, 100]);
    expect(sum(parts)).toBe(400);
  });

  it("ignores negative unit values (treats as 0)", () => {
    const parts = splitByShares(300, [3, -1]);
    // -1 → 0, so effectively [3, 0]
    expect(parts[1]).toBe(0);
    expect(sum(parts)).toBe(300);
  });
});

// ─── computeShares ────────────────────────────────────────────────────────────

describe("computeShares", () => {
  it("equal: returns apportion result", () => {
    const shares = computeShares("equal", 300, [0, 0, 0]); // inputs ignored for equal
    expect(shares).toEqual([100, 100, 100]);
    expect(sum(shares)).toBe(300);
  });

  it("exact: passes inputs through as-is (rounded)", () => {
    const shares = computeShares("exact", 300, [150, 100, 50]);
    expect(shares).toEqual([150, 100, 50]);
  });

  it("percent: uses percents to apportion", () => {
    const shares = computeShares("percent", 1000, [60, 40]);
    expect(shares).toEqual([600, 400]);
  });

  it("shares: uses relative weights", () => {
    const shares = computeShares("shares", 600, [2, 1]);
    expect(shares).toEqual([400, 200]);
  });

  // Recalculation scenarios: editing an expense and verifying the recomputed share total
  it("recalculation: changing amount updates all equal shares correctly", () => {
    const original = computeShares("equal", 9000, [0, 0, 0]);
    expect(sum(original)).toBe(9000);

    const updated = computeShares("equal", 12000, [0, 0, 0]);
    expect(sum(updated)).toBe(12000);
    expect(updated).toEqual([4000, 4000, 4000]);
  });

  it("recalculation: changing split method from equal to percent recomputes correctly", () => {
    const asEqual = computeShares("equal", 10000, [0, 0]);
    expect(asEqual).toEqual([5000, 5000]);

    const asPercent = computeShares("percent", 10000, [70, 30]);
    expect(asPercent).toEqual([7000, 3000]);
    expect(sum(asPercent)).toBe(10000);
  });

  it("recalculation: removing a participant increases others' shares", () => {
    const three = computeShares("equal", 3000, [0, 0, 0]);
    expect(three).toEqual([1000, 1000, 1000]);

    const two = computeShares("equal", 3000, [0, 0]);
    expect(two).toEqual([1500, 1500]);
  });
});

// ─── reconciliationError ──────────────────────────────────────────────────────

describe("reconciliationError", () => {
  it("returns null when everything checks out (equal)", () => {
    const shares = computeShares("equal", 3000, [0, 0, 0]);
    expect(reconciliationError("equal", 3000, shares, [0, 0, 0], "INR")).toBeNull();
  });

  it("returns null for valid percent split", () => {
    const shares = computeShares("percent", 1000, [50, 50]);
    expect(reconciliationError("percent", 1000, shares, [50, 50], "INR")).toBeNull();
  });

  it("reports when percentages don't sum to 100", () => {
    const shares = computeShares("percent", 1000, [60, 30]); // 90%, not 100%
    const err = reconciliationError("percent", 1000, shares, [60, 30], "INR");
    expect(err).toMatch(/90\.00%/);
  });

  it("reports empty participants", () => {
    expect(reconciliationError("equal", 1000, [], [], "INR")).toBeTruthy();
  });

  it("reports when exact shares don't sum to total", () => {
    // User typed amounts that don't add up
    const badShares = [600, 600]; // sum 1200, but total is 1000
    const err = reconciliationError("exact", 1000, badShares, [600, 600], "INR");
    expect(err).toMatch(/over by/);
  });

  it("reports when shares is 0 for shares method", () => {
    const err = reconciliationError("shares", 1000, [0, 0], [0, 0], "INR");
    expect(err).toBeTruthy();
  });

  it("reports negative shares", () => {
    const err = reconciliationError("exact", 1000, [-100, 1100], [-100, 1100], "INR");
    expect(err).toMatch(/negative/);
  });
});

// ─── formatMoney ──────────────────────────────────────────────────────────────

describe("formatMoney", () => {
  it("formats INR amounts", () => {
    expect(formatMoney(10000, "INR")).toContain("100");
    expect(formatMoney(10000, "INR")).toContain("00");
  });

  it("formats small amounts", () => {
    expect(formatMoney(1, "INR")).toContain("0.01");
  });
});

// ─── Balance simulation ───────────────────────────────────────────────────────

describe("balance simulation", () => {
  // Simulate what group_balances RPC does: net = total paid - total owed
  function computeBalances(
    expenses: Array<{ payers: Array<{ userId: string; amount: number }>; shares: Array<{ userId: string; amount: number }> }>
  ): Record<string, number> {
    const bal: Record<string, number> = {};
    for (const exp of expenses) {
      for (const p of exp.payers) {
        bal[p.userId] = (bal[p.userId] ?? 0) + p.amount;
      }
      for (const s of exp.shares) {
        bal[s.userId] = (bal[s.userId] ?? 0) - s.amount;
      }
    }
    return bal;
  }

  it("single expense: payer has positive balance, others negative", () => {
    const expenses = [
      {
        payers: [{ userId: "alice", amount: 3000 }],
        shares: [
          { userId: "alice", amount: 1000 },
          { userId: "bob", amount: 1000 },
          { userId: "carol", amount: 1000 }
        ]
      }
    ];
    const bal = computeBalances(expenses);
    expect(bal["alice"]).toBe(2000);  // paid 3000, owes 1000
    expect(bal["bob"]).toBe(-1000);
    expect(bal["carol"]).toBe(-1000);
    expect(sum(Object.values(bal))).toBe(0); // balances always net to zero
  });

  it("multiple expenses balance correctly", () => {
    const expenses = [
      {
        payers: [{ userId: "alice", amount: 2000 }],
        shares: [
          { userId: "alice", amount: 1000 },
          { userId: "bob", amount: 1000 }
        ]
      },
      {
        payers: [{ userId: "bob", amount: 2000 }],
        shares: [
          { userId: "alice", amount: 1000 },
          { userId: "bob", amount: 1000 }
        ]
      }
    ];
    const bal = computeBalances(expenses);
    expect(bal["alice"]).toBe(0);
    expect(bal["bob"]).toBe(0);
  });

  it("after editing expense amount, recalculated balances sum to zero", () => {
    // Before edit: alice paid 3000 split equally 3 ways
    const [share1, share2, share3] = computeShares("equal", 3000, [0, 0, 0]);
    const before = computeBalances([
      {
        payers: [{ userId: "alice", amount: 3000 }],
        shares: [
          { userId: "alice", amount: share1 },
          { userId: "bob", amount: share2 },
          { userId: "carol", amount: share3 }
        ]
      }
    ]);
    expect(sum(Object.values(before))).toBe(0);

    // After edit: amount changes to 6000
    const [ns1, ns2, ns3] = computeShares("equal", 6000, [0, 0, 0]);
    const after = computeBalances([
      {
        payers: [{ userId: "alice", amount: 6000 }],
        shares: [
          { userId: "alice", amount: ns1 },
          { userId: "bob", amount: ns2 },
          { userId: "carol", amount: ns3 }
        ]
      }
    ]);
    expect(after["alice"]).toBe(4000);
    expect(after["bob"]).toBe(-2000);
    expect(after["carol"]).toBe(-2000);
    expect(sum(Object.values(after))).toBe(0);
  });
});

// ─── Debt simplification ─────────────────────────────────────────────────────

describe("debt simplification", () => {
  // Minimal implementation of the greedy simplify_debts algorithm
  function simplifyDebts(balances: Record<string, number>): Array<{ from: string; to: string; amount: number }> {
    const creditors: Array<{ id: string; amount: number }> = [];
    const debtors: Array<{ id: string; amount: number }> = [];

    for (const [id, net] of Object.entries(balances)) {
      if (net > 0) creditors.push({ id, amount: net });
      else if (net < 0) debtors.push({ id, amount: -net });
    }

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const debts: Array<{ from: string; to: string; amount: number }> = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const credit = creditors[ci];
      const debt = debtors[di];
      const amount = Math.min(credit.amount, debt.amount);
      debts.push({ from: debt.id, to: credit.id, amount });
      credit.amount -= amount;
      debt.amount -= amount;
      if (credit.amount === 0) ci++;
      if (debt.amount === 0) di++;
    }

    return debts;
  }

  it("two people: one owes the other", () => {
    const debts = simplifyDebts({ alice: 1000, bob: -1000 });
    expect(debts).toHaveLength(1);
    expect(debts[0]).toEqual({ from: "bob", to: "alice", amount: 1000 });
  });

  it("settled group produces no debts", () => {
    const debts = simplifyDebts({ alice: 0, bob: 0, carol: 0 });
    expect(debts).toHaveLength(0);
  });

  it("three-way simplification reduces to fewer transfers than expenses", () => {
    // alice paid for everything; bob and carol owe her
    const bal = { alice: 2000, bob: -1000, carol: -1000 };
    const debts = simplifyDebts(bal);
    expect(debts).toHaveLength(2);
    const total = sum(debts.map((d) => d.amount));
    expect(total).toBe(2000);
  });

  it("circular debts are minimized", () => {
    // A→B 1000, B→C 1000, C→A 1000 (all net to 0, no transactions needed)
    const bal = { alice: 0, bob: 0, carol: 0 };
    expect(simplifyDebts(bal)).toHaveLength(0);
  });

  it("complex group simplifies correctly", () => {
    // Four people: alice paid a lot, others owe varying amounts
    const bal = { alice: 3000, bob: -1500, carol: -1000, dave: -500 };
    const debts = simplifyDebts(bal);
    expect(debts.length).toBeLessThanOrEqual(3);
    expect(sum(debts.map((d) => d.amount))).toBe(3000);
    // Every debtor pays alice
    for (const d of debts) {
      expect(d.to).toBe("alice");
    }
  });
});
