import React, { useState, useEffect, useCallback } from 'react';
import { getEmployees, getTimeEntries, getLeaveRequests, updateLeaveRequest, addEmployee, updateEmployee } from '@/lib/store';
import { Employee, LeaveRequest } from '@/types/workforce';
import { calculateDailySummary, calculatePayroll, getCurrentPeriod, formatCurrency, formatHours, formatDate } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, DollarSign, Download, PlusCircle, Edit, FileText, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Props { onEmployeeChange?: () => void; }

export default function AdminDashboard({ onEmployeeChange }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<ReturnType<typeof calculatePayroll>[]>([]);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const period = getCurrentPeriod();

  // Bug fix #3: reload all data reactively — timeEntries included in deps
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, timeEntries, leaveRequests] = await Promise.all([
        getEmployees(), getTimeEntries(), getLeaveRequests(),
      ]);
      setEmployees(emps);
      setPending(leaveRequests.filter(lr => lr.status === 'pending'));
      setPayrolls(emps.map(emp => {
        const empEntries = timeEntries.filter(e => e.employeeId === emp.id);
        const dates = [...new Set(empEntries.filter(e => e.date.startsWith(period)).map(e => e.date))];
        return calculatePayroll(emp, dates.map(d => calculateDailySummary(empEntries, emp.id, d)), leaveRequests, period);
      }));
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const approve = async (id: string) => { await updateLeaveRequest(id, { status: 'approved' }); await loadAll(); };
  const reject  = async (id: string) => { await updateLeaveRequest(id, { status: 'rejected' }); await loadAll(); };

  const totalPayroll = payrolls.reduce((s, p) => s + p.netPay, 0);
  const totalHours   = payrolls.reduce((s, p) => s + p.totalWorkHours, 0);

  const exportCSV = () => {
    const csv = [
      ['Employee','Hours','Rate','Gross','Paid Leave','Unpaid','Net'].join(','),
      ...payrolls.map(p => [p.employeeName, p.totalWorkHours.toFixed(2), p.hourlyRate.toFixed(2),
        p.grossPay.toFixed(2), p.paidLeaveAmount.toFixed(2), p.unpaidLeaveDeduction.toFixed(2), p.netPay.toFixed(2)].join(','))
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `payroll-${period}.csv`,
    });
    a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" /><span>Loading admin data…</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Employees', value: String(employees.length), sub: `${employees.filter(e=>e.role==='admin').length} admin` },
          { icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-50', label: `Hours — ${period}`, value: formatHours(totalHours), sub: `avg ${employees.length ? (totalHours/employees.length).toFixed(1) : 0}h/person` },
          { icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', label: 'Total Payroll', value: formatCurrency(totalPayroll), sub: period },
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

      {/* Payroll report */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Payroll Report
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{period}</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 h-8 text-xs">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {['Employee','Hours','Rate/hr','Gross','Leave+','Unpaid−','Net Pay'].map(h => (
                  <TableHead key={h} className={`font-semibold text-xs ${h !== 'Employee' ? 'text-right' : ''}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.map(p => (
                <TableRow key={p.employeeId} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{p.employeeName}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatHours(p.totalWorkHours)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(p.hourlyRate)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(p.grossPay)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 font-semibold">+{formatCurrency(p.paidLeaveAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-500 font-semibold">−{formatCurrency(p.unpaidLeaveDeduction)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(p.netPay)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/4 border-t-2 border-primary/20">
                <TableCell colSpan={6} className="text-right text-sm font-bold text-muted-foreground pr-4">Total</TableCell>
                <TableCell className="text-right text-xl font-bold text-primary">{formatCurrency(totalPayroll)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Employee contracts */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Employee Contracts
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{employees.length} members</p>
          </div>
          <AddEmployeeDialog onAdd={async () => { await loadAll(); onEmployeeChange?.(); }} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {['Name','Department','Rate','PTO','Accrual','Hired','Role',''].map(h => (
                  <TableHead key={h} className="font-semibold text-xs">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div><p className="text-sm font-medium">{emp.name}</p><p className="text-xs text-muted-foreground">{emp.email}</p></div>
                  </TableCell>
                  <TableCell className="text-sm">{emp.department}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-primary">{formatCurrency(emp.hourlyRate)}</TableCell>
                  <TableCell className="text-sm">{emp.paidPtoLimitHours}h</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.vacationAccrualRate}d/mo</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(emp.hireDate)}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${emp.role === 'admin' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      {emp.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <EditEmployeeDialog employee={emp} onSave={async () => { await loadAll(); onEmployeeChange?.(); }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function AddEmployeeDialog({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name:'', email:'', department:'', hourlyRate:'', paidPtoLimitHours:'', vacationAccrualRate:'', hireDate:'' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      // Bug fix #4: correct defaults — 0.416 days/mo and 40h PTO
      await addEmployee({
        name: f.name, email: f.email, role: 'employee',
        hourlyRate: parseFloat(f.hourlyRate) || 0,
        vacationAccrualRate: parseFloat(f.vacationAccrualRate) || 0.416,
        paidPtoLimitHours: parseFloat(f.paidPtoLimitHours) || 40,
        hireDate: f.hireDate || new Date().toISOString().split('T')[0],
        department: f.department,
      });
      setOpen(false);
      setF({ name:'', email:'', department:'', hourlyRate:'', paidPtoLimitHours:'', vacationAccrualRate:'', hireDate:'' });
      onAdd();
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
            <div className="col-span-2"><Label>Email</Label><Input value={f.email} onChange={set('email')} placeholder="maria@company.com" /></div>
            <div><Label>Department</Label><Input value={f.department} onChange={set('department')} placeholder="Engineering" /></div>
            <div><Label>Hire Date</Label><Input type="date" value={f.hireDate} onChange={set('hireDate')} /></div>
            <div><Label>Hourly Rate ($)</Label><Input type="number" step="0.01" value={f.hourlyRate} onChange={set('hourlyRate')} placeholder="35.00" /></div>
            <div><Label>PTO Limit (hrs/yr)</Label><Input type="number" value={f.paidPtoLimitHours} onChange={set('paidPtoLimitHours')} placeholder="40" /></div>
            <div className="col-span-2"><Label>Vacation Accrual (days/month)</Label><Input type="number" step="0.001" value={f.vacationAccrualRate} onChange={set('vacationAccrualRate')} placeholder="0.416" /></div>
          </div>
          <Button className="w-full" onClick={submit} disabled={!f.name || !f.email || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Employee
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ employee, onSave }: { employee: Employee; onSave: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    hourlyRate: String(employee.hourlyRate), paidPtoLimitHours: String(employee.paidPtoLimitHours),
    vacationAccrualRate: String(employee.vacationAccrualRate), department: employee.department,
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      await updateEmployee(employee.id, {
        hourlyRate: parseFloat(f.hourlyRate) || employee.hourlyRate,
        paidPtoLimitHours: parseFloat(f.paidPtoLimitHours) || employee.paidPtoLimitHours,
        vacationAccrualRate: parseFloat(f.vacationAccrualRate) || employee.vacationAccrualRate,
        department: f.department,
      });
      setOpen(false); onSave();
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
          <div><Label>Department</Label><Input value={f.department} onChange={set('department')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Hourly Rate ($)</Label><Input type="number" step="0.01" value={f.hourlyRate} onChange={set('hourlyRate')} /></div>
            <div><Label>PTO Limit (hrs/yr)</Label><Input type="number" value={f.paidPtoLimitHours} onChange={set('paidPtoLimitHours')} /></div>
          </div>
          <div><Label>Vacation Accrual (days/month)</Label><Input type="number" step="0.001" value={f.vacationAccrualRate} onChange={set('vacationAccrualRate')} /></div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
