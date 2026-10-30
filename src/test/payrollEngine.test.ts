import { describe, it, expect } from 'vitest';
import { calculatePay, workIntervals, weeklyHours, addDays, weekdayOf } from '@/lib/payrollEngine';
import { blankContract, NO_SURCHARGES } from '@/lib/contractDefaults';
import { ContractTerms, LeaveInput, PayAdjustment } from '@/types/contract';
import { ClockAction, TimeEntry } from '@/types/workforce';

const BOGOTA = 'America/Bogota'; // UTC-5, no daylight saving
const OCT = { from: '2026-10-01', to: '2026-10-31' };

let n = 0;
/** Local Bogota wall-clock time -> punch */
const punch = (action: ClockAction, date: string, hhmm: string): TimeEntry => ({
  id: String(++n), employeeId: 'e', action, date,
  timestamp: new Date(`${date}T${hhmm}:00-05:00`).toISOString(),
});
const shift = (date: string, from: string, to: string, endDate = date): TimeEntry[] =>
  [punch('clock_in', date, from), punch('clock_out', endDate, to)];

const contract = (over: Partial<ContractTerms> = {}): ContractTerms => ({
  ...blankContract('contractor', '2026-01-01', 'USD'), ...over,
});

const COLOMBIA_H2_2026 = { night: 35, holiday: 90, holidayNight: 125, otDay: 25, otNight: 75, otHolidayDay: 115, otHolidayNight: 165 };
const salaryCO = (over: Partial<ContractTerms> = {}) => contract({
  relationship: 'employee', payType: 'fixed', payPeriod: 'monthly', amount: 2_100_000, currency: 'COP',
  schedule: { 0: 0, 1: 8.4, 2: 8.4, 3: 8.4, 4: 8.4, 5: 8.4, 6: 0 }, // 42 h / week
  overtimeEligible: true, overtimeBasis: 'schedule', nightStart: '19:00', nightEnd: '06:00', holidayWeekdays: [0],
  surcharges: COLOMBIA_H2_2026, monthlyHoursDivisor: 210, ...over,
});

const pay = (contracts: ContractTerms[], entries: TimeEntry[] = [], extra: Partial<Parameters<typeof calculatePay>[0]> = {}) =>
  calculatePay({ contracts, entries, leaves: [], adjustments: [], period: OCT, timeZone: BOGOTA, ...extra });

describe('dates', () => {
  it('Oct 5 2026 is a Monday and addDays crosses months', () => {
    expect(weekdayOf('2026-10-05')).toBe(1);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('contractor: an agreed fixed pay, no legal extras', () => {
  it('monthly fixed pay for a full month', () => {
    const r = pay([contract({ payType: 'fixed', payPeriod: 'monthly', amount: 3000 })]);
    expect(r.pay.base).toBeCloseTo(3000, 3);
    expect(r.gross).toBeCloseTo(3000, 3);
    expect(r.currency).toBe('USD');
  });
  it('biweekly fixed pay: a 14-day period pays one amount, 7 days pays half', () => {
    const c = contract({ payType: 'fixed', payPeriod: 'biweekly', amount: 1000 });
    expect(pay([c], [], { period: { from: '2026-10-01', to: '2026-10-14' } }).gross).toBeCloseTo(1000, 3);
    expect(pay([c], [], { period: { from: '2026-10-01', to: '2026-10-07' } }).gross).toBeCloseTo(500, 3);
  });
  it('weekly fixed pay', () => {
    const c = contract({ payType: 'fixed', payPeriod: 'weekly', amount: 700 });
    expect(pay([c], [], { period: { from: '2026-10-05', to: '2026-10-11' } }).gross).toBeCloseTo(700, 3);
  });
  it('semimonthly (quincena) pays exactly one amount per half, in 31-day and 28-day months', () => {
    const c = contract({ payType: 'fixed', payPeriod: 'semimonthly', amount: 1000 });
    expect(pay([c], [], { period: { from: '2026-10-01', to: '2026-10-15' } }).gross).toBeCloseTo(1000, 3);
    expect(pay([c], [], { period: { from: '2026-10-16', to: '2026-10-31' } }).gross).toBeCloseTo(1000, 3);
    expect(pay([c], [], { period: { from: '2026-02-16', to: '2026-02-28' } }).gross).toBeCloseTo(1000, 3);
  });
  it('hourly contractor is paid hours x rate and never gets overtime, even on a 14 hour day', () => {
    const r = pay([contract({ payType: 'hourly', amount: 25 })], shift('2026-10-06', '08:00', '22:00'));
    expect(r.totalHours).toBe(14);
    expect(r.overtimeHours).toBe(0);
    expect(r.gross).toBeCloseTo(350, 3);
  });
  it('commissions, bonuses and refunds add; deductions subtract; lines outside the period are ignored', () => {
    const adj: PayAdjustment[] = [
      { date: '2026-10-20', kind: 'commission', amount: 500 },
      { date: '2026-10-31', kind: 'bonus', amount: 100 },
      { date: '2026-10-15', kind: 'reimbursement', amount: 20 },
      { date: '2026-10-10', kind: 'deduction', amount: 50 },
      { date: '2026-11-02', kind: 'commission', amount: 9999 },
    ];
    const r = pay([contract({ payType: 'fixed', amount: 1000 })], [], { adjustments: adj });
    expect(r.pay.commissions).toBe(620);
    expect(r.pay.deductions).toBe(50);
    expect(r.gross).toBeCloseTo(1570, 3);
  });
  it('a Colombian contractor paid in USD by a foreign company: fixed pay + commission, nothing else', () => {
    const r = pay([contract({ payType: 'fixed', payPeriod: 'monthly', amount: 2500, currency: 'USD' })],
      shift('2026-10-06', '09:00', '19:00'), { adjustments: [{ date: '2026-10-28', kind: 'commission', amount: 400 }] });
    expect(r.gross).toBeCloseTo(2900, 3);
    expect(r.pay.surcharges).toBe(0);
    expect(r.pay.overtime).toBe(0);
  });
});

describe('contract versions', () => {
  it('a mid-period raise pays each day with the version in force that day', () => {
    const v1 = contract({ effectiveFrom: '2026-01-01', payType: 'fixed', amount: 3000 });
    const v2 = contract({ effectiveFrom: '2026-10-16', payType: 'fixed', amount: 4000 });
    expect(pay([v1, v2]).gross).toBeCloseTo((15 * 3000 + 16 * 4000) / 31, 3);
    // September is untouched by the October raise
    expect(pay([v1, v2], [], { period: { from: '2026-09-01', to: '2026-09-30' } }).gross).toBeCloseTo(3000, 3);
  });
  it('fixed pay stops after the contract end date', () => {
    const c = contract({ payType: 'fixed', amount: 3000, endDate: '2026-10-10' });
    expect(pay([c]).gross).toBeCloseTo(10 * 3000 / 31, 3);
  });
  it('no contract at all, or work before the first version, is flagged and not paid', () => {
    expect(pay([]).warnings.join()).toMatch(/no contract/i);
    const late = contract({ effectiveFrom: '2026-10-20', payType: 'hourly', amount: 10 });
    const r = pay([late], shift('2026-10-05', '09:00', '17:00'));
    expect(r.gross).toBe(0);
    expect(r.warnings.join()).toMatch(/without an active contract/i);
  });
});

describe('worked time', () => {
  it('lunch is unpaid', () => {
    const e = [punch('clock_in', '2026-10-05', '09:00'), punch('start_lunch', '2026-10-05', '12:00'),
      punch('end_lunch', '2026-10-05', '13:00'), punch('clock_out', '2026-10-05', '17:00')];
    expect(workIntervals(e)).toHaveLength(2);
    expect(pay([contract({ payType: 'hourly', amount: 20 })], e).gross).toBeCloseTo(140, 3);
  });
  it('an open shift without clock-out is not paid; shifts outside the period are ignored', () => {
    const r = pay([contract({ payType: 'hourly', amount: 20 })],
      [punch('clock_in', '2026-10-06', '09:00'), ...shift('2026-11-02', '09:00', '17:00')]);
    expect(r.gross).toBe(0);
    expect(r.warnings.join()).toMatch(/no clock-out/);
  });
  it('a forgotten punch-out never pays the days in between, and later shifts still count', () => {
    const r = pay([contract({ payType: 'hourly', amount: 10 })],
      [punch('clock_in', '2026-10-06', '09:00'), ...shift('2026-10-08', '09:00', '17:00')]);
    expect(r.totalHours).toBe(8);
    expect(r.gross).toBeCloseTo(80, 3);
  });
  it('warns when a day exceeds the maximum hours', () => {
    const r = pay([contract({ payType: 'hourly', amount: 10, maxDailyHours: 8 })], shift('2026-10-06', '08:00', '18:00'));
    expect(r.warnings.join()).toMatch(/daily maximum/);
  });
  it('weekly hours are the sum of the schedule', () => {
    expect(weeklyHours(salaryCO())).toBeCloseTo(42, 6);
  });
});

describe('surcharges are only what the company typed (any percentage, any country)', () => {
  const hourly = (night: number) => contract({
    relationship: 'employee', payType: 'hourly', amount: 10, overtimeEligible: true, overtimeBasis: 'fixed', overtimeDailyHours: 12,
    nightStart: '19:00', nightEnd: '06:00', surcharges: { ...NO_SURCHARGES, night },
  });
  const nightShift = shift('2026-10-05', '20:00', '23:00');
  it.each([[20, 36], [30, 39], [15, 34.5], [40, 42]])('night surcharge %i%% on 3 night hours at 10/h = %f', (pct, expected) => {
    const r = pay([hourly(pct)], nightShift);
    expect(r.hours.night).toBe(3);
    expect(r.gross).toBeCloseTo(expected, 3);
  });
  it('a surcharge left at zero pays nothing extra', () => {
    expect(pay([hourly(0)], nightShift).gross).toBeCloseTo(30, 3);
  });
  it('the same instant is day or night depending on the company time zone', () => {
    const entries: TimeEntry[] = [
      { id: 'a', employeeId: 'e', action: 'clock_in', date: '2026-10-05', timestamp: '2026-10-06T01:00:00Z' },
      { id: 'b', employeeId: 'e', action: 'clock_out', date: '2026-10-05', timestamp: '2026-10-06T04:00:00Z' },
    ];
    const bogota = pay([hourly(35)], entries, { timeZone: 'America/Bogota' }); // 20:00-23:00 local
    const newYork = pay([hourly(35)], entries, { timeZone: 'America/New_York', period: { from: '2026-10-01', to: '2026-10-31' } }); // 21:00-00:00 local
    expect(bogota.hours.night).toBe(3);
    expect(newYork.hours.night).toBe(3);
    const utcDay = pay([hourly(35)], entries, { timeZone: 'Pacific/Auckland' }); // 14:00-17:00 next day local, daytime
    expect(utcDay.hours.night).toBe(0);
  });
});

describe('salaried employee with legal extras (Colombia second half 2026 numbers, typed by the company)', () => {
  it('Sunday work inside the ordinary day pays only the holiday surcharge', () => {
    const r = pay([salaryCO()], shift('2026-10-11', '08:00', '12:00'));
    expect(r.hours.holiday).toBe(4);
    expect(r.pay.surcharges).toBeCloseTo(4 * 10_000 * 0.9, 2);
    expect(r.gross).toBeCloseTo(2_100_000 + 36_000, 2);
  });
  it('a holiday from the company calendar is paid with the holiday rate', () => {
    const r = pay([salaryCO()], shift('2026-10-12', '08:00', '12:00'), { holidays: ['2026-10-12'] });
    expect(r.hours.holiday).toBe(4);
  });
  it('overtime splits into daytime and nighttime at the clock', () => {
    const r = pay([salaryCO()], shift('2026-10-05', '08:00', '21:00'));
    expect(r.hours.ordinary).toBeCloseTo(8.4, 3);
    expect(r.hours.otDay).toBeCloseTo(2.6, 3);
    expect(r.hours.otNight).toBeCloseTo(2, 3);
    expect(r.pay.overtime).toBeCloseTo(2.6 * 10_000 * 1.25 + 2 * 10_000 * 1.75, 2);
    expect(r.gross).toBeCloseTo(2_100_000 + 67_500, 2);
  });
  it('a shift across midnight into Sunday is classified minute by minute', () => {
    const r = pay([salaryCO()], shift('2026-10-10', '20:00', '02:00', '2026-10-11'));
    expect(r.hours.night).toBeCloseTo(4, 3);          // Saturday 20-24
    expect(r.hours.holidayNight).toBeCloseTo(2, 3);    // Sunday 00-02
    expect(r.pay.surcharges).toBeCloseTo(4 * 10_000 * 0.35 + 2 * 10_000 * 1.25, 2);
    expect(r.overtimeHours).toBe(0);
  });
});

describe('overtime rules the company chooses', () => {
  const hourlyOT = (over: Partial<ContractTerms> = {}) => contract({
    relationship: 'employee', payType: 'hourly', amount: 10, overtimeEligible: true, overtimeBasis: 'schedule',
    nightStart: '21:00', nightEnd: '06:00', surcharges: { ...NO_SURCHARGES, otDay: 25 }, ...over,
  });
  it('hours over the scheduled day are overtime at the typed percentage', () => {
    const r = pay([hourlyOT()], shift('2026-10-05', '08:00', '18:00'));
    expect(r.overtimeHours).toBe(2);
    expect(r.pay.base).toBeCloseTo(80, 3);
    expect(r.pay.overtime).toBeCloseTo(25, 3);
    expect(r.gross).toBeCloseTo(105, 3);
  });
  it('overtime is off when the person is not eligible, whatever the percentages', () => {
    const r = pay([hourlyOT({ overtimeEligible: false })], shift('2026-10-05', '08:00', '18:00'));
    expect(r.overtimeHours).toBe(0);
    expect(r.gross).toBeCloseTo(100, 3);
  });
  it('weekly threshold (e.g. 40 h) makes the last hours of the week overtime at 50%', () => {
    const entries = ['05', '06', '07', '08', '09'].flatMap(d => shift(`2026-10-${d}`, '09:00', '18:00'));
    const r = pay([hourlyOT({ overtimeBasis: 'fixed', overtimeWeeklyHours: 40, surcharges: { ...NO_SURCHARGES, otDay: 50 } })], entries);
    expect(r.totalHours).toBe(45);
    expect(r.hours.otDay).toBe(5);
    expect(r.pay.base).toBeCloseTo(400, 3);      // 40 h x 10
    expect(r.pay.overtime).toBeCloseTo(75, 3);   // 5 h x 10 x 1.5
  });
});

describe('leave', () => {
  const lv = (over: Partial<LeaveInput>): LeaveInput => ({
    category: 'sick', startDate: '2026-10-07', endDate: '2026-10-07', hours: 8, isPaid: true, unpaidHours: 0, status: 'approved', ...over,
  });
  it('hourly contractor: paid leave is paid, unpaid leave is simply not paid (no double deduction)', () => {
    const c = contract({ payType: 'hourly', amount: 25 });
    expect(pay([c], [], { leaves: [lv({})] }).pay.paidLeave).toBeCloseTo(200, 3);
    const unpaid = pay([c], [], { leaves: [lv({ isPaid: false, unpaidHours: 8 })] });
    expect(unpaid.pay.paidLeave).toBe(0);
    expect(unpaid.pay.unpaidDeduction).toBe(0);
    expect(unpaid.gross).toBe(0);
  });
  it('fixed pay: an unpaid day is deducted at monthly pay / 30', () => {
    const c = contract({ payType: 'fixed', payPeriod: 'monthly', amount: 3100 });
    const r = pay([c], [], { leaves: [lv({ isPaid: false, unpaidHours: 8 })] });
    expect(r.pay.unpaidDeduction).toBeCloseTo(3100 / 30, 3);
    expect(r.gross).toBeCloseTo(3100 - 3100 / 30, 3);
  });
  it('fixed pay: paid leave costs nothing extra, pending or rejected leave is ignored', () => {
    const c = contract({ payType: 'fixed', amount: 3100 });
    const r = pay([c], [], { leaves: [lv({}), lv({ status: 'pending', isPaid: false, unpaidHours: 8 }), lv({ status: 'rejected', isPaid: false, unpaidHours: 8 })] });
    expect(r.gross).toBeCloseTo(3100, 3);
  });
});

describe('defaults', () => {
  it('a contractor form starts with no legal extras at all', () => {
    const c = blankContract('contractor', '2026-10-01');
    expect(c.overtimeEligible).toBe(false);
    expect(Object.values(c.surcharges).every(v => v === 0)).toBe(true);
    expect(c.vacationDaysPerMonth).toBe(0);
    expect(c.ptoHoursPerYear).toBe(0);
  });
});
