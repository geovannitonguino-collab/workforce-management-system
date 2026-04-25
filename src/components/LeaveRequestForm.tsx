import React, { useState, useEffect } from 'react';
import { Employee, LeaveCategory, LeaveRequest, LeaveBalance } from '@/types/workforce';
import { getLeaveRequests, addLeaveRequest, getMedicalProofs } from '@/lib/store';
import { calculateLeaveBalance, calculateLeaveRequestPaidStatus, canRequestVacation } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import MedicalProofManager from '@/components/MedicalProofManager';
import { CalendarPlus, AlertTriangle, ShieldAlert, Info, Stethoscope, Loader2 } from 'lucide-react';

interface Props { employee: Employee; onSubmit?: () => void; }

export default function LeaveRequestForm({ employee, onSubmit }: Props) {
  const [category, setCategory] = useState<LeaveCategory>('pto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [usesPtoBalance, setUsesPtoBalance] = useState(false);
  // Bug fix #10: fresh draftId per request session
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [proofsUploaded, setProofsUploaded] = useState(0);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [saving, setSaving] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    (async () => {
      const reqs = await getLeaveRequests(employee.id);
      setBalance(calculateLeaveBalance(employee, reqs, year));
    })();
  }, [employee, year]);

  const hoursNum = parseFloat(hours) || 0;
  const requestedDays = hoursNum / 8;

  // Bug fix #2: >= 2 days requires medical proof (not > 2)
  const isSickMultiDay = category === 'sick' && requestedDays >= 2;
  const sickProofRequired = isSickMultiDay && proofsUploaded === 0;

  const vacationError = balance && category === 'vacation' && hoursNum > 0 && !canRequestVacation(balance, requestedDays)
    ? `Insufficient vacation balance. You have ${balance.remainingVacationDays.toFixed(2)} days available.` : null;

  const preview = balance && hoursNum > 0 && !vacationError
    ? calculateLeaveRequestPaidStatus({ category, hours: hoursNum, usesPtoBalance }, balance) : null;

  const canSubmit = startDate && endDate && hoursNum > 0 && !vacationError && !sickProofRequired && !saving && balance;

  const handleProofUpdate = async () => {
    const proofs = await getMedicalProofs(draftId);
    setProofsUploaded(proofs.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !balance) return;
    setSaving(true);
    try {
      const paidStatus = calculateLeaveRequestPaidStatus({ category, hours: hoursNum, usesPtoBalance }, balance);
      await addLeaveRequest({
        id: draftId, employeeId: employee.id, category,
        startDate, endDate, hours: hoursNum,
        isPaid: paidStatus.isPaid, unpaidHours: paidStatus.unpaidHours,
        status: 'pending', reason, usesPtoBalance: category === 'personal' ? usesPtoBalance : undefined,
        createdAt: new Date().toISOString(),
      });
      // Reset form + generate fresh draftId for next request
      setCategory('pto'); setStartDate(''); setEndDate('');
      setHours(''); setReason(''); setUsesPtoBalance(false);
      setProofsUploaded(0);
      setDraftId(crypto.randomUUID()); // Bug fix #10

      // Refresh balance
      const reqs = await getLeaveRequests(employee.id);
      setBalance(calculateLeaveBalance(employee, reqs, year));
      onSubmit?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <CalendarPlus className="h-5 w-5 text-primary" /> Request Leave
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={v => { setCategory(v as LeaveCategory); setUsesPtoBalance(false); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pto">PTO (max 5 days/year)</SelectItem>
              <SelectItem value="sick">Sick Leave</SelectItem>
              <SelectItem value="vacation">Vacation (from accrued balance)</SelectItem>
              <SelectItem value="personal">Personal Issues</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {category === 'pto' && balance && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-primary/10">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              PTO limit: <strong>5 days (40h)/year</strong>. Used: {balance.usedPaidPtoHours.toFixed(1)}h.
              Remaining: <strong>{balance.remainingPaidPtoHours.toFixed(1)}h</strong>. Days beyond 5 are automatically <strong>unpaid</strong>.
            </p>
          </div>
        )}

        {category === 'vacation' && balance && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-primary/10">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              Accrued: <strong>{balance.accruedVacationDays.toFixed(2)} days</strong>.
              Available: <strong>{balance.remainingVacationDays.toFixed(2)} days</strong>.
            </p>
          </div>
        )}

        {category === 'personal' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <ShieldAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm">Personal leave is <strong>unpaid by default</strong>. You may opt to use PTO balance.</p>
          </div>
        )}

        {category === 'sick' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-primary/10">
            <Stethoscope className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              1 day: no proof required. <strong>2+ consecutive days</strong>: medical certificate <strong>mandatory</strong>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>

        <div>
          <Label>Hours</Label>
          <Input type="number" step="0.5" min="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 8 (1 day = 8h)" />
          {hoursNum > 0 && <p className="text-xs text-muted-foreground mt-1">{requestedDays.toFixed(1)} day(s)</p>}
        </div>

        {category === 'personal' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <Label htmlFor="use-pto" className="text-sm cursor-pointer">Use PTO balance instead?</Label>
            <Switch id="use-pto" checked={usesPtoBalance} onCheckedChange={setUsesPtoBalance} />
          </div>
        )}

        {category === 'sick' && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5" />
              Medical Proof
              {isSickMultiDay
                ? <span className="text-destructive font-semibold">(Required — 2+ days)</span>
                : <span className="text-muted-foreground">(Optional for 1 day)</span>}
            </Label>
            <MedicalProofManager leaveRequestId={draftId} onUpdate={handleProofUpdate} />
            {sickProofRequired && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive font-medium">Upload a medical certificate to proceed.</p>
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Reason</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief description..." rows={2} />
        </div>

        {vacationError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive font-medium">{vacationError}</p>
          </div>
        )}

        {preview && preview.unpaidHours > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm">
              <strong>{preview.unpaidHours.toFixed(1)}h</strong> will be <strong>unpaid</strong>.
              Deduction: <strong>${(preview.unpaidHours * employee.hourlyRate).toFixed(2)}</strong>
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Submit Request
        </Button>
      </form>
    </div>
  );
}
