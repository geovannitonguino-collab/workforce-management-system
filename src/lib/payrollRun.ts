import { Employee, LeaveRequest, TimeEntry } from '@/types/workforce';
import { ContractRecord, LeaveInput, PayAdjustment, PayrollResult, Period } from '@/types/contract';
import { calculatePay } from '@/lib/payrollEngine';

export interface PayAdjustmentRecord extends PayAdjustment { id: string; employeeId: string; createdBy?: string }

export interface PayrollRow { employee: Employee; contracts: ContractRecord[]; result: PayrollResult | null }

export interface CurrencyTotal { currency: string; gross: number; net: number; employerCost: number; hours: number; people: number }

export interface PayrollRun { rows: PayrollRow[]; totals: CurrencyTotal[]; withoutContract: Employee[] }

/** Runs the payroll engine for every person with the data the current user is allowed to see. */
export function runPayroll(args: {
  employees: Employee[];
  contracts: ContractRecord[];
  entries: TimeEntry[];
  leaves: LeaveRequest[];
  adjustments: PayAdjustmentRecord[];
  holidays: string[];
  timeZone: string;
  period: Period;
}): PayrollRun {
  const { employees, contracts, entries, leaves, adjustments, holidays, timeZone, period } = args;
  const rows: PayrollRow[] = employees.map(employee => {
    const own = contracts.filter(c => c.employeeId === employee.id);
    if (own.length === 0) return { employee, contracts: own, result: null };
    const leaveInputs: LeaveInput[] = leaves.filter(l => l.employeeId === employee.id).map(l => ({
      category: l.category, startDate: l.startDate, endDate: l.endDate, hours: l.hours, isPaid: l.isPaid, unpaidHours: l.unpaidHours, status: l.status,
    }));
    const result = calculatePay({
      contracts: own,
      entries: entries.filter(e => e.employeeId === employee.id),
      leaves: leaveInputs,
      adjustments: adjustments.filter(a => a.employeeId === employee.id),
      period, timeZone, holidays,
    });
    return { employee, contracts: own, result };
  });

  const byCurrency = new Map<string, CurrencyTotal>();
  for (const r of rows) {
    if (!r.result) continue;
    const cur = r.result.currency || '—';
    const t = byCurrency.get(cur) ?? { currency: cur, gross: 0, net: 0, employerCost: 0, hours: 0, people: 0 };
    t.gross += r.result.gross; t.net += r.result.net; t.employerCost += r.result.employerCost; t.hours += r.result.totalHours; t.people += 1;
    byCurrency.set(cur, t);
  }
  return {
    rows,
    totals: [...byCurrency.values()].map(t => ({
      ...t, gross: Math.round(t.gross * 10000) / 10000, net: Math.round(t.net * 10000) / 10000,
      employerCost: Math.round(t.employerCost * 10000) / 10000, hours: Math.round(t.hours * 10000) / 10000,
    })),
    withoutContract: rows.filter(r => !r.result).map(r => r.employee),
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
