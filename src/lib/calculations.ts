import { TimeEntry, DailyTimeSummary, Employee, LeaveBalance, LeaveRequest, PayrollSummary } from '@/types/workforce';

export function round4(n: number): number { return Math.round(n * 10000) / 10000; }
export function minutesToHours(minutes: number): number { return round4(minutes / 60); }

export function calculateDailySummary(entries: TimeEntry[], employeeId: string, date: string): DailyTimeSummary {
  const dayEntries = entries
    .filter(e => e.employeeId === employeeId && e.date === date)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let clockIn: string | undefined;
  let clockOut: string | undefined;
  let lunchStart: number | null = null;
  let breakStart: number | null = null;
  let totalLunchMs = 0;
  let totalBreakMs = 0;

  for (const entry of dayEntries) {
    const ts = new Date(entry.timestamp).getTime();
    switch (entry.action) {
      case 'clock_in':    clockIn = entry.timestamp; break;
      case 'clock_out':   clockOut = entry.timestamp; break;
      case 'start_lunch': lunchStart = ts; break;
      case 'end_lunch':   if (lunchStart !== null) { totalLunchMs += ts - lunchStart; lunchStart = null; } break;
      case 'start_break': breakStart = ts; break;
      case 'end_break':   if (breakStart !== null) { totalBreakMs += ts - breakStart; breakStart = null; } break;
    }
  }

  const lunchMinutes = totalLunchMs / 60000;
  const breakMinutes = totalBreakMs / 60000;

  let totalMinutes = 0;
  if (clockIn && clockOut) {
    const raw = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
    totalMinutes = Math.max(0, raw - lunchMinutes);
  }

  const netWorkMinutes = totalMinutes;
  const netWorkHours = minutesToHours(netWorkMinutes);

  return { date, employeeId, clockIn, clockOut, totalMinutes, lunchMinutes, breakMinutes, netWorkMinutes, netWorkHours };
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Bug fix #8: parse YYYY-MM-DD as LOCAL date to avoid timezone shift (e.g. Colombia GMT-5)
export function formatDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatHours(hours: number): string {
  return `${round4(hours).toFixed(4)}h`;
}

// Bug fix #7: normalize to start of month to avoid counting partial months
export function calculateLeaveBalance(employee: Employee, leaveRequests: LeaveRequest[], year: number): LeaveBalance {
  const hireDate = new Date(employee.hireDate);
  const now = new Date();
  const hireMonth = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);
  const nowMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalMonthsEmployed = Math.max(0,
    (nowMonth.getFullYear() - hireMonth.getFullYear()) * 12 + (nowMonth.getMonth() - hireMonth.getMonth())
  );

  const accruedVacationDays = round4(totalMonthsEmployed * employee.vacationAccrualRate);
  const totalPaidPtoHours = employee.paidPtoLimitHours;

  // Bug fix #1: filter by startDate year (actual leave month), not createdAt
  const thisYearApproved = leaveRequests.filter(
    r => r.status === 'approved' && new Date(r.startDate).getFullYear() === year
  );

  const usedPaidPtoHours = thisYearApproved
    .filter(r => r.category === 'pto' && r.isPaid)
    .reduce((s, r) => s + (r.hours - r.unpaidHours), 0);

  const usedVacationDays = thisYearApproved
    .filter(r => r.category === 'vacation')
    .reduce((s, r) => s + r.hours / 8, 0);

  return {
    employeeId: employee.id, year,
    totalPaidPtoHours,
    usedPaidPtoHours: round4(usedPaidPtoHours),
    remainingPaidPtoHours: round4(Math.max(0, totalPaidPtoHours - usedPaidPtoHours)),
    accruedVacationDays,
    usedVacationDays: round4(usedVacationDays),
    remainingVacationDays: round4(Math.max(0, accruedVacationDays - usedVacationDays)),
  };
}

export function canRequestVacation(balance: LeaveBalance, requestedDays: number): boolean {
  return requestedDays <= balance.remainingVacationDays;
}

export function calculateLeaveRequestPaidStatus(
  req: { category: LeaveRequest['category']; hours: number; usesPtoBalance?: boolean },
  balance: LeaveBalance
): { isPaid: boolean; unpaidHours: number } {
  const { category, hours, usesPtoBalance } = req;

  if (category === 'sick') return { isPaid: true, unpaidHours: 0 };

  if (category === 'pto') {
    const availablePtoHours = balance.remainingPaidPtoHours;
    if (hours <= availablePtoHours) return { isPaid: true, unpaidHours: 0 };
    const unpaidHours = round4(hours - availablePtoHours);
    return { isPaid: availablePtoHours > 0, unpaidHours };
  }

  if (category === 'vacation') return { isPaid: true, unpaidHours: 0 };

  if (category === 'personal') {
    if (usesPtoBalance && balance.remainingPaidPtoHours > 0) {
      const covered = Math.min(hours, balance.remainingPaidPtoHours);
      return { isPaid: covered > 0, unpaidHours: round4(hours - covered) };
    }
    return { isPaid: false, unpaidHours: hours };
  }

  return { isPaid: false, unpaidHours: hours };
}

export function calculatePayroll(
  employee: Employee,
  dailySummaries: DailyTimeSummary[],
  leaveRequests: LeaveRequest[],
  period: string
): PayrollSummary {
  const totalWorkHours = round4(dailySummaries.reduce((s, d) => s + d.netWorkHours, 0));
  const grossPay = round4(totalWorkHours * employee.hourlyRate);

  const periodLeaves = leaveRequests.filter(
    r => r.status === 'approved' && (r.startDate.startsWith(period) || r.endDate.startsWith(period))
  );

  const paidLeaveHours = round4(periodLeaves.filter(r => r.isPaid).reduce((s, r) => s + (r.hours - r.unpaidHours), 0));
  const paidLeaveAmount = round4(paidLeaveHours * employee.hourlyRate);

  const unpaidLeaveHours = round4(periodLeaves.reduce((s, r) => s + r.unpaidHours, 0));
  const unpaidLeaveDeduction = round4(unpaidLeaveHours * employee.hourlyRate);

  const netPay = round4(grossPay + paidLeaveAmount - unpaidLeaveDeduction);

  return {
    employeeId: employee.id, employeeName: employee.name, period,
    totalWorkHours, hourlyRate: employee.hourlyRate, grossPay,
    paidLeaveHours, paidLeaveAmount, unpaidLeaveHours, unpaidLeaveDeduction, netPay,
  };
}
