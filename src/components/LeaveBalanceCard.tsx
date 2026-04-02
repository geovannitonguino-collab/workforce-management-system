import React from 'react';
import { Employee } from '@/types/workforce';
import { calculateLeaveBalance } from '@/lib/calculations';
import { store } from '@/lib/store';
import { CalendarDays, Clock, Umbrella } from 'lucide-react';
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
        Leave Balances
      </h3>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-secondary" /> Paid PTO
            </span>
            <span className="text-sm text-muted-foreground">
              {balance.usedPaidPtoHours.toFixed(1)} / {balance.totalPaidPtoHours}h
            </span>
          </div>
          <Progress value={ptoPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {balance.remainingPaidPtoHours.toFixed(1)}h remaining
          </p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-secondary" /> Vacation Accrued
            </span>
            <span className="text-sm text-muted-foreground">
              {balance.usedVacationDays.toFixed(1)} / {balance.accruedVacationDays.toFixed(1)}d
            </span>
          </div>
          <Progress value={vacPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {balance.remainingVacationDays.toFixed(1)} days available
          </p>
        </div>
      </div>
    </div>
  );
}
