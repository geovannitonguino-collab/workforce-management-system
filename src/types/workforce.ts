export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'admin';
  hourlyRate: number; // USD, 4 decimal precision
  vacationAccrualRate: number; // days per month
  paidPtoLimitHours: number; // total allowed paid PTO hours per year
  hireDate: string; // ISO date
  department: string;
  avatarUrl?: string;
}

export type ClockAction = 'clock_in' | 'start_lunch' | 'end_lunch' | 'start_break' | 'end_break' | 'clock_out';

export interface TimeEntry {
  id: string;
  employeeId: string;
  action: ClockAction;
  timestamp: string; // ISO datetime
  date: string; // ISO date (YYYY-MM-DD)
}

export interface DailyTimeSummary {
  date: string;
  employeeId: string;
  clockIn?: string;
  clockOut?: string;
  totalMinutes: number;
  lunchMinutes: number;
  breakMinutes: number;
  netWorkMinutes: number;
  netWorkHours: number; // 4 decimal precision
}

export type LeaveCategory = 'sick' | 'pto' | 'vacation' | 'personal';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  category: LeaveCategory;
  startDate: string;
  endDate: string;
  hours: number; // requested hours
  isPaid: boolean; // auto-calculated
  unpaidHours: number; // hours exceeding PTO limit
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  createdAt: string;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  totalPaidPtoHours: number; // contract limit
  usedPaidPtoHours: number;
  remainingPaidPtoHours: number;
  accruedVacationDays: number; // based on hire date
  usedVacationDays: number;
  remainingVacationDays: number;
}

export interface PayrollSummary {
  employeeId: string;
  employeeName: string;
  period: string; // e.g., "2026-04"
  totalWorkHours: number;
  hourlyRate: number;
  grossPay: number;
  paidLeaveHours: number;
  paidLeaveAmount: number;
  unpaidLeaveHours: number;
  unpaidLeaveDeduction: number;
  netPay: number;
}

export type AppView = 'employee' | 'admin';

export interface ClockStatus {
  isClockedIn: boolean;
  isOnLunch: boolean;
  isOnBreak: boolean;
  currentSessionStart?: string;
  todayEntries: TimeEntry[];
}
