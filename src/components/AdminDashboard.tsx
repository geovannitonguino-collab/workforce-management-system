import React, { useState, useEffect, useCallback } from 'react';
import { getEmployees, getLeaveRequests, updateLeaveRequest, addEmployee, updateEmployee, getDepartments } from '@/lib/store';
import { Employee, LeaveRequest, Department, isDirectorRole, roleLabel } from '@/types/workforce';
import { getToday, formatDate } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AdminCorrections from '@/components/AdminCorrections';
import BillingBanner from '@/components/BillingBanner';
import OrgStructure from '@/components/OrgStructure';
import CompanyOverview from '@/components/CompanyOverview';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ContractDialog from '@/components/ContractDialog';
import PayrollPanel from '@/components/PayrollPanel';
import CompanyCalendar from '@/components/CompanyCalendar';
import { Users, DollarSign, Download, PlusCircle, Edit, FileText, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Props { currentEmployee?: Employee; onEmployeeChange?: () => void; }

export default function AdminDashboard({ currentEmployee, onEmployeeChange }: Props) {
  const isDirector = isDirectorRole(currentEmployee?.role);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contractFor, setContractFor] = useState<Employee | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, leaveRequests, depts] = await Promise.all([getEmployees(), getLeaveRequests(), getDepartments()]);
      setEmployees(emps);
      setDepartments(depts);
      // A manager can only act on their own team (and never on their own request); directors act on everyone.
      const teamIds = new Set(emps.map(e => e.id));
      setPending(leaveRequests.filter(lr => lr.status === 'pending'
        && (isDirector || (teamIds.has(lr.employeeId) && lr.employeeId !== currentEmployee?.id))));
    } finally { setLoading(false); }
  }, [isDirector, currentEmployee?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const approve = async (id: string) => { await updateLeaveRequest(id, { status: 'approved' }); await loadAll(); };
  const reject  = async (id: string) => { await updateLeaveRequest(id, { status: 'rejected' }); await loadAll(); };

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" /><span>Loading admin data…</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', label: 'People', value: String(employees.length),
            sub: isDirector ? `${employees.filter(e => isDirectorRole(e.role)).length} director · ${employees.filter(e => e.role === 'manager').length} manager` : 'your team' },
          { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending leave approvals', value: String(pending.length), sub: pending.length ? 'waiting for you' : 'all clear' },
        ].map(({ icon: Icon, color, bg, label, value, sub }) => (
          <div key={label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
                <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isDirector && <BillingBanner key={employees.length} />}

      {isDirector && <CompanyCalendar />}

      {isDirector && <OrgStructure employees={employees} departments={departments} onChange={async () => { await loadAll(); onEmployeeChange?.(); }} />}

      {!isDirector && <CompanyOverview teamIds={employees.map(e => e.id)} departments={departments} />}

      <AdminCorrections employees={employees} onResolved={loadAll} showAudit={isDirector} />

      {/* Pending leave approvals */}
      {pending.length > 0 && (
        <div className="stat-card border-amber-200 bg-amber-50/40">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">Pending Approvals</h3>
            <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
              {pending.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(lr => {
              const emp = employees.find(e => e.id === lr.employeeId);
              return (
                <div key={lr.id} className="flex items-center justify-between bg-white border border-amber-100 rounded-xl p-3.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{emp?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize font-medium">{lr.category}</span>
                      <span>·</span><span>{lr.hours}h</span>
                      <span>·</span><span>{formatDate(lr.startDate)}</span>
                      {lr.unpaidHours > 0 && <span className="text-destructive font-medium">{lr.unpaidHours}h unpaid</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => approve(lr.id)}
                      className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject(lr.id)}
                      className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PayrollPanel employees={employees} currentEmployee={currentEmployee} isDirector={isDirector}
        onOpenContract={setContractFor} reloadKey={reloadKey} />

      {/* Employee contracts */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> People
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{employees.length} members</p>
          </div>
          <AddEmployeeDialog currentEmployee={currentEmployee} departments={departments} onAdd={async (created) => { await loadAll(); onEmployeeChange?.(); if (created) setContractFor(created); }} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {['Name','Department','Hired','Role',''].map(h => (
                  <TableHead key={h} className="font-semibold text-xs">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div><p className="text-sm font-medium">{emp.name}</p><p className="text-xs text-muted-foreground">{emp.email}</p>{emp.personalEmail && <p className="text-[11px] text-muted-foreground/80">Personal: {emp.personalEmail}</p>}</div>
                  </TableCell>
                  <TableCell className="text-sm">{departments.find(d => d.id === emp.departmentId)?.name ?? emp.department}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(emp.hireDate)}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDirectorRole(emp.role) ? 'bg-amber-50 text-amber-700' : emp.role === 'manager' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                      {roleLabel(emp.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(isDirector || emp.id !== currentEmployee?.id) && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" title="Contract, pay and time off" onClick={() => setContractFor(emp)}>
                          <FileText className="h-3.5 w-3.5" /> Contract
                        </Button>
                        <EditEmployeeDialog employee={emp} isDirector={isDirector} onSave={async () => { await loadAll(); onEmployeeChange?.(); }} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ContractDialog employee={contractFor} canEdit={!!contractFor && (isDirector || contractFor.id !== currentEmployee?.id)}
        onClose={() => setContractFor(null)} onSaved={() => { setReloadKey(k => k + 1); onEmployeeChange?.(); }} />
    </div>
  );
}

function AddEmployeeDialog({ onAdd, currentEmployee, departments }: { onAdd: (created?: Employee) => void; currentEmployee?: Employee; departments: Department[] }) {
  const isDirector = isDirectorRole(currentEmployee?.role);
  // a manager can only place new people in the departments they head
  const allowed = isDirector ? departments : departments.filter(d => d.managerEmployeeId === currentEmployee?.id);
  const [deptId, setDeptId] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name:'', email:'', personalEmail:'', department:'', hireDate:'' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      // Bug fix #4: correct defaults — 0.416 days/mo and 40h PTO
      const created = await addEmployee({
        name: f.name, email: f.email, personalEmail: f.personalEmail.trim() || undefined, role: 'employee',
        // pay, vacation and PTO now live in the contract (opened right after saving)
        hourlyRate: 0, vacationAccrualRate: 0, paidPtoLimitHours: 0,
        hireDate: f.hireDate || getToday(),
        department: allowed.find(d => d.id === deptId)?.name ?? f.department,
        departmentId: deptId || undefined,
      });
      setOpen(false);
      setDeptId('');
      setF({ name:'', email:'', personalEmail:'', department:'', hireDate:'' });
      onAdd(created);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? '');
      setErr(msg.includes('billing:') ? 'Your plan does not allow adding more employees (limit reached or subscription inactive). Contact contacto@geovannix.com.' : 'Could not add the employee. Check the data and try again.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5" /> Add Employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Full Name</Label><Input value={f.name} onChange={set('name')} placeholder="e.g. María García" /></div>
            <div className="col-span-2"><Label>Corporate email (sign-in)</Label><Input value={f.email} onChange={set('email')} placeholder="maria@company.com" /></div>
            <div className="col-span-2"><Label>Personal email (HR contact, optional)</Label><Input type="email" value={f.personalEmail} onChange={set('personalEmail')} placeholder="maria.personal@gmail.com" /></div>
            <div>
              <Label>Department</Label>
              {departments.length > 0 ? (
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{allowed.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={f.department} onChange={set('department')} placeholder="Engineering" />
              )}
            </div>
            <div><Label>Hire Date</Label><Input type="date" value={f.hireDate} onChange={set('hireDate')} /></div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="w-full" onClick={submit} disabled={!f.name || !f.email || saving || (departments.length > 0 && !deptId)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add and set up contract
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ employee, onSave, isDirector }: { employee: Employee; onSave: () => void; isDirector: boolean }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    hourlyRate: String(employee.hourlyRate), paidPtoLimitHours: String(employee.paidPtoLimitHours),
    vacationAccrualRate: String(employee.vacationAccrualRate), department: employee.department,
    email: employee.email, personalEmail: employee.personalEmail ?? '',
  });
  const currentRole: 'director' | 'manager' | 'employee' = isDirectorRole(employee.role) ? 'director' : employee.role;
  const [role, setRole] = useState<'director' | 'manager' | 'employee'>(currentRole);
  const [err, setErr] = useState<string | null>(null);

  // Bug fix #7: reset form state whenever the dialog opens (or the employee prop
  // changes while open). The dialog wrapper never unmounts on close, so without this
  // reopening it kept showing whatever was last typed (including unsaved edits).
  useEffect(() => {
    if (!open) return;
    setF({
      hourlyRate: String(employee.hourlyRate), paidPtoLimitHours: String(employee.paidPtoLimitHours),
      vacationAccrualRate: String(employee.vacationAccrualRate), department: employee.department,
      email: employee.email, personalEmail: employee.personalEmail ?? '',
    });
    setRole(isDirectorRole(employee.role) ? 'director' : employee.role);
    setErr(null);
  }, [open, employee]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await updateEmployee(employee.id, {
        ...(isDirector && !employee.departmentId ? { department: f.department } : {}),
        ...(isDirector && f.email.trim() && f.email.trim().toLowerCase() !== employee.email.toLowerCase() ? { email: f.email.trim() } : {}),
        ...(f.personalEmail.trim() !== (employee.personalEmail ?? '') ? { personalEmail: f.personalEmail.trim() } : {}),
        ...(role !== currentRole ? { role } : {}),
      });
      setOpen(false); onSave();
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      setErr(
        m.includes('at least one director') ? 'The organization must keep at least one director.'
        : m.includes('only set the role') ? 'A manager can only set the role to Employee or Manager.'
        : m.includes('personal_email_format') ? 'The personal email is not valid.'
        : m.includes('duplicate') || m.includes('uniq') ? 'Another person in the company already uses that email.'
        : 'Could not save the change.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Edit className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit — {employee.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          {isDirector && !employee.departmentId && <div><Label>Department</Label><Input value={f.department} onChange={set('department')} /></div>}
          <div>
            <Label>Corporate email (sign-in)</Label>
            <Input type="email" value={f.email} onChange={set('email')} disabled={!isDirector} />
            <p className="text-xs text-muted-foreground mt-1">
              {isDirector
                ? (employee.userId ? 'This person already has a login; changing this does not change the email they sign in with.' : 'Used to create their login.')
                : 'Only a director can change the corporate email.'}
            </p>
          </div>
          <div>
            <Label>Personal email (HR contact)</Label>
            <Input type="email" value={f.personalEmail} onChange={set('personalEmail')} placeholder="For emergencies and hiring communications" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {isDirector && <SelectItem value="director">Director</SelectItem>}
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Pay, vacation and PTO are edited in the person's <strong>Contract</strong>.</p>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
