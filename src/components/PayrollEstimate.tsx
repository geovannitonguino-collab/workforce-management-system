import React from 'react';
import { Employee } from '@/types/workforce';
import { store } from '@/lib/store';
import { calculateDailySummary, calculatePayroll, getCurrentPeriod, formatCurrency, formatHours } from '@/lib/calculations';
import { DollarSign, TrendingUp, Clock, CalendarCheck, ArrowRight } from 'lucide-react';

interface Props {
  employee: Employee;
}

export default function PayrollEstimate({ employee }: Props) {
  const period = getCurrentPeriod();
  const entries = store.getTimeEntries().filter(e => e.employeeId === employee.id);
  const dates = [...new Set(entries.filter(e => e.date.startsWith(period)).map(e => e.date))];
  const summaries = dates.map(d => calculateDailySummary(entries, employee.id, d));
  const leaveRequests = store.getLeaveRequests();
  const payroll = calculatePayroll(employee, summaries, leaveRequests, period);

  return (
    <div className="stat-card space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        Estimated Pay — {period}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Net Work Hours</p>
          <p className="text-2xl font-bold text-foreground">{formatHours(payroll.totalWorkHours)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Gross Pay</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(payroll.grossPay)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> Paid Leave (adj.)</p>
          <p className="text-lg font-semibold text-success">+{formatCurrency(payroll.paidLeaveAmount)}</p>
          <p className="text-xs text-muted-foreground">{formatHours(payroll.paidLeaveHours)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Unpaid Deduction</p>
          <p className="text-lg font-semibold text-destructive">-{formatCurrency(payroll.unpaidLeaveDeduction)}</p>
          <p className="text-xs text-muted-foreground">{formatHours(payroll.unpaidLeaveHours)}</p>
        </div>
      </div>

      <div className="border-t border-border pt-3 flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground">Final Net Pay</span>
        <span className="text-3xl font-bold text-primary">{formatCurrency(payroll.netPay)}</span>
      </div>

      {/* Formula breakdown */}
      <div className="p-3 rounded-lg bg-muted/50 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Formula</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
          Gross ({formatHours(payroll.totalWorkHours)} × {formatCurrency(payroll.hourlyRate)})
          <ArrowRight className="h-3 w-3" />
          + Paid Leave ({formatCurrency(payroll.paidLeaveAmount)})
          <ArrowRight className="h-3 w-3" />
          − Unpaid ({formatCurrency(payroll.unpaidLeaveDeduction)})
          <ArrowRight className="h-3 w-3" />
          = <strong>{formatCurrency(payroll.netPay)}</strong>
        </p>
      </div>

      <p className="text-xs text-muted-foreground">Rate: {formatCurrency(employee.hourlyRate)}/hr · Unpaid day deduction: {formatCurrency(employee.hourlyRate * 8)}/day</p>
    </div>
  );
}
