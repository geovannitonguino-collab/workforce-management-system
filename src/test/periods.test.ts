import { describe, it, expect } from 'vitest';
import { periodFor, shiftPeriod } from '@/lib/periods';
import { runPayroll } from '@/lib/payrollRun';
import { blankContract } from '@/lib/contractDefaults';
import { ContractRecord } from '@/types/contract';
import { Employee, TimeEntry } from '@/types/workforce';

describe('periods', () => {
  it('week is Monday to Sunday', () => {
    expect(periodFor('week', '2026-10-07')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(periodFor('week', '2026-10-11')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(periodFor('week', '2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });
  it('month and half month', () => {
    expect(periodFor('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodFor('semimonthly', '2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(periodFor('semimonthly', '2026-10-16')).toEqual({ from: '2026-10-16', to: '2026-10-31' });
    expect(periodFor('semimonthly', '2026-02-20')).toEqual({ from: '2026-02-16', to: '2026-02-28' });
  });
  it('two-week periods are 14 days, start on a Monday and tile without gaps', () => {
    const a = periodFor('biweekly', '2026-10-07');
    expect(new Date(a.from + 'T00:00:00Z').getUTCDay()).toBe(1);
    const next = shiftPeriod('biweekly', a, 1);
    expect(next.from).toBe(new Date(Date.parse(a.to + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10));
    expect(shiftPeriod('biweekly', next, -1)).toEqual(a);
  });
  it('shifting steps across month and year boundaries', () => {
    expect(shiftPeriod('month', periodFor('month', '2026-12-10'), 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
    expect(shiftPeriod('month', periodFor('month', '2026-01-10'), -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(shiftPeriod('semimonthly', periodFor('semimonthly', '2026-10-20'), 1)).toEqual({ from: '2026-11-01', to: '2026-11-15' });
    expect(shiftPeriod('semimonthly', periodFor('semimonthly', '2026-10-05'), -1)).toEqual({ from: '2026-09-16', to: '2026-09-30' });
    expect(shiftPeriod('week', periodFor('week', '2026-10-07'), -1)).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });
  it('a custom range moves by its own length', () => {
    expect(shiftPeriod('custom', { from: '2026-10-01', to: '2026-10-10' }, 1)).toEqual({ from: '2026-10-11', to: '2026-10-20' });
    expect(shiftPeriod('custom', { from: '2026-10-11', to: '2026-10-20' }, -1)).toEqual({ from: '2026-10-01', to: '2026-10-10' });
  });
});

describe('payroll run', () => {
  const emp = (id: string, name: string): Employee => ({
    id, name, email: id + '@x.com', role: 'employee', hourlyRate: 0, vacationAccrualRate: 0, paidPtoLimitHours: 0, hireDate: '2026-01-01', department: '',
  });
  const rec = (employeeId: string, over: Partial<ContractRecord>): ContractRecord => ({
    ...blankContract('contractor', '2026-01-01', 'USD'), id: 'c-' + employeeId, employeeId, tracksTime: true, createdAt: '', ...over,
  });
  const entry = (employeeId: string, action: 'clock_in' | 'clock_out', iso: string): TimeEntry => ({ id: iso + employeeId, employeeId, action, timestamp: iso, date: iso.slice(0, 10) });

  it('totals are kept per currency (no conversion) and people without a contract are listed', () => {
    const run = runPayroll({
      employees: [emp('a', 'Ana'), emp('b', 'Beto'), emp('c', 'Caro'), emp('d', 'Dani')],
      contracts: [
        rec('a', { payType: 'fixed', amount: 3000, currency: 'USD' }),
        rec('b', { payType: 'fixed', amount: 2000, currency: 'USD' }),
        rec('c', { payType: 'hourly', amount: 20000, currency: 'COP' }),
      ],
      entries: [entry('c', 'clock_in', '2026-10-06T14:00:00Z'), entry('c', 'clock_out', '2026-10-06T22:00:00Z')], // 8 h
      leaves: [], adjustments: [{ id: 'x', employeeId: 'a', date: '2026-10-20', kind: 'commission', amount: 500 }],
      holidays: [], timeZone: 'America/Bogota', period: { from: '2026-10-01', to: '2026-10-31' },
    });
    const usd = run.totals.find(t => t.currency === 'USD')!;
    const cop = run.totals.find(t => t.currency === 'COP')!;
    expect(usd.gross).toBeCloseTo(3000 + 500 + 2000, 3);
    expect(usd.people).toBe(2);
    expect(cop.gross).toBeCloseTo(160000, 3);
    expect(cop.hours).toBe(8);
    expect(run.withoutContract.map(e => e.name)).toEqual(['Dani']);
  });
});
