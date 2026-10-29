export interface Employee {
  id: string;
  name: string;
  email: string;
  userId?: string; // linked Supabase Auth user
  termsVersion?: string; // last accepted Terms/Privacy version
  /** 'admin' is the legacy name of 'director' (kept so older rows still work) */
  role: 'director' | 'manager' | 'employee' | 'admin';
  hourlyRate: number;
  vacationAccrualRate: number; // fixed at 0.416 days/month
  paidPtoLimitHours: number; // fixed at 40 (5 days × 8h)
  hireDate: string;
  department: string;
  departmentId?: string;
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

export interface MedicalProof {
  id: string;
  leaveRequestId: string;
  fileName: string;
  storagePath?: string; // private Storage object path
  fileData?: string; // legacy base64 (pre-Storage rows)
  uploadedAt: string;
}

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
  usesPtoBalance?: boolean;
  medicalProofIds?: string[]; // references to MedicalProof entries
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

export type CorrectionKind = 'add' | 'edit' | 'void';

export interface TimeCorrection {
  id: string;
  employeeId: string;
  kind: CorrectionKind;
  entryId?: string;
  action?: ClockAction;
  requestedTimestamp?: string;
  requestedDate?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorId?: string;
  event: string;
  entity: string;
  entityId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface BillingStatus {
  planId: string;
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  effective: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  maxEmployees?: number;
  employeeCount: number;
  canAddEmployees: boolean;
}

export interface Department {
  id: string;
  name: string;
  managerEmployeeId?: string;
}

export const isDirectorRole = (r?: Employee['role']) => r === 'director' || r === 'admin';
export const roleLabel = (r: Employee['role']) =>
  r === 'director' || r === 'admin' ? 'Director' : r === 'manager' ? 'Manager' : 'Employee';
