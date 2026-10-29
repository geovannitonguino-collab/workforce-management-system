import { supabase } from '@/lib/supabase';
import { Employee, TimeEntry, LeaveRequest, MedicalProof, TimeCorrection, AuditEvent, BillingStatus, Department, CorrectionKind, ClockAction } from '@/types/workforce';

function toEmployee(r: Record<string, unknown>): Employee {
  return {
    id: r.id as string, name: r.name as string, email: r.email as string,
    userId: (r.user_id as string | null) ?? undefined,
    termsVersion: (r.terms_version as string | null) ?? undefined,
    role: r.role as Employee['role'], hourlyRate: Number(r.hourly_rate),
    vacationAccrualRate: Number(r.vacation_accrual_rate),
    paidPtoLimitHours: Number(r.paid_pto_limit_hours),
    hireDate: r.hire_date as string, department: r.department as string,
    departmentId: (r.department_id as string | null) ?? undefined,
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
    fileName: r.file_name as string, storagePath: (r.storage_path as string | null) ?? undefined,
    fileData: (r.file_data as string | null) ?? undefined,
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
  if (emp.departmentId) row.department_id = emp.departmentId;
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
  if (updates.departmentId !== undefined) row.department_id = updates.departmentId;
  const { error } = await supabase.from('employees').update(row).eq('id', id);
  if (error) throw error;
}

export async function getTimeEntries(employeeId?: string): Promise<TimeEntry[]> {
  let q = supabase.from('time_entries').select('*').is('voided_at', null).order('timestamp');
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
const PROOF_BUCKET = 'medical-proofs';

async function myEmployeeId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('employees').select('id').eq('user_id', user.id).single();
  if (error) throw error;
  return data.id as string;
}

async function uploadProofFile(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
}

export async function addMedicalProof(leaveRequestId: string, file: File): Promise<MedicalProof> {
  const employeeId = await myEmployeeId();
  const id = crypto.randomUUID();
  const path = `${employeeId}/${id}.pdf`;
  await uploadProofFile(path, file);
  const { data, error } = await supabase.from('medical_proofs').insert({
    id, employee_id: employeeId, leave_request_id: leaveRequestId,
    file_name: file.name, storage_path: path, uploaded_at: new Date().toISOString(),
  }).select().single();
  if (error) {
    await supabase.storage.from(PROOF_BUCKET).remove([path]);
    throw error;
  }
  return toMedicalProof(data);
}
export async function replaceMedicalProof(proof: MedicalProof, file: File): Promise<void> {
  const path = proof.storagePath ?? `${await myEmployeeId()}/${proof.id}.pdf`;
  await uploadProofFile(path, file);
  const { error } = await supabase.from('medical_proofs').update({
    file_name: file.name, storage_path: path, file_data: null, uploaded_at: new Date().toISOString(),
  }).eq('id', proof.id);
  if (error) throw error;
}
export async function deleteMedicalProof(proof: MedicalProof): Promise<void> {
  if (proof.storagePath) await supabase.storage.from(PROOF_BUCKET).remove([proof.storagePath]);
  const { error } = await supabase.from('medical_proofs').delete().eq('id', proof.id);
  if (error) throw error;
}
/** Short-lived signed URL for a private proof (falls back to legacy base64 data). */
export async function getMedicalProofUrl(proof: MedicalProof): Promise<string> {
  if (!proof.storagePath) {
    if (proof.fileData) return proof.fileData;
    throw new Error('Proof has no file');
  }
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(proof.storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function getOrganizationName(): Promise<string | null> {
  const { data, error } = await supabase.from('organizations').select('name').maybeSingle();
  if (error) return null;
  return (data?.name as string | undefined) ?? null;
}

function toCorrection(r: Record<string, unknown>): TimeCorrection {
  return {
    id: r.id as string, employeeId: r.employee_id as string, kind: r.kind as CorrectionKind,
    entryId: (r.entry_id as string | null) ?? undefined, action: (r.action as ClockAction | null) ?? undefined,
    requestedTimestamp: (r.requested_timestamp as string | null) ?? undefined,
    requestedDate: (r.requested_date as string | null) ?? undefined,
    reason: r.reason as string, status: r.status as TimeCorrection['status'],
    resolvedAt: (r.resolved_at as string | null) ?? undefined,
    resolutionNote: (r.resolution_note as string | null) ?? undefined, createdAt: r.created_at as string,
  };
}

export async function getTimeCorrections(employeeId?: string): Promise<TimeCorrection[]> {
  let q = supabase.from('time_corrections').select('*').order('created_at', { ascending: false });
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toCorrection);
}
export async function addTimeCorrection(c: {
  employeeId: string; kind: CorrectionKind; entryId?: string; action?: ClockAction;
  requestedTimestamp?: string; requestedDate?: string; reason: string;
}): Promise<void> {
  const { error } = await supabase.from('time_corrections').insert({
    employee_id: c.employeeId, kind: c.kind, entry_id: c.entryId ?? null, action: c.action ?? null,
    requested_timestamp: c.requestedTimestamp ?? null, requested_date: c.requestedDate ?? null, reason: c.reason,
  });
  if (error) throw error;
}
export async function resolveTimeCorrection(id: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_time_correction', { p_id: id, p_approve: approve, p_note: note ?? null });
  if (error) throw error;
}
export async function getAuditLog(limit = 50): Promise<AuditEvent[]> {
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(r => ({
    id: r.id as string, actorId: (r.actor_id as string | null) ?? undefined, event: r.event as string,
    entity: r.entity as string, entityId: (r.entity_id as string | null) ?? undefined,
    details: (r.details ?? {}) as Record<string, unknown>, createdAt: r.created_at as string,
  }));
}

export async function acceptTerms(version: string): Promise<void> {
  const { error } = await supabase.rpc('accept_terms', { p_version: version });
  if (error) throw error;
}

export async function getBillingStatus(): Promise<BillingStatus | null> {
  const { data, error } = await supabase.rpc('get_billing_status');
  if (error || !data || data.length === 0) return null;
  const r = data[0] as Record<string, unknown>;
  return {
    planId: r.plan_id as string, planName: r.plan_name as string,
    status: r.status as BillingStatus['status'], effective: r.effective as BillingStatus['effective'],
    trialEndsAt: (r.trial_ends_at as string | null) ?? undefined,
    currentPeriodEnd: (r.current_period_end as string | null) ?? undefined,
    maxEmployees: (r.max_employees as number | null) ?? undefined,
    employeeCount: Number(r.employee_count), canAddEmployees: r.can_add_employees as boolean,
  };
}

export async function getMyIp(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_ip');
  return error ? null : (data as string | null);
}
/** true when the organization has no network restriction or this connection is allowed. Fails open on error (the database still enforces). */
export async function canClockHere(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_clock_here');
  return error ? true : data === true;
}
export async function getClockPolicy(): Promise<{ enabled: boolean; ips: string[] } | null> {
  const { data, error } = await supabase.rpc('get_clock_policy');
  if (error || !data || data.length === 0) return null;
  return { enabled: data[0].enabled as boolean, ips: (data[0].ips as string[]) ?? [] };
}
export async function setClockPolicy(enabled: boolean, ips: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_clock_policy', { p_enabled: enabled, p_ips: ips });
  if (error) throw error;
}

function toDepartment(r: Record<string, unknown>): Department {
  return { id: r.id as string, name: r.name as string, managerEmployeeId: (r.manager_employee_id as string | null) ?? undefined };
}
/** Returns [] if the departments table is not available yet. */
export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) return [];
  return (data ?? []).map(toDepartment);
}
export async function addDepartment(name: string): Promise<void> {
  const { error } = await supabase.from('departments').insert({ name: name.trim() });
  if (error) throw error;
}
export async function updateDepartment(id: string, updates: { name?: string; managerEmployeeId?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name.trim();
  if (updates.managerEmployeeId !== undefined) row.manager_employee_id = updates.managerEmployeeId;
  const { error } = await supabase.from('departments').update(row).eq('id', id);
  if (error) throw error;
}
export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw error;
}
/** Company directory without pay data (managers and directors). Falls back to [] if unavailable. */
export async function getDirectory(): Promise<{ id: string; name: string; departmentId?: string; role: Employee['role'] }[]> {
  const { data, error } = await supabase.from('employee_directory').select('*').order('name');
  if (error) return [];
  return (data ?? []).map(r => ({ id: r.id as string, name: r.name as string, departmentId: (r.department_id as string | null) ?? undefined, role: r.role as Employee['role'] }));
}
