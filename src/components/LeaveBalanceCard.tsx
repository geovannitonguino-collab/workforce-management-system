import React from 'react';
import { Employee } from '@/types/workforce';
import { calculateLeaveBalance } from '@/lib/calculations';
import { store } from '@/lib/store';
import { CalendarDays, Clock, Umbrella, RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  employee: Employee;
}

export default function LeaveBalanceCard({ employee }: Props) {
  const year = new Date().getFullYear();
  const balance = calculateLeaveBalance(employee, store.getLeaveRequests(), year);

  const ptoPercent = balance.totalPaidPtoHours > 0
    ? Math.min(100, (balance.usedPaidPtoHours / balance.totalPaidPtoHours) * 100)
    : 0;

  const vacPercent = balance.accruedVacationDays > 0
    ? Math.min(100, (balance.usedVacationDays / balance.accruedVacationDays) * 100)
    : 0;

  return (
    <div className="stat-card space-y-5">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Umbrella className="h-5 w-5 text-primary" />
        Leave Balances — {year}
      </h3>

      <div className="space-y-4">
        {/* PTO */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-secondary" /> Paid PTO
            </span>
            <span className="text-sm text-muted-foreground">
              {balance.usedPaidPtoHours.toFixed(1)} / {balance.totalPaidPtoHours}h used
            </span>
          </div>
          <Progress value={ptoPercent} className="h-2" />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              {balance.remainingPaidPtoHours.toFixed(1)}h remaining ({(balance.remainingPaidPtoHours / 8).toFixed(1)} days)
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Resets Jan 1
            </p>
          </div>
        </div>

        {/* Vacation Accrual */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-secondary" /> Vacation Accrued
            </span>
            <span className="text-sm text-muted-foreground">
              {balance.usedVacationDays.toFixed(2)} / {balance.accruedVacationDays.toFixed(2)} days used
            </span>
          </div>
          <Progress value={vacPercent} className="h-2" />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              {balance.remainingVacationDays.toFixed(2)} days available
            </p>
            <p className="text-xs text-muted-foreground">
              +0.416 days/month
            </p>
          </div>
        </div>

        {/* Formula explanation */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accrual Formula</p>
          <p className="text-xs text-muted-foreground">
            Vacation = Months employed × 0.416 = {balance.accruedVacationDays.toFixed(2)} days earned
          </p>
          <p className="text-xs text-muted-foreground">
            PTO = 5 days/year (40h) · No rollover
          </p>
        </div>
      </div>
    </div>
  );
}
