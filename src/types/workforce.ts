export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'admin';
  hourlyRate: number;
  vacationAccrualRate: number; // fixed at 0.416 days/month
  paidPtoLimitHours: number; // fixed at 40 (5 days × 8h)
  hireDate: string;
  department: string;
  avatarUrl?: string;
}

export type ClockAction = 'clock_in' | 'start_lunch' | 'end_lunch' | 'start_break' | 'end_break' | 'clock_out';

export interface TimeEntry {
  id: string;
  employeeId: string;
  action: ClockAction;
  timestamp: string;
  date: string;
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
  netWorkHours: number;
}

export type LeaveCategory = 'sick' | 'pto' | 'vacation' | 'personal';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  category: LeaveCategory;
  startDate: string;
  endDate: string;
  hours: number;
  isPaid: boolean;
  unpaidHours: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  usesPtoBalance?: boolean; // for personal leave: opt-in to use PTO
  medicalCertificateUrl?: string; // for sick leave
  createdAt: string;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  totalPaidPtoHours: number; // 40h (5 days)
  usedPaidPtoHours: number;
  remainingPaidPtoHours: number;
  accruedVacationDays: number;
  usedVacationDays: number;
  remainingVacationDays: number;
}

export interface PayrollSummary {
  employeeId: string;
  employeeName: string;
  period: string;
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
