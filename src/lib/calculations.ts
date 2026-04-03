import { TimeEntry, DailyTimeSummary, Employee, LeaveBalance, LeaveRequest, PayrollSummary } from '@/types/workforce';

// Round to 4 decimal places for precision
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function minutesToHours(minutes: number): number {
  return round4(minutes / 60);
}

export function calculateDailySummary(entries: TimeEntry[], employeeId: string, date: string): DailyTimeSummary {
  const dayEntries = entries
    .filter(e => e.employeeId === employeeId && e.date === date)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let clockIn: string | undefined;
  let clockOut: string | undefined;
  let lunchStart: number | null = null;
  let breakStart: number | null = null;
  let lunchMinutes = 0;
  let breakMinutes = 0;

  for (const entry of dayEntries) {
    const ts = new Date(entry.timestamp).getTime();
    switch (entry.action) {
      case 'clock_in': clockIn = entry.timestamp; break;
      case 'start_lunch': lunchStart = ts; break;
      case 'end_lunch':
        if (lunchStart) { lunchMinutes += (ts - lunchStart) / 60000; lunchStart = null; }
        break;
      case 'start_break': breakStart = ts; break;
      case 'end_break':
        if (breakStart) { breakMinutes += (ts - breakStart) / 60000; breakStart = null; }
        break;
      case 'clock_out': clockOut = entry.timestamp; break;
    }
  }

  let totalMinutes = 0;
  if (clockIn && clockOut) {
    totalMinutes = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
  }

  // Net work = total - lunch (breaks are PAID, so not subtracted)
  const netWorkMinutes = Math.max(0, totalMinutes - lunchMinutes);

  return {
    date, employeeId, clockIn, clockOut,
    totalMinutes: round4(totalMinutes),
    lunchMinutes: round4(lunchMinutes),
    breakMinutes: round4(breakMinutes),
    netWorkMinutes: round4(netWorkMinutes),
    netWorkHours: minutesToHours(netWorkMinutes),
  };
}

/**
 * ACCRUAL RULES:
 * - Vacation: 0.416 days/month worked = 5 days/year
 * - PTO: Hard limit of 5 days (40 hours) per year, no rollover
 * - PTO resets every Jan 1 or hire anniversary (we use Jan 1)
 */
const VACATION_ACCRUAL_PER_MONTH = 0.416;
const PTO_LIMIT_DAYS = 5;
const PTO_LIMIT_HOURS = PTO_LIMIT_DAYS * 8; // 40 hours
const HOURS_PER_DAY = 8;

export function calculateLeaveBalance(employee: Employee, leaveRequests: LeaveRequest[], year: number): LeaveBalance {
  const hireDate = new Date(employee.hireDate);
  const now = new Date();

  // Months since hire (capped to not go negative)
  const totalMonthsEmployed = Math.max(0,
    (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth())
  );

  // Vacation: 0.416 days per month worked
  const accruedVacationDays = round4(totalMonthsEmployed * VACATION_ACCRUAL_PER_MONTH);

  // Filter approved requests for this year
  const yearRequests = leaveRequests.filter(
    lr => lr.employeeId === employee.id && lr.status === 'approved' && new Date(lr.startDate).getFullYear() === year
  );

  // Used vacation (only 'vacation' category)
  const usedVacationDays = round4(
    yearRequests.filter(lr => lr.category === 'vacation').reduce((sum, lr) => sum + lr.hours / HOURS_PER_DAY, 0)
  );

  // Used PTO (only 'pto' category, paid portion only)
  const usedPaidPtoHours = round4(
    yearRequests.filter(lr => lr.category === 'pto').reduce((sum, lr) => sum + (lr.hours - lr.unpaidHours), 0)
  );

  return {
    employeeId: employee.id,
    year,
    totalPaidPtoHours: PTO_LIMIT_HOURS,
    usedPaidPtoHours,
    remainingPaidPtoHours: round4(Math.max(0, PTO_LIMIT_HOURS - usedPaidPtoHours)),
    accruedVacationDays,
    usedVacationDays,
    remainingVacationDays: round4(Math.max(0, accruedVacationDays - usedVacationDays)),
  };
}

/**
 * ABSENCE VALIDATION & PAID/UNPAID LOGIC:
 * - Sick: Always paid (within PTO balance), excess is unpaid
 * - PTO: Max 5 days/year paid. 6th+ day auto-tagged "Unpaid Personal Leave"
 * - Vacation: Only allowed if accrued balance >= requested days. Always paid from accrual.
 * - Personal: Defaults to UNPAID unless user opts to use PTO balance
 */
export function calculateLeaveRequestPaidStatus(
  request: { category: string; hours: number; usesPtoBalance?: boolean },
  balance: LeaveBalance
): { isPaid: boolean; unpaidHours: number } {
  const { category, hours } = request;

  switch (category) {
    case 'vacation': {
      // Vacation is paid from accrual — always paid if balance allows (validation prevents over-request)
      return { isPaid: true, unpaidHours: 0 };
    }
    case 'pto': {
      // Hard limit: 5 days (40h). Beyond that → unpaid
      const remaining = balance.remainingPaidPtoHours;
      if (hours <= remaining) return { isPaid: true, unpaidHours: 0 };
      const paidPortion = Math.max(0, remaining);
      return { isPaid: false, unpaidHours: round4(hours - paidPortion) };
    }
    case 'sick': {
      // Sick uses PTO balance; excess is unpaid
      const remaining = balance.remainingPaidPtoHours;
      if (hours <= remaining) return { isPaid: true, unpaidHours: 0 };
      return { isPaid: false, unpaidHours: round4(hours - Math.max(0, remaining)) };
    }
    case 'personal': {
      // Always unpaid UNLESS user explicitly chooses to use PTO balance
      if (request.usesPtoBalance) {
        const remaining = balance.remainingPaidPtoHours;
        if (hours <= remaining) return { isPaid: true, unpaidHours: 0 };
        return { isPaid: false, unpaidHours: round4(hours - Math.max(0, remaining)) };
      }
      return { isPaid: false, unpaidHours: hours };
    }
    default:
      return { isPaid: false, unpaidHours: hours };
  }
}

/**
 * VACATION VALIDATION:
 * Only selectable if Accrued Balance >= Requested Days
 */
export function canRequestVacation(balance: LeaveBalance, requestedDays: number): boolean {
  return balance.remainingVacationDays >= requestedDays;
}

/**
 * NET PAY MASTER FORMULA:
 * Gross Pay = (Total Work Hours - Unpaid Break Hours) × Hourly Rate
 * Adjustments = (Paid PTO hours × Rate) + (Paid Vacation hours × Rate)
 * Deductions = Unpaid Absences × Rate
 * Final Net Pay = Gross Pay + Adjustments - Deductions
 */
export function calculatePayroll(
  employee: Employee,
  dailySummaries: DailyTimeSummary[],
  leaveRequests: LeaveRequest[],
  period: string
): PayrollSummary {
  // Gross = net work hours (already excludes lunch/break) × rate
  const totalWorkHours = round4(dailySummaries.reduce((sum, d) => sum + d.netWorkHours, 0));
  const grossPay = round4(totalWorkHours * employee.hourlyRate);

  const periodRequests = leaveRequests.filter(
    lr => lr.employeeId === employee.id && lr.status === 'approved' && lr.startDate.startsWith(period)
  );

  // Adjustments: paid leave hours (PTO + Vacation that are paid)
  const paidLeaveHours = round4(periodRequests.reduce((sum, lr) => sum + (lr.hours - lr.unpaidHours), 0));
  const paidLeaveAmount = round4(paidLeaveHours * employee.hourlyRate);

  // Deductions: unpaid absence hours × rate
  const unpaidLeaveHours = round4(periodRequests.reduce((sum, lr) => sum + lr.unpaidHours, 0));
  const unpaidLeaveDeduction = round4(unpaidLeaveHours * employee.hourlyRate);

  // Final Net Pay = Gross + Adjustments - Deductions
  const netPay = round4(grossPay + paidLeaveAmount - unpaidLeaveDeduction);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    period, totalWorkHours,
    hourlyRate: employee.hourlyRate,
    grossPay, paidLeaveHours, paidLeaveAmount,
    unpaidLeaveHours, unpaidLeaveDeduction, netPay,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
