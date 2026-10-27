import { describe, it, expect } from "vitest";
import {
  calculateDailySummary, calculatePayroll, calculateLeaveBalance, calculateLeaveRequestPaidStatus, getToday,
} from "@/lib/calculations";
import { Employee, LeaveRequest, TimeEntry, LeaveBalance } from "@/types/workforce";

const emp: Employee = {
  id: "e1", name: "Test", email: "t@x.com", role: "employee", hourlyRate: 20,
  vacationAccrualRate: 0.416, paidPtoLimitHours: 40, hireDate: "2025-01-01", department: "Ops",
};
const entry = (id: string, action: TimeEntry["action"], ts: string): TimeEntry =>
  ({ id, employeeId: "e1", action, timestamp: ts, date: ts.slice(0, 10) });
const leave = (p: Partial<LeaveRequest>): LeaveRequest => ({
  id: "l", employeeId: "e1", category: "pto", startDate: "2026-03-10", endDate: "2026-03-10",
  hours: 8, isPaid: true, unpaidHours: 0, status: "approved", reason: "", createdAt: "2026-03-01", ...p,
});
const balance = (remainingPto: number): LeaveBalance => ({
  employeeId: "e1", year: 2026, totalPaidPtoHours: 40, usedPaidPtoHours: 40 - remainingPto,
  remainingPaidPtoHours: remainingPto, accruedVacationDays: 5, usedVacationDays: 0, remainingVacationDays: 5,
});

describe("calculateDailySummary", () => {
  it("subtracts lunch from worked time", () => {
    const s = calculateDailySummary([
      entry("1", "clock_in", "2026-03-02T09:00:00"), entry("2", "start_lunch", "2026-03-02T12:00:00"),
      entry("3", "end_lunch", "2026-03-02T12:30:00"), entry("4", "clock_out", "2026-03-02T17:00:00"),
    ], "e1", "2026-03-02");
    expect(s.netWorkHours).toBe(7.5);
    expect(s.lunchMinutes).toBe(30);
  });
  it("ignores a second clock_in while already clocked in, and an orphan clock_out", () => {
    const s = calculateDailySummary([
      entry("0", "clock_out", "2026-03-02T08:00:00"),
      entry("1", "clock_in", "2026-03-02T09:00:00"), entry("2", "clock_in", "2026-03-02T10:00:00"),
      entry("3", "clock_out", "2026-03-02T11:00:00"),
    ], "e1", "2026-03-02");
    expect(s.netWorkHours).toBe(2);
  });
  it("counts nothing for a day with no clock_out yet", () => {
    const s = calculateDailySummary([entry("1", "clock_in", "2026-03-02T09:00:00")], "e1", "2026-03-02");
    expect(s.netWorkHours).toBe(0);
  });
  it("only counts the requested employee and date", () => {
    const other: TimeEntry = { ...entry("9", "clock_in", "2026-03-02T09:00:00"), employeeId: "e2" };
    const s = calculateDailySummary([other], "e1", "2026-03-02");
    expect(s.netWorkHours).toBe(0);
  });
});

describe("calculatePayroll", () => {
  const day = (h: number) => ({ date: "2026-03-02", employeeId: "e1", totalMinutes: h * 60, lunchMinutes: 0, breakMinutes: 0, netWorkMinutes: h * 60, netWorkHours: h });
  it("gross = hours x rate", () => {
    expect(calculatePayroll(emp, [day(8), day(8)], [], "2026-03").grossPay).toBe(320);
  });
  it("adds paid leave and deducts unpaid leave", () => {
    const p = calculatePayroll(emp, [day(8)], [
      leave({ hours: 8 }),
      leave({ id: "l2", hours: 8, isPaid: false, unpaidHours: 8, startDate: "2026-03-12", endDate: "2026-03-12" }),
    ], "2026-03");
    expect(p.paidLeaveAmount).toBe(160);
    expect(p.unpaidLeaveDeduction).toBe(160);
    expect(p.netPay).toBe(160 + 160 - 160);
  });
  it("ignores pending/rejected leave", () => {
    const p = calculatePayroll(emp, [], [leave({ status: "pending" }), leave({ status: "rejected" })], "2026-03");
    expect(p.netPay).toBe(0);
  });
  it("counts a leave crossing a month boundary only in its start month", () => {
    const l = leave({ startDate: "2026-01-31", endDate: "2026-02-02", hours: 24 });
    expect(calculatePayroll(emp, [], [l], "2026-01").paidLeaveHours).toBe(24);
    expect(calculatePayroll(emp, [], [l], "2026-02").paidLeaveHours).toBe(0);
  });
});

describe("calculateLeaveRequestPaidStatus", () => {
  it("sick leave is always paid", () => {
    expect(calculateLeaveRequestPaidStatus({ category: "sick", hours: 16 }, balance(0))).toEqual({ isPaid: true, unpaidHours: 0 });
  });
  it("pto beyond the balance is partly unpaid", () => {
    expect(calculateLeaveRequestPaidStatus({ category: "pto", hours: 16 }, balance(8))).toEqual({ isPaid: true, unpaidHours: 8 });
  });
  it("pto with no balance is fully unpaid", () => {
    expect(calculateLeaveRequestPaidStatus({ category: "pto", hours: 8 }, balance(0))).toEqual({ isPaid: false, unpaidHours: 8 });
  });
  it("personal leave is unpaid unless it uses PTO balance", () => {
    expect(calculateLeaveRequestPaidStatus({ category: "personal", hours: 8 }, balance(40))).toEqual({ isPaid: false, unpaidHours: 8 });
    expect(calculateLeaveRequestPaidStatus({ category: "personal", hours: 8, usesPtoBalance: true }, balance(4))).toEqual({ isPaid: true, unpaidHours: 4 });
  });
});

describe("calculateLeaveBalance", () => {
  it("counts a leave starting on 1 January in that year (no timezone shift)", () => {
    const b = calculateLeaveBalance(emp, [leave({ startDate: "2026-01-01", endDate: "2026-01-01", hours: 8 })], 2026);
    expect(b.usedPaidPtoHours).toBe(8);
  });
  it("does not count a leave starting 31 December in the next year", () => {
    const b = calculateLeaveBalance(emp, [leave({ startDate: "2025-12-31", endDate: "2025-12-31", hours: 8 })], 2026);
    expect(b.usedPaidPtoHours).toBe(0);
  });
});

describe("getToday", () => {
  it("matches the local calendar date", () => {
    const d = new Date();
    expect(getToday()).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  });
});
