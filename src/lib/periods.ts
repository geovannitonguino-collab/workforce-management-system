import { Period } from '@/types/contract';
import { addDays, daysInMonth, weekdayOf } from '@/lib/payrollEngine';

export type PeriodKind = 'week' | 'biweekly' | 'semimonthly' | 'month' | 'custom';

export const PERIOD_KIND_LABEL: Record<PeriodKind, string> = {
  week: 'Week', biweekly: 'Two weeks', semimonthly: 'Half month (quincena)', month: 'Month', custom: 'Custom range',
};

const EPOCH_MONDAY = '1970-01-05'; // a Monday: gives every two-week period a fixed, predictable start
const diffDays = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const mondayOf = (ymd: string) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));
const monthStart = (ymd: string) => ymd.slice(0, 8) + '01';
const monthEnd = (ymd: string) => ymd.slice(0, 8) + String(daysInMonth(ymd)).padStart(2, '0');

/** The period of this kind that contains `anchor` (a YYYY-MM-DD date). */
export function periodFor(kind: PeriodKind, anchor: string, custom?: Period): Period {
  switch (kind) {
    case 'week': { const from = mondayOf(anchor); return { from, to: addDays(from, 6) }; }
    case 'biweekly': {
      const weeks = Math.floor(diffDays(EPOCH_MONDAY, mondayOf(anchor)) / 7);
      const from = addDays(EPOCH_MONDAY, Math.floor(weeks / 2) * 14);
      return { from, to: addDays(from, 13) };
    }
    case 'semimonthly':
      return Number(anchor.slice(8, 10)) <= 15
        ? { from: monthStart(anchor), to: anchor.slice(0, 8) + '15' }
        : { from: anchor.slice(0, 8) + '16', to: monthEnd(anchor) };
    case 'month': return { from: monthStart(anchor), to: monthEnd(anchor) };
    case 'custom': return custom ?? { from: anchor, to: anchor };
  }
}

/** Move to the previous (-1) or next (+1) period of the same kind. */
export function shiftPeriod(kind: PeriodKind, p: Period, dir: 1 | -1): Period {
  switch (kind) {
    case 'week': return periodFor('week', addDays(p.from, 7 * dir));
    case 'biweekly': return periodFor('biweekly', addDays(p.from, 14 * dir));
    case 'semimonthly': return periodFor('semimonthly', dir === 1 ? addDays(p.to, 1) : addDays(p.from, -1));
    case 'month': return periodFor('month', dir === 1 ? addDays(p.to, 1) : addDays(p.from, -1));
    case 'custom': {
      const len = diffDays(p.from, p.to) + 1;
      return dir === 1 ? { from: addDays(p.to, 1), to: addDays(p.to, len) } : { from: addDays(p.from, -len), to: addDays(p.from, -1) };
    }
  }
}

export function periodLabel(p: Period): string {
  const f = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return p.from === p.to ? f(p.from) : `${f(p.from)} – ${f(p.to)}`;
}
