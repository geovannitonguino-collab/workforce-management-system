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
      case 'clock_in':
        clockIn = entry.timestamp;
        break;
      case 'start_lunch':
        lunchStart = ts;
        break;
      case 'end_lunch':
        if (lunchStart) {
          lunchMinutes += (ts - lunchStart) / 60000;
          lunchStart = null;
        }
        break;
      case 'start_break':
        breakStart = ts;
        break;
      case 'end_break':
        if (breakStart) {
          breakMinutes += (ts - breakStart) / 60000;
          breakStart = null;
        }
        break;
      case 'clock_out':
        clockOut = entry.timestamp;
        break;
    }
  }

  let totalMinutes = 0;
  if (clockIn && clockOut) {
    totalMinutes = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
  }

  const netWorkMinutes = Math.max(0, totalMinutes - lunchMinutes - breakMinutes);

  return {
    date,
    employeeId,
    clockIn,
    clockOut,
    totalMinutes: round4(totalMinutes),
    lunchMinutes: round4(lunchMinutes),
    breakMinutes: round4(breakMinutes),
    netWorkMinutes: round4(netWorkMinutes),
    netWorkHours: minutesToHours(netWorkMinutes),
  };
}

export function calculateLeaveBalance(employee: Employee, leaveRequests: LeaveRequest[], year: number): LeaveBalance {
  const hireDate = new Date(employee.hireDate);
  const now = new Date();
  const monthsEmployed = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
  const accruedVacationDays = round4(Math.max(0, monthsEmployed * employee.vacationAccrualRate));

  const yearRequests = leaveRequests.filter(
    lr => lr.employeeId === employee.id && lr.status === 'approved' && new Date(lr.startDate).getFullYear() === year
  );

  const usedPaidPtoHours = round4(yearRequests.filter(lr => lr.category === 'pto').reduce((sum, lr) => sum + Math.min(lr.hours, lr.hours - lr.unpaidHours), 0));
  const usedVacationDays = round4(yearRequests.filter(lr => lr.category === 'vacation').reduce((sum, lr) => sum + lr.hours / 8, 0));

  return {
    employeeId: employee.id,
    year,
    totalPaidPtoHours: employee.paidPtoLimitHours,
    usedPaidPtoHours,
    remainingPaidPtoHours: round4(Math.max(0, employee.paidPtoLimitHours - usedPaidPtoHours)),
    accruedVacationDays,
    usedVacationDays,
    remainingVacationDays: round4(Math.max(0, accruedVacationDays - usedVacationDays)),
  };
}

export function calculateLeaveRequestPaidStatus(
  request: Omit<LeaveRequest, 'isPaid' | 'unpaidHours'>,
  balance: LeaveBalance
): { isPaid: boolean; unpaidHours: number } {
  const remaining = balance.remainingPaidPtoHours;
  if (request.hours <= remaining) {
    return { isPaid: true, unpaidHours: 0 };
  }
  return { isPaid: false, unpaidHours: round4(request.hours - remaining) };
}

export function calculatePayroll(
  employee: Employee,
  dailySummaries: DailyTimeSummary[],
  leaveRequests: LeaveRequest[],
  period: string // YYYY-MM
): PayrollSummary {
  const totalWorkHours = round4(dailySummaries.reduce((sum, d) => sum + d.netWorkHours, 0));
  const grossPay = round4(totalWorkHours * employee.hourlyRate);

  const periodRequests = leaveRequests.filter(
    lr => lr.employeeId === employee.id && lr.status === 'approved' && lr.startDate.startsWith(period)
  );

  const paidLeaveHours = round4(periodRequests.reduce((sum, lr) => sum + (lr.hours - lr.unpaidHours), 0));
  const paidLeaveAmount = round4(paidLeaveHours * employee.hourlyRate);
  const unpaidLeaveHours = round4(periodRequests.reduce((sum, lr) => sum + lr.unpaidHours, 0));
  const unpaidLeaveDeduction = round4(unpaidLeaveHours * employee.hourlyRate);

  const netPay = round4(grossPay + paidLeaveAmount - unpaidLeaveDeduction);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    period,
    totalWorkHours,
    hourlyRate: employee.hourlyRate,
    grossPay,
    paidLeaveHours,
    paidLeaveAmount,
    unpaidLeaveHours,
    unpaidLeaveDeduction,
    netPay,
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
