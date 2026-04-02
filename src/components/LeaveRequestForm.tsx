import React, { useState } from 'react';
import { Employee, LeaveCategory, LeaveRequest } from '@/types/workforce';
import { store } from '@/lib/store';
import { calculateLeaveBalance, calculateLeaveRequestPaidStatus } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPlus, AlertTriangle } from 'lucide-react';

interface Props {
  employee: Employee;
  onSubmit?: () => void;
}

export default function LeaveRequestForm({ employee, onSubmit }: Props) {
  const [category, setCategory] = useState<LeaveCategory>('pto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');

  const balance = calculateLeaveBalance(employee, store.getLeaveRequests(), new Date().getFullYear());

  const hoursNum = parseFloat(hours) || 0;
  const preview = hoursNum > 0
    ? calculateLeaveRequestPaidStatus({ id: '', employeeId: employee.id, category, startDate, endDate, hours: hoursNum, status: 'pending', reason, createdAt: '' }, balance)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || hoursNum <= 0) return;

    const paidStatus = calculateLeaveRequestPaidStatus(
      { id: '', employeeId: employee.id, category, startDate, endDate, hours: hoursNum, status: 'pending', reason, createdAt: '' },
      balance
    );

    const request: LeaveRequest = {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      category,
      startDate,
      endDate,
      hours: hoursNum,
      isPaid: paidStatus.isPaid,
      unpaidHours: paidStatus.unpaidHours,
      status: 'pending',
      reason,
      createdAt: new Date().toISOString(),
    };

    store.addLeaveRequest(request);
    setCategory('pto');
    setStartDate('');
    setEndDate('');
    setHours('');
    setReason('');
    onSubmit?.();
  };

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <CalendarPlus className="h-5 w-5 text-primary" />
        Request Leave
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as LeaveCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pto">PTO</SelectItem>
              <SelectItem value="sick">Sick Leave</SelectItem>
              <SelectItem value="vacation">Vacation</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Hours</Label>
          <Input type="number" step="0.5" min="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 8" />
        </div>

        <div>
          <Label>Reason</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief description..." rows={2} />
        </div>

        {preview && preview.unpaidHours > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              <strong>{preview.unpaidHours.toFixed(1)}h</strong> will be <strong>unpaid</strong> (exceeds PTO balance). This will be deducted from salary.
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={!startDate || !endDate || hoursNum <= 0}>
          Submit Request
        </Button>
      </form>
    </div>
  );
}
