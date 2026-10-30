import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Employee } from '@/types/workforce';
import {
  ContractFormValues, ContractRecord, PayPeriod, Surcharges, SUGGESTED_CONTRACT_TYPES, Weekday,
} from '@/types/contract';
import { addContract, getContracts, getOrgSettings, updateContract } from '@/lib/store';
import { blankContract } from '@/lib/contractDefaults';
import { weeklyHours } from '@/lib/payrollEngine';
import { getToday } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const NEW = '__new__';
const CURRENCIES = ['USD', 'COP', 'CAD', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'UYU', 'EUR', 'GTQ', 'CRC', 'DOP', 'PAB'];
const DAYS: { d: Weekday; label: string }[] = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' }, { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
];
const SURCHARGE_LABELS: { key: keyof Surcharges; label: string }[] = [
  { key: 'night', label: 'Night hour' },
  { key: 'holiday', label: 'Sunday / holiday hour' },
  { key: 'holidayNight', label: 'Night hour on a Sunday / holiday' },
  { key: 'otDay', label: 'Overtime, daytime' },
  { key: 'otNight', label: 'Overtime, night' },
  { key: 'otHolidayDay', label: 'Overtime, Sunday / holiday day' },
  { key: 'otHolidayNight', label: 'Overtime, Sunday / holiday night' },
];
const PERIOD_LABEL: Record<PayPeriod, string> = { weekly: 'week', biweekly: '2 weeks', semimonthly: 'half month (quincena)', monthly: 'month' };

/** A number box that allows being empty while typing. Empty means "not set". */
function NumField({ value, onChange, min = 0, max, step = 'any', placeholder, disabled }: {
  value: number | undefined; onChange: (v: number | undefined) => void;
  min?: number; max?: number; step?: string; placeholder?: string; disabled?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return (
    <Input
      type="number" inputMode="decimal" min={min} max={max} step={step} placeholder={placeholder} disabled={disabled}
      value={text}
      onChange={e => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        onChange(e.target.value.trim() === '' || Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}

function toForm(c: ContractRecord): ContractFormValues {
  const { id: _id, employeeId: _e, createdBy: _cb, createdAt: _ca, ...rest } = c;
  return { ...rest };
}

function validate(f: ContractFormValues): string | null {
  if (!f.effectiveFrom) return 'Choose the date this contract starts.';
  if (f.endDate && f.endDate < f.effectiveFrom) return 'The end date cannot be before the start date.';
  if (!(f.amount >= 0)) return 'The amount cannot be negative.';
  if (!/^[A-Za-z]{3}$/.test(f.currency)) return 'The currency must be a 3-letter code, for example USD or COP.';
  for (const d of DAYS) { const h = f.schedule[d.d]; if (!(h >= 0 && h <= 24)) return `Hours for ${d.label} must be between 0 and 24.`; }
  for (const s of SURCHARGE_LABELS) { const v = f.surcharges[s.key]; if (!(v >= 0 && v <= 1000)) return `"${s.label}" must be between 0 and 1000 %.`; }
  if (f.unpaidDayDivisor <= 0) return 'The unpaid-day divisor must be greater than zero.';
  return null;
}

interface Props {
  employee: Employee | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/** The contract form: whatever the company writes here is exactly what payroll calculates. Everything is optional except the pay itself. */
export default function ContractDialog({ employee, canEdit, onClose, onSaved }: Props) {
  const [versions, setVersions] = useState<ContractRecord[]>([]);
  const [selected, setSelected] = useState<string>(NEW);
  const [form, setForm] = useState<ContractFormValues | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const startNew = useCallback((from?: ContractRecord, currency?: string) => {
    const base = from
      ? { ...toForm(from), effectiveFrom: getToday(), endDate: undefined, note: undefined }
      : { ...blankContract('contractor', getToday(), currency ?? defaultCurrency), tracksTime: true } as ContractFormValues;
    setForm(base);
    setSelected(NEW);
    setAdvanced(base.overtimeEligible || Object.values(base.surcharges).some(v => v > 0));
    setFormKey(k => k + 1);
    setError(null); setSaved(false);
  }, [defaultCurrency]);

  useEffect(() => {
    if (!employee) return;
    let alive = true;
    (async () => {
      const [list, org] = await Promise.all([getContracts(employee.id), getOrgSettings()]);
      if (!alive) return;
      const cur = org?.defaultCurrency || 'USD';
      setDefaultCurrency(cur);
      setVersions(list);
      if (list.length > 0) {
        const today = getToday();
        const current = list.find(v => v.effectiveFrom <= today) ?? list[0];
        setSelected(current.id);
        setForm(toForm(current));
        setAdvanced(current.overtimeEligible || Object.values(current.surcharges).some(v => v > 0));
        setFormKey(k => k + 1);
      } else {
        startNew(undefined, cur);
      }
      setError(null); setSaved(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const pick = (id: string) => {
    if (id === NEW) { startNew(versions.find(v => v.id === selected) ?? versions[0]); return; }
    const v = versions.find(x => x.id === id);
    if (!v) return;
    setSelected(id); setForm(toForm(v));
    setAdvanced(v.overtimeEligible || Object.values(v.surcharges).some(x => x > 0));
    setFormKey(k => k + 1); setError(null); setSaved(false);
  };

  const set = <K extends keyof ContractFormValues>(k: K, v: ContractFormValues[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const weekly = useMemo(() => (form ? weeklyHours(form) : 0), [form]);

  const save = async () => {
    if (!form || !employee) return;
    const problem = validate(form);
    if (problem) { setError(problem); return; }
    setSaving(true); setError(null); setSaved(false);
    try {
      const rec = selected === NEW ? await addContract(employee.id, form) : await updateContract(selected, form);
      const list = await getContracts(employee.id);
      setVersions(list); setSelected(rec.id); setSaved(true);
      onSaved?.();
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      setError(
        m.includes('duplicate') || m.includes('employee_id_effective_from') ? 'There is already a version that starts on that date. Pick another date or edit that version.'
        : m.includes('surcharge') ? 'A surcharge value is not valid (use a number from 0 to 1000).'
        : m.includes('schedule') ? 'The weekly schedule has an invalid value.'
        : m.includes('violates') || m.includes('check') ? 'One of the values is out of its allowed range.'
        : 'Could not save the contract. Check the values and try again.');
    } finally { setSaving(false); }
  };

  if (!employee) return null;
  const hourly = form?.payType === 'hourly';

  return (
    <Dialog open={!!employee} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Contract — {employee.name}</DialogTitle></DialogHeader>

        {!form ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6" key={formKey}>
            {/* version picker */}
            <div className="flex flex-wrap items-center gap-2">
              <Label className="shrink-0">Version</Label>
              <Select value={selected} onValueChange={pick}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {canEdit && <SelectItem value={NEW}>New version (from today)</SelectItem>}
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.effectiveFrom}{v.endDate ? ` → ${v.endDate}` : ''} · {v.amount} {v.currency}{v.payType === 'fixed' ? `/${v.payPeriod}` : '/h'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Each version applies from its start date. Past payroll never changes when you add a new one.</p>
            </div>

            {/* pay */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">How this person is paid</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Relationship</Label>
                  <Select value={form.relationship} onValueChange={v => set('relationship', v as ContractFormValues['relationship'])} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">A label only. It does not turn anything on or off.</p>
                </div>
                <div>
                  <Label>Contract type (optional)</Label>
                  <Input list="contract-types" value={form.contractType} disabled={!canEdit} onChange={e => set('contractType', e.target.value)} placeholder="Any text" />
                  <datalist id="contract-types">{SUGGESTED_CONTRACT_TYPES.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <div>
                  <Label>Starts on</Label>
                  <Input type="date" value={form.effectiveFrom} disabled={!canEdit} onChange={e => set('effectiveFrom', e.target.value)} />
                </div>
                <div>
                  <Label>Ends on (optional)</Label>
                  <Input type="date" value={form.endDate ?? ''} disabled={!canEdit} onChange={e => set('endDate', e.target.value || undefined)} />
                </div>
                <div>
                  <Label>Pay type</Label>
                  <Select value={form.payType} onValueChange={v => set('payType', v as ContractFormValues['payType'])} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">By the hour (hours worked × rate)</SelectItem>
                      <SelectItem value="fixed">Fixed amount each pay period</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!hourly && (
                  <div>
                    <Label>Paid every</Label>
                    <Select value={form.payPeriod} onValueChange={v => set('payPeriod', v as PayPeriod)} disabled={!canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PERIOD_LABEL) as PayPeriod[]).map(p => <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>{hourly ? 'Hourly rate' : `Amount per ${PERIOD_LABEL[form.payPeriod]}`}</Label>
                  <NumField value={form.amount} onChange={v => set('amount', v ?? 0)} disabled={!canEdit} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input list="currencies" value={form.currency} maxLength={3} disabled={!canEdit}
                    onChange={e => set('currency', e.target.value.toUpperCase())} placeholder="USD" />
                  <datalist id="currencies">{CURRENCIES.map(c => <option key={c} value={c} />)}</datalist>
                </div>
              </div>
            </section>

            {/* hours */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Hours</h4>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">This person clocks in and out</span>
                  <Switch checked={form.tracksTime} onCheckedChange={v => set('tracksTime', v)} disabled={!canEdit} />
                </label>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map(({ d, label }) => (
                  <div key={d}>
                    <Label className="text-xs">{label}</Label>
                    <NumField value={form.schedule[d]} max={24} step="0.25" disabled={!canEdit}
                      onChange={v => set('schedule', { ...form.schedule, [d]: v ?? 0 })} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Agreed hours per weekday · {weekly} h per week. Leave 0 for days off.</p>
              <div className="max-w-xs">
                <Label>Maximum hours per day (optional, only to warn)</Label>
                <NumField value={form.maxDailyHours} max={24} disabled={!canEdit} onChange={v => set('maxDailyHours', v)} />
              </div>
            </section>

            {/* time off */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Time off this person is entitled to</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Vacation days earned per month</Label>
                  <NumField value={form.vacationDaysPerMonth} step="0.001" disabled={!canEdit} onChange={v => set('vacationDaysPerMonth', v ?? 0)} />
                </div>
                <div>
                  <Label>Paid PTO hours per year</Label>
                  <NumField value={form.ptoHoursPerYear} disabled={!canEdit} onChange={v => set('ptoHoursPerYear', v ?? 0)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Leave a 0 and that person has none of it. Sick leave, personal, family day and other are requested as needed.</p>
            </section>

            {/* advanced */}
            <section className="space-y-3">
              <button type="button" className="flex items-center gap-1 text-sm font-semibold" onClick={() => setAdvanced(a => !a)}>
                {advanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Surcharges and overtime (optional)
              </button>
              {advanced && (
                <div className="space-y-4 rounded-lg border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">
                    Type the extra percentage your company pays on top of the normal hour. A blank or 0 means no extra. Example: 35 means that hour pays 135 %.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SURCHARGE_LABELS.map(s => (
                      <div key={s.key}>
                        <Label>{s.label} (+ %)</Label>
                        <NumField value={form.surcharges[s.key]} max={1000} disabled={!canEdit}
                          onChange={v => set('surcharges', { ...form.surcharges, [s.key]: v ?? 0 })} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <div><Label>Night starts</Label><Input type="time" value={form.nightStart} disabled={!canEdit} onChange={e => set('nightStart', e.target.value)} /></div>
                    <div><Label>Night ends</Label><Input type="time" value={form.nightEnd} disabled={!canEdit} onChange={e => set('nightEnd', e.target.value)} /></div>
                  </div>
                  <div>
                    <Label>Weekdays paid as holiday</Label>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {DAYS.map(({ d, label }) => (
                        <label key={d} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={form.holidayWeekdays.includes(d)} disabled={!canEdit}
                            onCheckedChange={c => set('holidayWeekdays', c === true ? [...form.holidayWeekdays, d] : form.holidayWeekdays.filter(x => x !== d))}
                          />{label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Company holiday dates are managed by the director.</p>
                  </div>

                  <div className="space-y-3 border-t border-border/60 pt-3">
                    <label className="flex items-center justify-between text-sm">
                      <span className="font-medium">This person gets paid overtime</span>
                      <Switch checked={form.overtimeEligible} disabled={!canEdit}
                        onCheckedChange={v => { set('overtimeEligible', v); if (v && form.overtimeBasis === 'none') set('overtimeBasis', 'schedule'); }} />
                    </label>
                    {form.overtimeEligible && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label>Overtime starts after</Label>
                          <Select value={form.overtimeBasis === 'none' ? 'schedule' : form.overtimeBasis} disabled={!canEdit}
                            onValueChange={v => set('overtimeBasis', v as ContractFormValues['overtimeBasis'])}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="schedule">The hours agreed for that day</SelectItem>
                              <SelectItem value="fixed">A fixed number of hours per day</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {form.overtimeBasis === 'fixed' && (
                          <div><Label>Hours per day</Label><NumField value={form.overtimeDailyHours} max={24} disabled={!canEdit} onChange={v => set('overtimeDailyHours', v)} /></div>
                        )}
                        <div><Label>And/or hours per week (optional)</Label><NumField value={form.overtimeWeeklyHours} max={168} disabled={!canEdit} onChange={v => set('overtimeWeeklyHours', v)} /></div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/60 pt-3">
                    {!hourly && (
                      <div>
                        <Label>Hours per month that make up the pay (optional)</Label>
                        <NumField value={form.monthlyHoursDivisor} disabled={!canEdit} onChange={v => set('monthlyHoursDivisor', v)} placeholder="Auto: weekly hours × 52 ÷ 12" />
                        <p className="text-xs text-muted-foreground mt-1">Used to value one hour when surcharges or overtime apply to a fixed pay.</p>
                      </div>
                    )}
                    <div>
                      <Label>Days a month is divided into, for unpaid days</Label>
                      <NumField value={form.unpaidDayDivisor} min={1} disabled={!canEdit} onChange={v => set('unpaidDayDivisor', v ?? 30)} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div>
              <Label>Note (optional)</Label>
              <Textarea rows={2} value={form.note ?? ''} disabled={!canEdit} onChange={e => set('note', e.target.value)} placeholder="Anything worth remembering about this agreement" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-emerald-600">Saved.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              {canEdit && (
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {selected === NEW ? 'Save as new version' : 'Save changes'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
