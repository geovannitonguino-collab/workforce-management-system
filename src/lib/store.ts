import { supabase } from '@/lib/supabase';
import { Employee, TimeEntry, LeaveRequest, MedicalProof } from '@/types/workforce';

function toEmployee(r: Record<string, unknown>): Employee {
  return {
    id: r.id as string, name: r.name as string, email: r.email as string,
    role: r.role as 'employee' | 'admin', hourlyRate: Number(r.hourly_rate),
    vacationAccrualRate: Number(r.vacation_accrual_rate),
    paidPtoLimitHours: Number(r.paid_pto_limit_hours),
    hireDate: r.hire_date as string, department: r.department as string,
    avatarUrl: r.avatar_url as string | undefined,
  };
}
function toTimeEntry(r: Record<string, unknown>): TimeEntry {
  return {
    id: r.id as string, employeeId: r.employee_id as string,
    action: r.action as TimeEntry['action'], timestamp: r.timestamp as string, date: r.date as string,
  };
}
function toLeaveRequest(r: Record<string, unknown>): LeaveRequest {
  return {
    id: r.id as string, employeeId: r.employee_id as string,
    category: r.category as LeaveRequest['category'],
    startDate: r.start_date as string, endDate: r.end_date as string,
    hours: Number(r.hours), isPaid: r.is_paid as boolean,
    unpaidHours: Number(r.unpaid_hours), status: r.status as LeaveRequest['status'],
    reason: (r.reason as string) ?? '', usesPtoBalance: r.uses_pto_balance as boolean | undefined,
    createdAt: r.created_at as string,
  };
}
function toMedicalProof(r: Record<string, unknown>): MedicalProof {
  return {
    id: r.id as string, leaveRequestId: r.leave_request_id as string,
    fileName: r.file_name as string, fileData: r.file_data as string,
    uploadedAt: r.uploaded_at as string,
  };
}

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []).map(toEmployee);
}
export async function addEmployee(emp: Omit<Employee, 'id'> & { id?: string }): Promise<Employee> {
  const row: Record<string, unknown> = {
    name: emp.name, email: emp.email, role: emp.role, hourly_rate: emp.hourlyRate,
    vacation_accrual_rate: emp.vacationAccrualRate, paid_pto_limit_hours: emp.paidPtoLimitHours,
    hire_date: emp.hireDate, department: emp.department, avatar_url: emp.avatarUrl ?? null,
  };
  if (emp.id) row.id = emp.id;
  const { data, error } = await supabase.from('employees').insert(row).select().single();
  if (error) throw error;
  return toEmployee(data);
}
export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.hourlyRate !== undefined) row.hourly_rate = updates.hourlyRate;
  if (updates.vacationAccrualRate !== undefined) row.vacation_accrual_rate = updates.vacationAccrualRate;
  if (updates.paidPtoLimitHours !== undefined) row.paid_pto_limit_hours = updates.paidPtoLimitHours;
  if (updates.hireDate !== undefined) row.hire_date = updates.hireDate;
  if (updates.department !== undefined) row.department = updates.department;
  const { error } = await supabase.from('employees').update(row).eq('id', id);
  if (error) throw error;
}

export async function getTimeEntries(employeeId?: string): Promise<TimeEntry[]> {
  let q = supabase.from('time_entries').select('*').order('timestamp');
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toTimeEntry);
}
export async function addTimeEntry(entry: Omit<TimeEntry, 'id'> & { id?: string }): Promise<TimeEntry> {
  const row: Record<string, unknown> = {
    employee_id: entry.employeeId, action: entry.action,
    timestamp: entry.timestamp, date: entry.date,
  };
  if (entry.id) row.id = entry.id;
  const { data, error } = await supabase.from('time_entries').insert(row).select().single();
  if (error) throw error;
  return toTimeEntry(data);
}

export async function getLeaveRequests(employeeId?: string): Promise<LeaveRequest[]> {
  let q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toLeaveRequest);
}
export async function addLeaveRequest(req: LeaveRequest): Promise<LeaveRequest> {
  const { data, error } = await supabase.from('leave_requests').insert({
    id: req.id, employee_id: req.employeeId, category: req.category,
    start_date: req.startDate, end_date: req.endDate, hours: req.hours,
    is_paid: req.isPaid, unpaid_hours: req.unpaidHours, status: req.status,
    reason: req.reason ?? null, uses_pto_balance: req.usesPtoBalance ?? null,
  }).select().single();
  if (error) throw error;
  return toLeaveRequest(data);
}
export async function updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.isPaid !== undefined) row.is_paid = updates.isPaid;
  if (updates.unpaidHours !== undefined) row.unpaid_hours = updates.unpaidHours;
  if (updates.reason !== undefined) row.reason = updates.reason;
  if (updates.usesPtoBalance !== undefined) row.uses_pto_balance = updates.usesPtoBalance;
  const { error } = await supabase.from('leave_requests').update(row).eq('id', id);
  if (error) throw error;
}

export async function getMedicalProofs(leaveRequestId: string): Promise<MedicalProof[]> {
  const { data, error } = await supabase.from('medical_proofs').select('*')
    .eq('leave_request_id', leaveRequestId).order('uploaded_at');
  if (error) throw error;
  return (data ?? []).map(toMedicalProof);
}
export async function addMedicalProof(proof: MedicalProof): Promise<MedicalProof> {
  const { data, error } = await supabase.from('medical_proofs').insert({
    id: proof.id, leave_request_id: proof.leaveRequestId,
    file_name: proof.fileName, file_data: proof.fileData, uploaded_at: proof.uploadedAt,
  }).select().single();
  if (error) throw error;
  return toMedicalProof(data);
}
export async function updateMedicalProof(id: string, updates: Partial<MedicalProof>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.fileName !== undefined) row.file_name = updates.fileName;
  if (updates.fileData !== undefined) row.file_data = updates.fileData;
  if (updates.uploadedAt !== undefined) row.uploaded_at = updates.uploadedAt;
  const { error } = await supabase.from('medical_proofs').update(row).eq('id', id);
  if (error) throw error;
}
export async function deleteMedicalProof(id: string): Promise<void> {
  const { error } = await supabase.from('medical_proofs').delete().eq('id', id);
  if (error) throw error;
}
