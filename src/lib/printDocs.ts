import { Employee } from '@/types/workforce';
import { ContractRecord, HourKind, PayrollResult, Period, Weekday } from '@/types/contract';
import { formatMoney } from '@/lib/payrollRun';
import { periodLabel } from '@/lib/periods';
import { weeklyHours } from '@/lib/payrollEngine';

/** Escape anything that comes from people (names, notes...) before it goes into generated HTML. */
export const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STYLE = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1c2430; font-size: 12.5px; line-height: 1.45; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #0f3d7a; }
  h2 { font-size: 13px; margin: 18px 0 6px; color: #0f3d7a; text-transform: uppercase; letter-spacing: .04em; }
  .muted { color: #4a5566; font-size: 12px; }
  .head { display: flex; justify-content: space-between; border-bottom: 3px solid #0f3d7a; padding-bottom: 8px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 5px 8px; border-bottom: 1px solid #d5dbe5; text-align: left; vertical-align: top; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.total td { font-weight: 700; background: #f3f5f9; border-top: 2px solid #0f3d7a; }
  tr.net td { font-weight: 700; font-size: 15px; background: #e8f0fb; border-top: 2px solid #0f3d7a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .note { margin-top: 22px; font-size: 11.5px; color: #4a5566; border-top: 1px solid #d5dbe5; padding-top: 8px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; }
  .sign div { border-top: 1px solid #1c2430; padding-top: 4px; font-size: 12px; }
`;

const page = (title: string, body: string) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`;

const KIND_LABEL: Record<HourKind, string> = {
  ordinary: 'Ordinary hours / Horas ordinarias', night: 'Night hours / Horas nocturnas',
  holiday: 'Sunday or holiday hours / Horas en domingo o festivo', holidayNight: 'Night, Sunday or holiday / Nocturnas en domingo o festivo',
  otDay: 'Overtime, day / Extras diurnas', otNight: 'Overtime, night / Extras nocturnas',
  otHolidayDay: 'Overtime, Sunday or holiday day / Extras diurnas en domingo o festivo',
  otHolidayNight: 'Overtime, Sunday or holiday night / Extras nocturnas en domingo o festivo',
};

export interface PayslipInput { company: string; employee: Employee; period: Period; result: PayrollResult; generatedOn?: string }

/** Printable payslip (estimate) for one person and period. */
export function buildPayslipHtml({ company, employee, period, result, generatedOn }: PayslipInput): string {
  const m = (n: number) => esc(formatMoney(n, result.currency));
  const row = (label: string, amount: number, cls = '') => `<tr class="${cls}"><td>${esc(label)}</td><td class="n">${m(amount)}</td></tr>`;
  const p = result.pay;

  const earnings = [
    ['Base pay / Pago base', p.base], ['Night and holiday surcharges / Recargos', p.surcharges], ['Overtime / Horas extra', p.overtime],
    ['Paid time off / Permisos pagados', p.paidLeave], ['Commissions and bonuses / Comisiones y bonos', p.commissions],
    ['Expense refunds / Reembolsos de gastos', p.reimbursements],
  ] as [string, number][];
  const lessLines = [['Unpaid time off / Permisos sin pago', p.unpaidDeduction], ['Deductions / Descuentos', p.deductions]] as [string, number][];
  const withheld = result.deductionLines.filter(l => l.kind === 'deduction' && l.amount > 0);
  const employer = result.deductionLines.filter(l => l.kind === 'employer' && l.amount > 0);
  const hours = (Object.keys(result.hours) as HourKind[]).filter(k => result.hours[k] > 0);

  const body = `
    <div class="head">
      <div><h1>Payslip (estimate) / Comprobante de pago (estimado)</h1><div class="muted">${esc(company)}</div></div>
      <div class="muted" style="text-align:right">${esc(periodLabel(period))}<br>${esc(result.currency)}</div>
    </div>
    <div class="grid">
      <div><strong>${esc(employee.name)}</strong><div class="muted">${esc(employee.email)}</div></div>
      <div class="muted" style="text-align:right">${esc(employee.department || '')}</div>
    </div>

    ${hours.length ? `<h2>Hours worked / Horas trabajadas: ${result.totalHours}</h2>
    <table>${hours.map(k => `<tr><td>${esc(KIND_LABEL[k])}</td><td class="n">${result.hours[k]}</td></tr>`).join('')}</table>` : ''}

    <h2>Earnings / Ingresos</h2>
    <table>
      ${earnings.filter(([, v]) => v !== 0).map(([l, v]) => row(l, v)).join('') || row('Base pay / Pago base', 0)}
      ${lessLines.filter(([, v]) => v !== 0).map(([l, v]) => row(l, -v)).join('')}
      ${row('Total before deductions / Total antes de descuentos', result.gross, 'total')}
    </table>

    ${withheld.length ? `<h2>Withheld from your pay / Descontado de tu pago</h2>
    <table>${withheld.map(l => row(l.name, -l.amount)).join('')}</table>` : ''}

    <table style="margin-top:14px">${row('Net pay / Pago neto', result.net, 'net')}</table>

    ${employer.length ? `<h2>Paid by the company, for reference / Pagado por la empresa, de referencia</h2>
    <table>${employer.map(l => row(l.name, l.amount)).join('')}</table>` : ''}

    ${result.warnings.length ? `<div class="note"><strong>Notes / Notas:</strong> ${result.warnings.map(esc).join(' · ')}</div>` : ''}
    <div class="note">Estimate calculated from the contract, before any legal obligation the company has. It is not a legal payroll document.
      / Estimado calculado desde el contrato; no es un documento legal de nómina. Generated ${esc(generatedOn ?? new Date().toISOString().slice(0, 10))}.</div>`;
  return page(`Payslip ${employee.name} ${periodLabel(period)}`, body);
}

const DAY_NAMES: Record<Weekday, string> = { 1: 'Monday / Lunes', 2: 'Tuesday / Martes', 3: 'Wednesday / Miércoles', 4: 'Thursday / Jueves', 5: 'Friday / Viernes', 6: 'Saturday / Sábado', 0: 'Sunday / Domingo' };
const PERIOD_NAME = { weekly: 'week / semana', biweekly: 'two weeks / dos semanas', semimonthly: 'half month / quincena', monthly: 'month / mes' } as const;
const SURCHARGE_NAME: Record<string, string> = {
  night: 'Night hour / Hora nocturna', holiday: 'Sunday or holiday hour / Hora en domingo o festivo', holidayNight: 'Night hour on a Sunday or holiday / Hora nocturna en domingo o festivo',
  otDay: 'Overtime, day / Extra diurna', otNight: 'Overtime, night / Extra nocturna', otHolidayDay: 'Overtime, Sunday or holiday day / Extra diurna en domingo o festivo',
  otHolidayNight: 'Overtime, Sunday or holiday night / Extra nocturna en domingo o festivo',
};

/** Printable summary of the terms of one contract version, with signature lines. It is not a legal contract. */
export function buildContractSummaryHtml(args: { company: string; employee: Employee; contract: ContractRecord; generatedOn?: string }): string {
  const { company, employee, contract: c, generatedOn } = args;
  const m = (n: number) => esc(formatMoney(n, c.currency));
  const rowKV = (k: string, v: string) => `<tr><td style="width:46%">${esc(k)}</td><td>${v}</td></tr>`;
  const sur = Object.entries(c.surcharges).filter(([, v]) => v > 0);
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

  const body = `
    <div class="head">
      <div><h1>Contract summary / Resumen del contrato</h1><div class="muted">${esc(company)}</div></div>
      <div class="muted" style="text-align:right">From / Desde ${esc(c.effectiveFrom)}${c.endDate ? `<br>To / Hasta ${esc(c.endDate)}` : ''}</div>
    </div>
    <div class="grid"><div><strong>${esc(employee.name)}</strong><div class="muted">${esc(employee.email)}</div></div>
      <div class="muted" style="text-align:right">${esc(c.relationship === 'contractor' ? 'Contractor / Contratista' : 'Employee / Empleado')}${c.contractType ? ' · ' + esc(c.contractType) : ''}</div></div>

    <h2>Pay / Pago</h2>
    <table>
      ${rowKV('Pay type / Tipo de pago', c.payType === 'hourly' ? `By the hour / Por hora: ${m(c.amount)}` : `Fixed amount / Monto fijo: ${m(c.amount)} per ${esc(PERIOD_NAME[c.payPeriod])}`)}
      ${rowKV('Currency / Moneda', esc(c.currency))}
      ${rowKV('Clocks in and out / Ficha entrada y salida', c.tracksTime ? 'Yes / Sí' : 'No')}
    </table>

    <h2>Agreed hours / Horas acordadas: ${esc(weeklyHours(c))} per week / por semana</h2>
    <table>${order.map(d => `<tr><td>${esc(DAY_NAMES[d])}</td><td class="n">${c.schedule[d]}</td></tr>`).join('')}
      ${c.maxDailyHours !== undefined ? rowKV('Maximum per day / Máximo por día', String(c.maxDailyHours)) : ''}</table>

    <h2>Time off / Descansos</h2>
    <table>
      ${rowKV('Vacation days per month / Días de vacaciones por mes', String(c.vacationDaysPerMonth))}
      ${rowKV('Paid PTO hours per year / Horas de PTO pagado por año', String(c.ptoHoursPerYear))}
    </table>

    ${(sur.length || c.overtimeEligible) ? `<h2>Surcharges and overtime / Recargos y horas extra</h2>
    <table>
      ${sur.map(([k, v]) => rowKV(SURCHARGE_NAME[k] ?? k, `+${esc(v)} %`)).join('')}
      ${rowKV('Night hours / Horario nocturno', `${esc(c.nightStart)} – ${esc(c.nightEnd)}`)}
      ${rowKV('Overtime / Horas extra', c.overtimeEligible ? 'Yes / Sí' : 'No')}
    </table>` : ''}

    ${(c.deductionLines?.length ?? 0) > 0 ? `<h2>Deductions and contributions / Descuentos y aportes</h2>
    <table>${c.deductionLines!.map(l => rowKV(l.name, `${l.mode === 'percent' ? esc(l.value) + ' %' : m(l.value) + ' / month'} · ${l.kind === 'deduction' ? 'withheld / descontado' : 'paid by the company / pagado por la empresa'} · ${l.basis === 'gross' ? 'all pay / todo el pago' : 'base pay / pago base'}`)).join('')}</table>` : ''}

    ${c.note ? `<h2>Note / Nota</h2><div>${esc(c.note)}</div>` : ''}

    <div class="sign"><div>${esc(company)}</div><div>${esc(employee.name)}</div></div>
    <div class="note">Summary of the terms entered in Trackly. It is not a legal contract and does not replace one.
      / Resumen de las condiciones registradas en Trackly; no es un contrato legal ni lo reemplaza. Generated ${esc(generatedOn ?? new Date().toISOString().slice(0, 10))}.</div>`;
  return page(`Contract ${employee.name} ${c.effectiveFrom}`, body);
}

/** Opens the document in a new window and starts the print dialog (the person can choose "Save as PDF"). Returns false if the browser blocked the window. */
export function printHtml(html: string): boolean {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* the person can print from the window */ } }, 300);
  return true;
}
