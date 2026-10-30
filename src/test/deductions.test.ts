import { describe, it, expect } from 'vitest';
import { calculatePay } from '@/lib/payrollEngine';
import { blankContract } from '@/lib/contractDefaults';
import { ContractTerms, DeductionLine, PayAdjustment } from '@/types/contract';
import { TimeEntry } from '@/types/workforce';

const OCT = { from: '2026-10-01', to: '2026-10-31' };
const contract = (over: Partial<ContractTerms> = {}): ContractTerms => ({ ...blankContract('employee', '2026-01-01', 'USD'), ...over });
const shift = (date: string, from: string, to: string): TimeEntry[] => [
  { id: date + 'a', employeeId: 'e', action: 'clock_in', date, timestamp: new Date(`${date}T${from}:00-05:00`).toISOString() },
  { id: date + 'b', employeeId: 'e', action: 'clock_out', date, timestamp: new Date(`${date}T${to}:00-05:00`).toISOString() },
];
const run = (c: ContractTerms | ContractTerms[], entries: TimeEntry[] = [], adjustments: PayAdjustment[] = [], period = OCT) =>
  calculatePay({ contracts: Array.isArray(c) ? c : [c], entries, leaves: [], adjustments, period, timeZone: 'America/Bogota' });
const line = (over: Partial<DeductionLine>): DeductionLine => ({ name: 'Line', kind: 'deduction', basis: 'gross', mode: 'percent', value: 4, ...over });

// 5 days x 8 h at 25/h = 1000 gross
const week = ['05', '06', '07', '08', '09'].flatMap(d => shift(`2026-10-${d}`, '08:00', '16:00'));
const hourly = (lines: DeductionLine[] = []) => contract({ payType: 'hourly', amount: 25, deductionLines: lines });

describe('company-defined deductions and contributions', () => {
  it('with no lines nothing changes: net = gross and the company cost = gross', () => {
    const r = run(hourly(), week);
    expect(r.gross).toBeCloseTo(1000, 3);
    expect(r.net).toBeCloseTo(1000, 3);
    expect(r.employerCost).toBeCloseTo(1000, 3);
    expect(r.withheld).toBe(0);
    expect(r.deductionLines).toEqual([]);
  });

  it('withholds the percentages the company typed and adds the company contributions on top', () => {
    const r = run(hourly([
      line({ name: 'Health', value: 4 }),
      line({ name: 'Pension', value: 4 }),
      line({ name: 'Income tax', value: 10 }),
      line({ name: 'Employer health', kind: 'employer', value: 8.5 }),
      line({ name: 'Employer pension', kind: 'employer', value: 12 }),
    ]), week);
    expect(r.withheld).toBeCloseTo(180, 3);                // 4 + 4 + 10 = 18 % of 1000
    expect(r.net).toBeCloseTo(820, 3);
    expect(r.employerContributions).toBeCloseTo(205, 3);   // 20.5 %
    expect(r.employerCost).toBeCloseTo(1205, 3);
    expect(r.deductionLines.map(l => [l.name, l.amount])).toEqual([
      ['Health', 40], ['Pension', 40], ['Income tax', 100], ['Employer health', 85], ['Employer pension', 120],
    ]);
  });

  it('a line can use only the base pay, leaving commissions out of it', () => {
    const fixed = (lines: DeductionLine[]) => contract({ payType: 'fixed', payPeriod: 'monthly', amount: 3000, deductionLines: lines });
    const comm: PayAdjustment[] = [{ date: '2026-10-20', kind: 'commission', amount: 500 }];
    expect(run(fixed([line({ basis: 'base' })]), [], comm).withheld).toBeCloseTo(120, 3);   // 4 % of 3000
    expect(run(fixed([line({ basis: 'gross' })]), [], comm).withheld).toBeCloseTo(140, 3);  // 4 % of 3500
  });

  it('expense refunds are paid in full but are never part of what a percentage applies to', () => {
    const c = contract({ payType: 'fixed', amount: 3000, deductionLines: [line({ value: 10 })] });
    const r = run(c, [], [{ date: '2026-10-10', kind: 'reimbursement', amount: 100 }]);
    expect(r.gross).toBeCloseTo(3100, 3);
    expect(r.withheld).toBeCloseTo(300, 3); // 10 % of 3000, not of 3100
    expect(r.net).toBeCloseTo(2800, 3);
  });

  it('a fixed amount per month is prorated by days when the period is shorter than the month', () => {
    const c = contract({ payType: 'fixed', amount: 3000, deductionLines: [line({ mode: 'fixed', value: 50 })] });
    expect(run(c).withheld).toBeCloseTo(50, 3);
    expect(run(c, [], [], { from: '2026-10-01', to: '2026-10-15' }).withheld).toBeCloseTo(50 * 15 / 31, 3);
  });

  it('unpaid days lower the base but the base line still follows what was really paid', () => {
    const c = contract({ payType: 'fixed', amount: 3000, deductionLines: [line({ basis: 'base', value: 10 })] });
    const r = calculatePay({
      contracts: [c], entries: [], adjustments: [], period: OCT, timeZone: 'America/Bogota',
      leaves: [{ category: 'personal', startDate: '2026-10-07', endDate: '2026-10-07', hours: 8, isPaid: false, unpaidHours: 8, status: 'approved' }],
    });
    // one unpaid day: 3000 - 3000/30 = 2900 base -> 10 % = 290
    expect(r.deductionLines[0].amount).toBeCloseTo(290, 3);
  });

  it('never produces a negative amount, and a zero basis gives zero', () => {
    const c = contract({ payType: 'fixed', amount: 100, deductionLines: [line({ value: 10 })] });
    const r = run(c, [], [{ date: '2026-10-10', kind: 'deduction', amount: 500 }]);
    expect(r.gross).toBeCloseTo(-400, 3);
    expect(r.deductionLines[0].amount).toBe(0);
    expect(run(hourly([line({ value: 10 })])).deductionLines[0].amount).toBe(0);
  });

  it('warns when the period spans two versions with different deduction lines', () => {
    const v1 = contract({ effectiveFrom: '2026-01-01', payType: 'fixed', amount: 3000, deductionLines: [line({ value: 4 })] });
    const v2 = contract({ effectiveFrom: '2026-10-16', payType: 'fixed', amount: 3000, deductionLines: [line({ value: 6 })] });
    const r = run([v1, v2]);
    expect(r.warnings.join()).toMatch(/different deductions/);
    expect(r.deductionLines[0].amount).toBeCloseTo(3000 * 0.06, 2); // the one in force at the end
    expect(run([v1, contract({ effectiveFrom: '2026-10-16', payType: 'fixed', amount: 3500, deductionLines: [line({ value: 4 })] })]).warnings.join()).not.toMatch(/different deductions/);
  });

  it('works together with surcharges and overtime: the percentage applies to the whole taxable gross', () => {
    const c = contract({
      payType: 'hourly', amount: 10, overtimeEligible: true, overtimeBasis: 'schedule',
      surcharges: { night: 0, holiday: 0, holidayNight: 0, otDay: 25, otNight: 0, otHolidayDay: 0, otHolidayNight: 0 },
      deductionLines: [line({ value: 10 })],
    });
    const r = run(c, shift('2026-10-05', '08:00', '18:00')); // 8 h + 2 h overtime at 125 % = 80 + 25
    expect(r.gross).toBeCloseTo(105, 3);
    expect(r.withheld).toBeCloseTo(10.5, 3);
    expect(r.net).toBeCloseTo(94.5, 3);
  });
});
