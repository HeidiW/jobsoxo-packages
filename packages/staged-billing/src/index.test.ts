import { describe, it, expect } from "vitest";
import { completedToDate, contractFromLineItems, overallPercent, stageDueAmount, stageLineDescription, stageProblem, suggestedPercents } from "./index";
import { stagedContextHtml } from "./email";

describe("stage helpers", () => {
  const scope = contractFromLineItems([
    { section: "Walls and Stairway", description: "Protect, prep, prime and paint", amount: "5200" },
    { section: "Skim and Paint", description: "Levelling skim and Super Flat finish", amount: "6000.00" },
  ]);

  it("sums the job's scope into the contract", () => {
    expect(scope.total).toBe(11200);
    expect(scope.scope[1]).toEqual({ section: "Skim and Paint", description: "Levelling skim and Super Flat finish", amount: 6000 });
  });

  it("bills a deposit by amount or percent, never more than what's left, and the final bills the rest", () => {
    expect(stageDueAmount("deposit", { type: "amount", value: 5500 }, 11200, 0)).toBe(5500);
    expect(stageDueAmount("deposit", { type: "percent", value: 50 }, 11200, 0)).toBe(5600);
    expect(stageDueAmount("progress", { type: "amount", value: 9000 }, 11200, 5500)).toBe(5700);
    expect(stageDueAmount("final", null, 11200, 5500)).toBe(5700);
    expect(stageDueAmount("final", null, 11200, 11200)).toBe(0);
    expect(stageDueAmount("standalone", null, 11200, 0)).toBe(0);
  });

  it("bills progress by percent complete per line, crediting what was invoiced before", () => {
    const lines = contractFromLineItems([
      { description: "Walls", amount: "5200", status: "completed" },
      { description: "Ceilings", amount: "6000", status: "in_progress" },
      { description: "Trim", amount: "800", status: "pending" },
    ]);
    expect(suggestedPercents(lines.scope)).toEqual([100, 50, 0]);
    expect(completedToDate(lines.scope, [100, 50, 0])).toBe(8200);
    expect(overallPercent(lines.scope, [100, 50, 0], lines.total)).toBe(68.3);
    // $8,200 of work done, $5,500 deposit already invoiced → $2,700 due now.
    expect(stageDueAmount("progress", { type: "lines", percents: [100, 50, 0] }, lines.total, 5500, lines.scope)).toBe(2700);
    expect(stageProblem("progress", { type: "lines", percents: [100, 0, 0] }, lines.total, 5500, lines.scope)).toContain("already covered by the $5,500.00 invoiced before");
    expect(stageProblem("progress", { type: "lines", percents: [0, 0, 0] }, lines.total, 0, lines.scope)).toContain("Mark how far along");
    expect(stageLineDescription("progress", { type: "lines", percents: [100, 50, 0] }, lines.total, lines.scope)).toBe("Progress payment (work 68.3% complete on $12,000.00 contract)");
    expect(stageLineDescription("progress", { type: "lines", percents: [100, 50, 0] }, lines.total, lines.scope, 2)).toBe("Progress payment 2 (work 68.3% complete on $12,000.00 contract)");
  });

  it("words the billable line the way it prints", () => {
    expect(stageLineDescription("deposit", { type: "amount", value: 5500 }, 11200)).toBe("Deposit on $11,200.00 contract");
    expect(stageLineDescription("deposit", { type: "percent", value: 50 }, 11200)).toBe("Deposit (50% of $11,200.00 contract)");
    expect(stageLineDescription("final", null, 11200)).toBe("Final balance on $11,200.00 contract");
  });

  it("explains what's wrong before a staged invoice is created", () => {
    expect(stageProblem("deposit", { type: "amount", value: 5500 }, 0, 0)).toContain("no total yet");
    expect(stageProblem("deposit", { type: "amount", value: 0 }, 11200, 0)).toContain("Enter the deposit");
    expect(stageProblem("deposit", { type: "amount", value: 12000 }, 11200, 0)).toContain("more than the $11,200.00 left");
    expect(stageProblem("final", null, 11200, 11200)).toContain("already been invoiced");
    expect(stageProblem("final", null, 11200, 5500)).toBeNull();
    expect(stageProblem("standalone", null, 0, 0)).toBeNull();
  });

  it("adds the contract context to the invoice email only for staged invoices", () => {
    expect(stagedContextHtml({ stage: "standalone" })).toBe("");
    const html = stagedContextHtml({ stage: "final", contractTotal: "11200.00", previouslyInvoiced: "5500.00", previouslyPaid: "5500.00" });
    expect(html).toContain("Final invoice</strong> on a $11,200.00 contract");
    expect(html).toContain("Paid to date:</strong> $5,500.00");
  });
});
