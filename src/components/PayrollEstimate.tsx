import React, { useEffect, useMemo, useState } from 'react';
import { Employee } from '@/types/workforce';
import { Period } from '@/types/contract';
import { getContracts, getHolidays, getLeaveRequests, getOrganizationName, getOrgSettings, getPayAdjustments, getTimeEntries } from '@/lib/store';
import { buildPayslipHtml, printHtml } from '@/lib/printDocs';
import { getToday } from '@/lib/calculations';
import { formatMoney, runPayroll } from '@/lib/payrollRun';
import { periodFor, periodLabel, shiftPeriod } from '@/lib/periods';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight, DollarSign, Loader2, Printer } from 'lucide-react';

interface Props { employee: Employee; }

/** The person's own estimated pay for a month, from their contract. */
export default function PayrollEstimate({ employee }: Props) {
  const [period, setPeriod] = useState<Period>(() => periodFor('month', getToday()));
  const [data, setData] = useState<Parameters<typeof runPayroll>[0] | null>(null);
  const [company, setCompany] = useState('');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [contracts, entries, leaves, adjustments, holidays, org, companyName] = await Promise.all([
        getContracts(employee.id), getTimeEntries(employee.id), getLeaveRequests(employee.id), getPayAdjustments(), getHolidays(), getOrgSettings(), getOrganizationName(),
      ]);
      if (!alive) return;
      setCompany(companyName ?? '');
      setData({
        employees: [employee], contracts, entries, leaves, adjustments: adjustments.filter(a => a.employeeId === employee.id),
        holidays: holidays.map(h => h.date), timeZone: org?.timeZone ?? 'UTC', period,
      });
    })();
    return () => { alive = false; };
  }, [employee.id, period.from, period.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useMemo(() => (data ? runPayroll({ ...data, period }) : null), [data, period]);

  const row = run?.rows[0];
  const res = row?.result;
  const m = (n: number) => formatMoney(n, res?.currency ?? 'USD');

  return (
    <div className="stat-card space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Estimated pay</h3>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod('month', period, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[9rem] text-center">{periodLabel(period)}</span>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="Next month" onClick={() => setPeriod(shiftPeriod('month', period, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {!run ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !res ? (
        <p className="text-sm text-muted-foreground">Your company has not set up your contract yet, so there is nothing to calculate.</p>
      ) : (
        <>
          <div className="rounded-xl border border-border/60 divide-y divide-border/60 text-sm">
            <div className="flex justify-between px-4 py-2"><span>Hours worked</span><span className="font-mono">{res.totalHours}</span></div>
            <div className="flex justify-between px-4 py-2"><span>Base pay</span><span className="font-mono">{m(res.pay.base)}</span></div>
            {res.pay.surcharges > 0 && <div className="flex justify-between px-4 py-2"><span>Night and holiday extras</span><span className="font-mono">{m(res.pay.surcharges)}</span></div>}
            {res.pay.overtime > 0 && <div className="flex justify-between px-4 py-2"><span>Overtime ({res.overtimeHours} h)</span><span className="font-mono">{m(res.pay.overtime)}</span></div>}
            {res.pay.paidLeave > 0 && <div className="flex justify-between px-4 py-2"><span>Paid time off</span><span className="font-mono">{m(res.pay.paidLeave)}</span></div>}
            {res.pay.unpaidDeduction > 0 && <div className="flex justify-between px-4 py-2"><span>Unpaid time off</span><span className="font-mono text-destructive">−{m(res.pay.unpaidDeduction)}</span></div>}
            {res.pay.commissions > 0 && <div className="flex justify-between px-4 py-2"><span>Commissions and bonuses</span><span className="font-mono">{m(res.pay.commissions)}</span></div>}
            {res.pay.reimbursements > 0 && <div className="flex justify-between px-4 py-2"><span>Expense refunds</span><span className="font-mono">{m(res.pay.reimbursements)}</span></div>}
            {res.pay.deductions > 0 && <div className="flex justify-between px-4 py-2"><span>Deductions</span><span className="font-mono text-destructive">−{m(res.pay.deductions)}</span></div>}
            {res.withheld > 0 && (
              <>
                <div className="flex justify-between px-4 py-2 bg-muted/40"><span className="font-semibold">Total before deductions</span><span className="font-mono">{m(res.gross)}</span></div>
                {res.deductionLines.filter(l => l.kind === 'deduction' && l.amount > 0).map(l => (
                  <div key={l.name} className="flex justify-between px-4 py-2"><span>{l.name}</span><span className="font-mono text-destructive">−{m(l.amount)}</span></div>
                ))}
              </>
            )}
            <div className="flex justify-between px-4 py-3 bg-primary/5"><span className="font-semibold">{res.withheld > 0 ? 'Estimated net pay' : 'Estimated total'}</span><span className="text-2xl font-bold text-primary">{m(res.net)}</span></div>
          </div>
          {res.warnings.map(w => (
            <p key={w} className="text-xs flex gap-1.5 text-foreground"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}</p>
          ))}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Estimate calculated from your contract. It is not a legal payroll document.</p>
            <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={() => setBlocked(!printHtml(buildPayslipHtml({ company, employee, period, result: res })))}>
              <Printer className="h-3.5 w-3.5" /> Print payslip
            </Button>
          </div>
          {blocked && <p className="text-xs text-destructive">Your browser blocked the print window. Allow pop-ups for this site and try again.</p>}
        </>
      )}
    </div>
  );
}
