import { TimeEntry } from '@/types/workforce';
import {
  ContractTerms, HourKind, LeaveInput, PayAdjustment, PayPeriod, PayrollResult, Period, Weekday,
} from '@/types/contract';

/**
 * Payroll estimate driven ONLY by the contract terms the company entered for the person.
 * Nothing here depends on the country: surcharges, overtime and pay frequency are whatever the contract says.
 *
 * Assumptions (documented on purpose):
 *  - Lunch is unpaid, other breaks are paid (same as the daily summary).
 *  - A shift keeps the UTC offset it started with (a daylight-saving change in the middle of a shift is ignored).
 *  - A shift belongs to the calendar date it started on for the daily overtime counter and the version of the
 *    contract; each minute is classified (night / holiday) by its own local clock and date.
 */

export interface PayrollInput {
  contracts: ContractTerms[];           // every version of the person's contract
  entries: TimeEntry[];                 // the person's punches, without voided ones
  leaves: LeaveInput[];
  adjustments: PayAdjustment[];
  period: Period;
  timeZone: string;                     // IANA zone of the company, e.g. 'America/Bogota'
  holidays?: Iterable<string>;          // 'YYYY-MM-DD' dates paid with the holiday rates
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const DAY = 86400000;

// ---------- dates -----------------------------------------------------------
const toUtc = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (ymd: string, n: number) => fmt(toUtc(ymd) + n * DAY);
export const weekdayOf = (ymd: string): Weekday => new Date(toUtc(ymd)).getUTCDay() as Weekday;
export const daysInMonth = (ymd: string) => { const [y, m] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const mondayOf = (ymd: string) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function tzOffsetMs(ms: number, timeZone: string): number {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dtfCache.set(timeZone, dtf);
  }
  const parts = dtf.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const hhmm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };

// ---------- contract helpers -------------------------------------------------
export const weeklyHours = (t: ContractTerms) => Object.values(t.schedule).reduce((a, b) => a + b, 0);
const periodLength = (p: PayPeriod, ymd: string) =>
  p === 'weekly' ? 7 : p === 'biweekly' ? 14
  : p === 'semimonthly' ? (Number(ymd.slice(8, 10)) <= 15 ? 15 : daysInMonth(ymd) - 15)
  : daysInMonth(ymd);
const monthlyEquivalent = (t: ContractTerms) =>
  t.payPeriod === 'weekly' ? t.amount * 52 / 12 : t.payPeriod === 'biweekly' ? t.amount * 26 / 12
  : t.payPeriod === 'semimonthly' ? t.amount * 2 : t.amount;

/** Value of one ordinary hour. */
function hourValue(t: ContractTerms, warn: (m: string) => void): number {
  if (t.payType === 'hourly') return t.amount;
  const divisor = t.monthlyHoursDivisor ?? weeklyHours(t) * 52 / 12;
  if (!divisor) { warn('A fixed-pay contract needs weekly hours (or a monthly hours divisor) to value overtime and surcharges.'); return 0; }
  return monthlyEquivalent(t) / divisor;
}

// ---------- worked intervals -------------------------------------------------
/** No real shift lasts this long: a punch-in left open this long is a forgotten punch-out, not work. */
export const MAX_SHIFT_MS = 24 * 3600000;

export function workIntervalsDetailed(entries: TimeEntry[]): { intervals: Array<[number, number]>; discarded: number } {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const out: Array<[number, number]> = [];
  let start: number | null = null;
  let onLunch = false;
  let discarded = 0;
  for (const e of sorted) {
    const ts = new Date(e.timestamp).getTime();
    // A shift still open after 24 h was never closed: drop it instead of swallowing the next punches.
    if ((start !== null || onLunch) && start !== null && ts - start > MAX_SHIFT_MS) { discarded++; start = null; onLunch = false; }
    switch (e.action) {
      case 'clock_in': if (start === null && !onLunch) start = ts; break;
      case 'start_lunch': if (start !== null) { out.push([start, ts]); start = null; onLunch = true; } break;
      case 'end_lunch': if (onLunch) { start = ts; onLunch = false; } break;
      case 'clock_out':
        if (start !== null) { out.push([start, ts]); start = null; }
        onLunch = false;
        break;
      default: break; // paid breaks do not interrupt work
    }
  }
  return { intervals: out.filter(([a, b]) => b > a), discarded };
}

export const workIntervals = (entries: TimeEntry[]) => workIntervalsDetailed(entries).intervals;

// ---------- the engine -------------------------------------------------------
const KINDS: HourKind[] = ['ordinary', 'night', 'holiday', 'holidayNight', 'otDay', 'otNight', 'otHolidayDay', 'otHolidayNight'];

export function calculatePay(input: PayrollInput): PayrollResult {
  const { period, timeZone } = input;
  const warnings: string[] = [];
  const warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  const holidays = new Set(input.holidays ?? []);
  const versions = [...input.contracts].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const termsFor = (ymd: string): ContractTerms | undefined => {
    let found: ContractTerms | undefined;
    for (const v of versions) if (v.effectiveFrom <= ymd) found = v;
    return found;
  };

  const hours = Object.fromEntries(KINDS.map(k => [k, 0])) as Record<HourKind, number>;
  const pay = { base: 0, surcharges: 0, overtime: 0, paidLeave: 0, unpaidDeduction: 0, commissions: 0, deductions: 0 };
  const dayMin = new Map<string, number>();
  const weekMin = new Map<string, number>();
  const dayHoursByDate = new Map<string, number>();
  let unassigned = 0;

  // 1) worked time, minute by minute
  const { intervals, discarded } = workIntervalsDetailed(input.entries);
  if (discarded > 0) warn(`${discarded} shift(s) with no clock-out were ignored (a punch-in left open for more than 24 hours).`);
  for (const [startMs, endMs] of intervals) {
    const offset = tzOffsetMs(startMs, timeZone);
    const shiftDate = fmt(startMs + offset);
    if (shiftDate < period.from || shiftDate > period.to) continue;
    const terms = termsFor(shiftDate);
    if (!terms) { unassigned += (endMs - startMs) / 3600000; continue; }

    if (terms.endDate && shiftDate > terms.endDate) warn('Hours were worked after the contract end date.');
    const unit = hourValue(terms, warn) / 60; // value of one ordinary minute
    const shiftWeekday = weekdayOf(shiftDate);
    const sched = terms.schedule[shiftWeekday];
    const dailyLimitH =
      terms.overtimeBasis === 'schedule'
        ? (sched > 0 ? sched : (terms.maxDailyHours ?? Math.max(...Object.values(terms.schedule))))
        : terms.overtimeBasis === 'fixed' ? (terms.overtimeDailyHours ?? Infinity) : Infinity;
    const dailyLimitMin = dailyLimitH * 60;
    const weeklyLimitMin = terms.overtimeWeeklyHours !== undefined ? terms.overtimeWeeklyHours * 60 : Infinity;
    const overtimeOn = terms.overtimeEligible && (terms.overtimeBasis !== 'none' || weeklyLimitMin !== Infinity);
    const weekKey = mondayOf(shiftDate);
    const ns = hhmm(terms.nightStart), ne = hhmm(terms.nightEnd);

    for (let t = startMs; t < endMs; t += 60000) {
      const w = Math.min(60000, endMs - t) / 60000;
      const local = new Date(t + offset);
      const date = local.toISOString().slice(0, 10);
      const tod = local.getUTCHours() * 60 + local.getUTCMinutes();
      const night = ns === ne ? false : ns > ne ? (tod >= ns || tod < ne) : (tod >= ns && tod < ne);
      const holiday = terms.holidayWeekdays.includes(local.getUTCDay() as Weekday) || holidays.has(date);
      const dm = dayMin.get(shiftDate) ?? 0;
      const wm = weekMin.get(weekKey) ?? 0;
      const ot = overtimeOn && (dm >= dailyLimitMin || wm >= weeklyLimitMin);

      const kind: HourKind = ot
        ? (holiday ? (night ? 'otHolidayNight' : 'otHolidayDay') : (night ? 'otNight' : 'otDay'))
        : (holiday ? (night ? 'holidayNight' : 'holiday') : (night ? 'night' : 'ordinary'));
      const pct = kind === 'ordinary' ? 0 : terms.surcharges[kind] / 100;

      hours[kind] += w / 60;
      dayMin.set(shiftDate, dm + w);
      weekMin.set(weekKey, wm + w);
      dayHoursByDate.set(shiftDate, (dayHoursByDate.get(shiftDate) ?? 0) + w / 60);

      if (ot) pay.overtime += w * unit * (1 + pct);
      else if (terms.payType === 'hourly') { pay.base += w * unit; pay.surcharges += w * unit * pct; }
      else pay.surcharges += w * unit * pct; // fixed pay already covers the ordinary hour
    }
  }
  if (unassigned > 0) warn('Hours were worked without an active contract version; they were not paid.');

  for (const [date, h] of dayHoursByDate) {
    const t = termsFor(date);
    if (t?.maxDailyHours !== undefined && h > t.maxDailyHours + 1e-9) warn(`Worked ${r4(h)} h on ${date}, above the ${t.maxDailyHours} h daily maximum.`);
  }

  // 2) fixed pay, prorated by day
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
    const v = termsFor(d);
    if (!v || v.payType !== 'fixed') continue;
    if (v.endDate && d > v.endDate) continue;
    pay.base += v.amount / periodLength(v.payPeriod, d);
  }

  // 3) leave
  for (const lv of input.leaves) {
    if (lv.status !== 'approved' || lv.startDate < period.from || lv.startDate > period.to) continue;
    const v = termsFor(lv.startDate);
    if (!v) continue;
    if (v.payType === 'hourly') {
      if (lv.isPaid) pay.paidLeave += Math.max(0, lv.hours - lv.unpaidHours) * v.amount;
    } else {
      const unpaidH = lv.isPaid ? lv.unpaidHours : lv.hours;
      if (unpaidH > 0) {
        const workDays = Object.values(v.schedule).filter(h => h > 0).length;
        const dailyH = workDays > 0 ? weeklyHours(v) / workDays : 8;
        pay.unpaidDeduction += (unpaidH / dailyH) * (monthlyEquivalent(v) / (v.unpaidDayDivisor || 30));
      }
    }
  }

  // 4) hand-entered lines
  for (const a of input.adjustments) {
    if (a.date < period.from || a.date > period.to) continue;
    if (a.kind === 'deduction') pay.deductions += a.amount; else pay.commissions += a.amount;
  }

  const rounded = Object.fromEntries(Object.entries(pay).map(([k, v]) => [k, r4(v)])) as typeof pay;
  const hoursR = Object.fromEntries(KINDS.map(k => [k, r4(hours[k])])) as Record<HourKind, number>;
  const lastVersion = termsFor(period.to) ?? versions[versions.length - 1];
  const gross = r4(rounded.base + rounded.surcharges + rounded.overtime + rounded.paidLeave - rounded.unpaidDeduction + rounded.commissions - rounded.deductions);
  return {
    period, currency: lastVersion?.currency ?? '', hours: hoursR,
    totalHours: r4(KINDS.reduce((s, k) => s + hours[k], 0)),
    overtimeHours: r4(hours.otDay + hours.otNight + hours.otHolidayDay + hours.otHolidayNight),
    pay: rounded, gross, warnings: versions.length === 0 ? ['This person has no contract yet.'] : warnings,
  };
}
