import { describe, it, expect } from 'vitest';
import { buildContractSummaryHtml, buildPayslipHtml, esc } from '@/lib/printDocs';
import { calculatePay } from '@/lib/payrollEngine';
import { blankContract } from '@/lib/contractDefaults';
import { ContractRecord } from '@/types/contract';
import { Employee } from '@/types/workforce';

const emp = (name = 'Ana Pérez'): Employee => ({
  id: 'e', name, email: 'ana@x.com', role: 'employee', hourlyRate: 0, vacationAccrualRate: 0, paidPtoLimitHours: 0, hireDate: '2026-01-01', department: 'Ingeniería',
});
const contract = (over: Partial<ContractRecord> = {}): ContractRecord => ({
  ...blankContract('contractor', '2026-01-01', 'USD'), id: 'c', employeeId: 'e', tracksTime: true, createdAt: '', payType: 'fixed', amount: 3000, ...over,
});
const OCT = { from: '2026-10-01', to: '2026-10-31' };
const pay = (c: ContractRecord, adjustments: Parameters<typeof calculatePay>[0]['adjustments'] = []) =>
  calculatePay({ contracts: [c], entries: [], leaves: [], adjustments, period: OCT, timeZone: 'America/Bogota' });

describe('esc', () => {
  it('neutralises markup', () => {
    expect(esc('<script>alert("x")</script> & \'q\'')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;');
    expect(esc(null)).toBe('');
  });
});

describe('payslip', () => {
  it('shows base pay, the net amount and the disclaimer; hides lines that are zero', () => {
    const html = buildPayslipHtml({ company: 'Acme SAS', employee: emp(), period: OCT, result: pay(contract()), generatedOn: '2026-11-01' });
    expect(html).toContain('Acme SAS');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('$3,000.00');
    expect(html).toContain('Net pay / Pago neto');
    expect(html).toContain('not a legal payroll document');
    expect(html).not.toContain('Overtime / Horas extra');
    expect(html).not.toContain('Withheld from your pay');
    expect(html).not.toContain('Paid by the company, for reference');
  });

  it('lists commissions, withheld lines and the company contributions separately', () => {
    const c = contract({ deductionLines: [
      { name: 'Health', kind: 'deduction', basis: 'gross', mode: 'percent', value: 4 },
      { name: 'Employer pension', kind: 'employer', basis: 'gross', mode: 'percent', value: 12 },
    ] });
    const html = buildPayslipHtml({ company: 'Acme', employee: emp(), period: OCT, result: pay(c, [{ date: '2026-10-20', kind: 'commission', amount: 500 }]) });
    expect(html).toContain('Commissions and bonuses');
    expect(html).toContain('$3,500.00');         // before deductions
    expect(html).toContain('Withheld from your pay');
    expect(html).toContain('-$140.00');          // 4 % of 3,500
    expect(html).toContain('$3,360.00');         // net
    expect(html).toContain('Paid by the company, for reference');
    expect(html).toContain('Employer pension');
  });

  it('escapes the names and notes that people typed', () => {
    const c = contract({ deductionLines: [{ name: '<img src=x onerror=alert(1)>', kind: 'deduction', basis: 'gross', mode: 'percent', value: 5 }] });
    const html = buildPayslipHtml({ company: '<b>Evil</b>', employee: emp('<script>x</script>'), period: OCT, result: pay(c) });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });
});

describe('contract summary', () => {
  it('prints the terms the company entered, with signature lines and a "not a legal contract" notice', () => {
    const html = buildContractSummaryHtml({
      company: 'Acme SAS', employee: emp(), generatedOn: '2026-11-01',
      contract: contract({ payType: 'hourly', amount: 25, vacationDaysPerMonth: 1.25, ptoHoursPerYear: 40, note: 'Pilot <b>deal</b>',
        surcharges: { ...contract().surcharges, night: 35 }, overtimeEligible: true, endDate: '2027-01-01' }),
    });
    expect(html).toContain('By the hour / Por hora: $25.00');
    expect(html).toContain('+35 %');
    expect(html).toContain('Sunday / Domingo');
    expect(html).toContain('40 per week');
    expect(html).toContain('2027-01-01');
    expect(html).toContain('1.25');
    expect(html).toContain('class="sign"');
    expect(html).toContain('not a legal contract');
    expect(html).not.toContain('<b>deal</b>');
  });
  it('omits the surcharge section for a plain contractor and shows a fixed pay period', () => {
    const html = buildContractSummaryHtml({ company: 'Acme', employee: emp(), contract: contract({ payPeriod: 'semimonthly', amount: 1500 }) });
    expect(html).toContain('Fixed amount / Monto fijo: $1,500.00 per half month / quincena');
    expect(html).not.toContain('Surcharges and overtime');
  });
});
