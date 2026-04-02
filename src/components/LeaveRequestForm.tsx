import React, { useState } from 'react';
import { Employee, LeaveCategory, LeaveRequest } from '@/types/workforce';
import { store } from '@/lib/store';
import { calculateLeaveBalance, calculateLeaveRequestPaidStatus, canRequestVacation } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import MedicalProofManager from '@/components/MedicalProofManager';
import { CalendarPlus, AlertTriangle, ShieldAlert, Info, Stethoscope } from 'lucide-react';

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
  const [usesPtoBalance, setUsesPtoBalance] = useState(false);
  // For sick leave: we create a "draft" leave request ID so proofs can be attached before submission
  const [draftId] = useState(() => crypto.randomUUID());
  const [proofsUploaded, setProofsUploaded] = useState(0);

  const year = new Date().getFullYear();
  const balance = calculateLeaveBalance(employee, store.getLeaveRequests(), year);

  const hoursNum = parseFloat(hours) || 0;
  const requestedDays = hoursNum / 8;

  // Sick leave > 2 days requires medical proof
  const isSickMultiDay = category === 'sick' && requestedDays > 2;
  const sickProofRequired = isSickMultiDay && proofsUploaded === 0;

  // Validation
  const vacationError = category === 'vacation' && hoursNum > 0 && !canRequestVacation(balance, requestedDays)
    ? `Insufficient vacation balance. You have ${balance.remainingVacationDays.toFixed(2)} days available.`
    : null;

  const preview = hoursNum > 0 && !vacationError
    ? calculateLeaveRequestPaidStatus({ category, hours: hoursNum, usesPtoBalance }, balance)
    : null;

  const canSubmit = startDate && endDate && hoursNum > 0 && !vacationError && !sickProofRequired;

  const handleProofUpdate = () => {
    const proofs = store.getMedicalProofsForRequest(draftId);
    setProofsUploaded(proofs.length);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const paidStatus = calculateLeaveRequestPaidStatus(
      { category, hours: hoursNum, usesPtoBalance },
      balance
    );

    // Collect medical proof IDs
    const proofs = store.getMedicalProofsForRequest(draftId);
    const proofIds = proofs.map(p => p.id);

    const request: LeaveRequest = {
      id: draftId,
      employeeId: employee.id,
      category,
      startDate,
      endDate,
      hours: hoursNum,
      isPaid: paidStatus.isPaid,
      unpaidHours: paidStatus.unpaidHours,
      status: 'pending',
      reason,
      usesPtoBalance: category === 'personal' ? usesPtoBalance : undefined,
      medicalProofIds: proofIds.length > 0 ? proofIds : undefined,
      createdAt: new Date().toISOString(),
    };

    store.addLeaveRequest(request);
    setCategory('pto');
    setStartDate('');
    setEndDate('');
    setHours('');
    setReason('');
    setUsesPtoBalance(false);
    setProofsUploaded(0);
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
          <Select value={category} onValueChange={(v) => { setCategory(v as LeaveCategory); setUsesPtoBalance(false); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pto">PTO (max 5 days/year)</SelectItem>
              <SelectItem value="sick">Sick Leave</SelectItem>
              <SelectItem value="vacation">Vacation (from accrued balance)</SelectItem>
              <SelectItem value="personal">Personal Issues</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category-specific info banners */}
        {category === 'pto' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-primary/10">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              PTO limit: <strong>5 days (40h)/year</strong>. Used: {balance.usedPaidPtoHours.toFixed(1)}h. Remaining: <strong>{balance.remainingPaidPtoHours.toFixed(1)}h</strong>. Days beyond 5 are automatically <strong>unpaid</strong>.
            </p>
          </div>
        )}

        {category === 'vacation' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-primary/10">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Accrued: <strong>{balance.accruedVacationDays.toFixed(2)} days</strong> (0.416/month). Available: <strong>{balance.remainingVacationDays.toFixed(2)} days</strong>. You can only request up to your available balance.
            </p>
          </div>
        )}

        {category === 'personal' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <ShieldAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Personal leave is <strong>unpaid by default</strong>. You may opt to use your PTO balance below.
            </p>
          </div>
        )}

        {category === 'sick' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-primary/10">
            <Stethoscope className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Sick leave of <strong>1 day</strong>: no proof required. For <strong>2+ consecutive days</strong>, a medical certificate (PDF) is <strong>mandatory</strong> to process payment.
            </p>
          </div>
        )}

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
          <Input type="number" step="0.5" min="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 8 (1 day = 8h)" />
          {hoursNum > 0 && <p className="text-xs text-muted-foreground mt-1">{requestedDays.toFixed(1)} day(s)</p>}
        </div>

        {/* Personal leave: opt-in to use PTO */}
        {category === 'personal' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <Label htmlFor="use-pto" className="text-sm cursor-pointer">Use PTO balance instead?</Label>
            <Switch id="use-pto" checked={usesPtoBalance} onCheckedChange={setUsesPtoBalance} />
          </div>
        )}

        {/* Sick leave: medical proof upload */}
        {category === 'sick' && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5" />
              Medical Proof {isSickMultiDay ? <span className="text-destructive font-semibold">(Required — more than 2 days)</span> : <span className="text-muted-foreground">(Optional for 1 day)</span>}
            </Label>
            <MedicalProofManager leaveRequestId={draftId} onUpdate={handleProofUpdate} />
            {sickProofRequired && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive font-medium">
                  Medical proof is required for sick leave exceeding 2 consecutive days. Please upload a PDF.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Reason</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief description..." rows={2} />
        </div>

        {/* Vacation validation error */}
        {vacationError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive font-medium">{vacationError}</p>
          </div>
        )}

        {/* Unpaid preview warning */}
        {preview && preview.unpaidHours > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              <strong>{preview.unpaidHours.toFixed(1)}h</strong> ({(preview.unpaidHours / 8).toFixed(1)} days) will be <strong>unpaid</strong>.
              Deduction: <strong>${(preview.unpaidHours * employee.hourlyRate).toFixed(2)}</strong>
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          Submit Request
        </Button>
      </form>
    </div>
  );
}
