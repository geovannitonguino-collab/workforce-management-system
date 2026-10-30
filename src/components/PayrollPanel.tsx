import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Employee } from '@/types/workforce';
import { AdjustmentKind, ContractRecord, HourKind, Period } from '@/types/contract';
import {
  addPayAdjustment, deletePayAdjustment, getContracts, getHolidays, getLeaveRequests, getOrgSettings, getPayAdjustments, getTimeEntries,
} from '@/lib/store';
import { getToday } from '@/lib/calculations';
import { runPayroll, formatMoney, PayAdjustmentRecord, PayrollRow } from '@/lib/payrollRun';
import { PERIOD_KIND_LABEL, PeriodKind, periodFor, periodLabel, shiftPeriod } from '@/lib/periods';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Loader2, Trash2 } from 'lucide-react';
import { LeaveRequest, TimeEntry } from '@/types/workforce';
import type { Holiday } from '@/lib/store';

const KIND_LABEL: Record<HourKind, string> = {
  ordinary: 'Ordinary hours', night: 'Night hours', holiday: 'Sunday / holiday hours', holidayNight: 'Night hours on a Sunday / holiday',
  otDay: 'Overtime, daytime', otNight: 'Overtime, night', otHolidayDay: 'Overtime, Sunday / holiday day', otHolidayNight: 'Overtime, Sunday / holiday night',
};
const ADJ_LABEL: Record<AdjustmentKind, string> = { commission: 'Commission', bonus: 'Bonus', reimbursement: 'Expense refund', deduction: 'Deduction' };

interface Props {
  employees: Employee[];
  currentEmployee?: Employee;
  isDirector: boolean;
  onOpenContract: (e: Employee) => void;
  /** change this number to make the panel reload (after a contract is saved, for example) */
  reloadKey?: number;
}

interface Data {
  contracts: ContractRecord[]; entries: TimeEntry[]; leaves: LeaveRequest[];
  adjustments: PayAdjustmentRecord[]; holidays: Holiday[]; timeZone: string;
}

export default function PayrollPanel({ employees, currentEmployee, isDirector, onOpenContract, reloadKey = 0 }: Props) {
  const [kind, setKind] = useState<PeriodKind>('month');
  const [period, setPeriod] = useState<Period>(() => periodFor('month', getToday()));
  const [data, setData] = useState<Data | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [contracts, entries, leaves, adjustments, holidays, org] = await Promise.all([
      getContracts(), getTimeEntries(), getLeaveRequests(), getPayAdjustments(), getHolidays(), getOrgSettings(),
    ]);
    setData({ contracts, entries, leaves, adjustments, holidays, timeZone: org?.timeZone ?? 'UTC' });
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  const run = useMemo(() => data && runPayroll({
    employees, contracts: data.contracts, entries: data.entries, leaves: data.leaves, adjustments: data.adjustments,
    holidays: data.holidays.map(h => h.date), timeZone: data.timeZone, period,
  }), [data, employees, period]);

  const changeKind = (k: PeriodKind) => {
    setKind(k);
    setPeriod(k === 'custom' ? { ...period } : periodFor(k, getToday()));
  };
  const canEditAdjustments = (emp: Employee) => isDirector || emp.id !== currentEmployee?.id;

  const exportCSV = () => {
    if (!run) return;
    const head = ['Employee', 'Currency', 'Hours', 'Base', 'Surcharges', 'Overtime', 'Paid leave', 'Unpaid deduction', 'Commissions', 'Refunds', 'Deductions', 'Total', 'Withheld', 'Net', 'Company contributions', 'Company cost', 'Warnings'];
    const lines = run.rows.map(r => r.result
      ? [r.employee.name, r.result.currency, r.result.totalHours, r.result.pay.base, r.result.pay.surcharges, r.result.pay.overtime, r.result.pay.paidLeave,
        r.result.pay.unpaidDeduction, r.result.pay.commissions, r.result.pay.reimbursements, r.result.pay.deductions, r.result.gross,
        r.result.withheld, r.result.net, r.result.employerContributions, r.result.employerCost, r.result.warnings.join(' | ')]
      : [r.employee.name, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'No contract']);
    const csv = [head, ...lines].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `payroll-${period.from}_${period.to}.csv`,
    });
    a.click();
  };

  const detailRow = run?.rows.find(r => r.employee.id === detail);

  return (
    <div className="stat-card space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Payroll</h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={v => changeKind(v as PeriodKind)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_KIND_LABEL) as PeriodKind[]).map(k => <SelectItem key={k} value={k}>{PERIOD_KIND_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="Previous period" onClick={() => setPeriod(shiftPeriod(kind, period, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[11rem] text-center">{periodLabel(period)}</span>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="Next period" onClick={() => setPeriod(shiftPeriod(kind, period, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={exportCSV} disabled={!run}><Download className="h-3.5 w-3.5" /> CSV</Button>
        </div>
      </div>

      {kind === 'custom' && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">From</Label>
          <Input type="date" className="h-8 w-40" value={period.from} onChange={e => e.target.value && setPeriod(p => ({ ...p, from: e.target.value, to: p.to < e.target.value ? e.target.value : p.to }))} />
          <Label className="text-xs">To</Label>
          <Input type="date" className="h-8 w-40" value={period.to} min={period.from} onChange={e => e.target.value && setPeriod(p => ({ ...p, to: e.target.value }))} />
        </div>
      )}

      {!run || !data ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {run.totals.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {run.totals.map(t => (
                <div key={t.currency} className="rounded-xl border border-border/60 px-4 py-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total {t.currency}</p>
                  <p className="text-xl font-bold text-primary">{formatMoney(t.gross, t.currency)}</p>
                  <p className="text-xs text-muted-foreground">{t.people} {t.people === 1 ? 'person' : 'people'} · {t.hours} h</p>
                  {(t.net !== t.gross || t.employerCost !== t.gross) && (
                    <p className="text-xs text-muted-foreground">Net to people {formatMoney(t.net, t.currency)} · company cost {formatMoney(t.employerCost, t.currency)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {run.totals.length > 1 && <p className="text-xs text-muted-foreground">Different currencies are never added together.</p>}

          {run.withoutContract.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
              <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-500" /> {run.withoutContract.length} without a contract: not included in the payroll</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {run.withoutContract.map(e => (
                  <Button key={e.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenContract(e)}>{e.name}: set up contract</Button>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {['Person', 'Hours', 'Base', 'Extras', 'Time off', 'Commissions', 'Total', 'Net'].map(h => (
                    <TableHead key={h} className={`font-semibold text-xs ${h === 'Person' ? '' : 'text-right'}`}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.rows.filter(r => r.result).map(r => {
                  const res = r.result!;
                  const m = (n: number) => formatMoney(n, res.currency);
                  return (
                    <TableRow key={r.employee.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetail(r.employee.id)}>
                      <TableCell className="font-medium text-sm">
                        {r.employee.name}
                        {res.warnings.length > 0 && <AlertTriangle className="inline h-3.5 w-3.5 ml-1.5 text-amber-500" aria-label="Has warnings" />}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{res.totalHours}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{m(res.pay.base)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{m(res.pay.surcharges + res.pay.overtime)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{m(res.pay.paidLeave - res.pay.unpaidDeduction)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{m(res.pay.commissions + res.pay.reimbursements - res.pay.deductions)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{m(res.gross)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{m(res.net)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimate before taxes and legal deductions, calculated only from each person's contract. Hours are read in the company time zone ({data.timeZone}).
          </p>
        </>
      )}

      {detailRow && data && (
        <PersonDialog
          row={detailRow} period={period} adjustments={data.adjustments.filter(a => a.employeeId === detailRow.employee.id)}
          canEdit={canEditAdjustments(detailRow.employee)} onClose={() => setDetail(null)}
          onOpenContract={() => { setDetail(null); onOpenContract(detailRow.employee); }} onChanged={load}
        />
      )}
    </div>
  );
}

function PersonDialog({ row, period, adjustments, canEdit, onClose, onOpenContract, onChanged }: {
  row: PayrollRow; period: Period; adjustments: PayAdjustmentRecord[]; canEdit: boolean;
  onClose: () => void; onOpenContract: () => void; onChanged: () => void | Promise<void>;
}) {
  const res = row.result!;
  const m = (n: number) => formatMoney(n, res.currency);
  const today = getToday();
  const [kind, setKind] = useState<AdjustmentKind>('commission');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today < period.from ? period.from : today > period.to ? period.to : today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inPeriod = adjustments.filter(a => a.date >= period.from && a.date <= period.to);

  const add = async () => {
    const n = parseFloat(amount);
    if (!(n > 0)) { setError('Enter an amount greater than zero.'); return; }
    setBusy(true); setError(null);
    try { await addPayAdjustment(row.employee.id, { date, kind, amount: n, note }); setAmount(''); setNote(''); await onChanged(); }
    catch { setError('Could not save it. Check the values and try again.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError(null);
    try { await deletePayAdjustment(id); await onChanged(); } catch { setError('Could not delete it.'); } finally { setBusy(false); }
  };

  const lines: [string, number, string?][] = [
    ['Base pay', res.pay.base],
    ['Night and holiday surcharges', res.pay.surcharges],
    ['Overtime', res.pay.overtime],
    ['Paid time off (hourly pay)', res.pay.paidLeave],
    ['Unpaid time off', -res.pay.unpaidDeduction],
    ['Commissions and bonuses', res.pay.commissions],
    ['Expense refunds', res.pay.reimbursements],
    ['Deductions', -res.pay.deductions],
  ];

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{row.employee.name} · {periodLabel(period)}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 divide-y divide-border/60">
            {lines.filter(l => l[1] !== 0 || l[0] === 'Base pay').map(([label, v]) => (
              <div key={label} className="flex justify-between px-4 py-2 text-sm"><span>{label}</span><span className="font-mono">{m(v)}</span></div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-muted/40"><span className="font-semibold">Total before deductions</span><span className="font-mono font-semibold">{m(res.gross)}</span></div>
            {res.deductionLines.filter(l => l.kind === 'deduction').map(l => (
              <div key={l.name} className="flex justify-between px-4 py-2 text-sm"><span>{l.name} (withheld)</span><span className="font-mono text-destructive">−{m(l.amount)}</span></div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-primary/5"><span className="font-semibold">Net pay</span><span className="text-lg font-bold text-primary">{m(res.net)}</span></div>
          </div>
          {res.deductionLines.some(l => l.kind === 'employer') && (
            <div className="rounded-xl border border-border/60 divide-y divide-border/60 text-sm">
              {res.deductionLines.filter(l => l.kind === 'employer').map(l => (
                <div key={l.name} className="flex justify-between px-4 py-2"><span>{l.name} (paid by the company)</span><span className="font-mono">{m(l.amount)}</span></div>
              ))}
              <div className="flex justify-between px-4 py-2 font-semibold"><span>Total cost for the company</span><span className="font-mono">{m(res.employerCost)}</span></div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-1">Hours worked: {res.totalHours}</p>
            <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {(Object.keys(res.hours) as HourKind[]).filter(k => res.hours[k] > 0).map(k => (
                <div key={k} className="flex justify-between"><span>{KIND_LABEL[k]}</span><span className="font-mono">{res.hours[k]}</span></div>
              ))}
              {res.totalHours === 0 && <span>No hours recorded in this period.</span>}
            </div>
          </div>

          {res.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1">
              {res.warnings.map(w => <p key={w} className="text-xs flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">Commissions, bonuses, refunds and deductions in this period</p>
            {inPeriod.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
            {inPeriod.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm rounded-lg border border-border/60 px-3 py-1.5">
                <span className="font-medium">{ADJ_LABEL[a.kind]}</span>
                <span className="font-mono">{a.kind === 'deduction' ? '−' : '+'}{m(a.amount)}</span>
                <span className="text-xs text-muted-foreground">{a.date}{a.note ? ` · ${a.note}` : ''}</span>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0 text-destructive" aria-label="Delete" disabled={busy} onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end pt-1">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={kind} onValueChange={v => setKind(v as AdjustmentKind)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(ADJ_LABEL) as AdjustmentKind[]).map(k => <SelectItem key={k} value={k}>{ADJ_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Amount ({res.currency})</Label><Input className="h-8" type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                <div><Label className="text-xs">Date</Label><Input className="h-8" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                <div><Label className="text-xs">Note</Label><Input className="h-8" value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="Optional" /></div>
                <Button size="sm" className="h-8" onClick={add} disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Add</Button>
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={onOpenContract}>View contract</Button>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
