import React, { useState, useMemo } from 'react';
import { store } from '@/lib/store';
import { Employee } from '@/types/workforce';
import { calculateDailySummary, calculatePayroll, getCurrentPeriod, formatCurrency, formatHours, formatDate } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, DollarSign, Download, PlusCircle, Edit, FileText, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  const employees = store.getEmployees();
  const period = getCurrentPeriod();
  const timeEntries = store.getTimeEntries();
  const leaveRequests = store.getLeaveRequests();

  const payrolls = useMemo(() => {
    return employees.map(emp => {
      const empEntries = timeEntries.filter(e => e.employeeId === emp.id);
      const dates = [...new Set(empEntries.filter(e => e.date.startsWith(period)).map(e => e.date))];
      const summaries = dates.map(d => calculateDailySummary(empEntries, emp.id, d));
      return calculatePayroll(emp, summaries, leaveRequests, period);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, employees.length]);

  const totalPayroll = payrolls.reduce((s, p) => s + p.netPay, 0);
  const totalHours = payrolls.reduce((s, p) => s + p.totalWorkHours, 0);

  const pendingLeaves = leaveRequests.filter(lr => lr.status === 'pending');

  const exportCSV = () => {
    const headers = ['Employee', 'Work Hours', 'Hourly Rate', 'Gross Pay', 'Paid Leave ($)', 'Unpaid Deduction ($)', 'Net Pay'];
    const rows = payrolls.map(p => [p.employeeName, p.totalWorkHours.toFixed(4), p.hourlyRate.toFixed(4), p.grossPay.toFixed(2), p.paidLeaveAmount.toFixed(2), p.unpaidLeaveDeduction.toFixed(2), p.netPay.toFixed(2)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approveLeave = (id: string) => {
    store.updateLeaveRequest(id, { status: 'approved' });
    refresh();
  };
  const rejectLeave = (id: string) => {
    store.updateLeaveRequest(id, { status: 'rejected' });
    refresh();
  };

  return (
    <div className="space-y-6 animate-fade-in" key={refreshKey}>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Employees</p>
              <p className="text-2xl font-bold text-foreground">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Hours ({period})</p>
              <p className="text-2xl font-bold text-foreground">{formatHours(totalHours)}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payroll</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPayroll)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll table */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Payroll Report — {period}
          </h3>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Paid Leave</TableHead>
                <TableHead className="text-right">Unpaid Ded.</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.map(p => (
                <TableRow key={p.employeeId}>
                  <TableCell className="font-medium">{p.employeeName}</TableCell>
                  <TableCell className="text-right font-mono">{formatHours(p.totalWorkHours)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(p.hourlyRate)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(p.grossPay)}</TableCell>
                  <TableCell className="text-right font-mono text-success">+{formatCurrency(p.paidLeaveAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">-{formatCurrency(p.unpaidLeaveDeduction)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(p.netPay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pending leave requests */}
      {pendingLeaves.length > 0 && (
        <div className="stat-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">Pending Leave Requests</h3>
          <div className="space-y-3">
            {pendingLeaves.map(lr => {
              const emp = employees.find(e => e.id === lr.employeeId);
              return (
                <div key={lr.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">{emp?.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{lr.category} · {lr.hours}h · {formatDate(lr.startDate)}</p>
                    {lr.unpaidHours > 0 && <p className="text-xs text-warning">{lr.unpaidHours}h unpaid</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="clockIn" onClick={() => approveLeave(lr.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectLeave(lr.id)}>Reject</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employee management */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Employee Contracts
          </h3>
          <AddEmployeeDialog onAdd={refresh} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">PTO Limit</TableHead>
                <TableHead className="text-right">Vac. Accrual</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(emp.hourlyRate)}</TableCell>
                  <TableCell className="text-right">{emp.paidPtoLimitHours}h</TableCell>
                  <TableCell className="text-right">{emp.vacationAccrualRate}d/mo</TableCell>
                  <TableCell>{formatDate(emp.hireDate)}</TableCell>
                  <TableCell>
                    <EditEmployeeDialog employee={emp} onSave={refresh} />
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
  const [form, setForm] = useState({ name: '', email: '', department: '', hourlyRate: '', paidPtoLimitHours: '', vacationAccrualRate: '', hireDate: '' });

  const handleSubmit = () => {
    const emp: Employee = {
      id: `emp-${crypto.randomUUID().slice(0, 8)}`,
      name: form.name,
      email: form.email,
      role: 'employee',
      hourlyRate: parseFloat(form.hourlyRate) || 0,
      vacationAccrualRate: parseFloat(form.vacationAccrualRate) || 1.25,
      paidPtoLimitHours: parseFloat(form.paidPtoLimitHours) || 80,
      hireDate: form.hireDate || new Date().toISOString().split('T')[0],
      department: form.department,
    };
    store.addEmployee(emp);
    setOpen(false);
    setForm({ name: '', email: '', department: '', hourlyRate: '', paidPtoLimitHours: '', vacationAccrualRate: '', hireDate: '' });
    onAdd();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusCircle className="h-4 w-4" /> Add Employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Hourly Rate ($)</Label><Input type="number" step="0.01" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} /></div>
            <div><Label>PTO Limit (hrs/yr)</Label><Input type="number" value={form.paidPtoLimitHours} onChange={e => setForm(f => ({ ...f, paidPtoLimitHours: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vac. Accrual (days/mo)</Label><Input type="number" step="0.25" value={form.vacationAccrualRate} onChange={e => setForm(f => ({ ...f, vacationAccrualRate: e.target.value }))} /></div>
            <div><Label>Hire Date</Label><Input type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} /></div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!form.name || !form.email}>Add Employee</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ employee, onSave }: { employee: Employee; onSave: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    hourlyRate: String(employee.hourlyRate),
    paidPtoLimitHours: String(employee.paidPtoLimitHours),
    vacationAccrualRate: String(employee.vacationAccrualRate),
    department: employee.department,
  });

  const handleSubmit = () => {
    store.updateEmployee(employee.id, {
      hourlyRate: parseFloat(form.hourlyRate) || employee.hourlyRate,
      paidPtoLimitHours: parseFloat(form.paidPtoLimitHours) || employee.paidPtoLimitHours,
      vacationAccrualRate: parseFloat(form.vacationAccrualRate) || employee.vacationAccrualRate,
      department: form.department,
    });
    setOpen(false);
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit — {employee.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
          <div><Label>Hourly Rate ($)</Label><Input type="number" step="0.01" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} /></div>
          <div><Label>PTO Limit (hrs/yr)</Label><Input type="number" value={form.paidPtoLimitHours} onChange={e => setForm(f => ({ ...f, paidPtoLimitHours: e.target.value }))} /></div>
          <div><Label>Vac. Accrual (days/mo)</Label><Input type="number" step="0.25" value={form.vacationAccrualRate} onChange={e => setForm(f => ({ ...f, vacationAccrualRate: e.target.value }))} /></div>
          <Button className="w-full" onClick={handleSubmit}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
