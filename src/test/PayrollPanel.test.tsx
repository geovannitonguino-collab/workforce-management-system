import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Employee, TimeEntry } from '@/types/workforce';
import { ContractRecord } from '@/types/contract';
import { blankContract } from '@/lib/contractDefaults';
import type { PayAdjustmentRecord } from '@/lib/payrollRun';

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.releasePointerCapture = vi.fn();

// "today" is fixed so the default period (this month) is predictable
vi.mock('@/lib/calculations', async (orig) => ({ ...(await orig<typeof import('@/lib/calculations')>()), getToday: () => '2026-10-15' }));

const contracts: ContractRecord[] = [];
const entries: TimeEntry[] = [];
const adjustments: PayAdjustmentRecord[] = [];
const addPayAdjustment = vi.fn(async (employeeId: string, a: { date: string; kind: string; amount: number; note?: string }) => {
  adjustments.push({ id: 'a' + adjustments.length, employeeId, date: a.date, kind: a.kind as PayAdjustmentRecord['kind'], amount: a.amount, note: a.note });
});
const deletePayAdjustment = vi.fn(async (id: string) => { const i = adjustments.findIndex(a => a.id === id); if (i >= 0) adjustments.splice(i, 1); });

vi.mock('@/lib/store', () => ({
  getContracts: vi.fn(async () => [...contracts]),
  getTimeEntries: vi.fn(async () => [...entries]),
  getLeaveRequests: vi.fn(async () => []),
  getPayAdjustments: vi.fn(async () => [...adjustments]),
  getHolidays: vi.fn(async () => []),
  getOrgSettings: vi.fn(async () => ({ timeZone: 'America/Bogota' })),
  addPayAdjustment: (...a: Parameters<typeof addPayAdjustment>) => addPayAdjustment(...a),
  deletePayAdjustment: (...a: Parameters<typeof deletePayAdjustment>) => deletePayAdjustment(...a),
}));

import PayrollPanel from '@/components/PayrollPanel';

const person = (id: string, name: string): Employee => ({
  id, name, email: id + '@x.com', role: 'employee', hourlyRate: 0, vacationAccrualRate: 0, paidPtoLimitHours: 0, hireDate: '2026-01-01', department: '',
});
const contract = (employeeId: string, over: Partial<ContractRecord>): ContractRecord => ({
  ...blankContract('contractor', '2026-01-01', 'USD'), id: 'c-' + employeeId, employeeId, tracksTime: true, createdAt: '', ...over,
});

let root: Root | null = null;
let host: HTMLElement | null = null;
async function mount(ui: React.ReactElement) {
  host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}
const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
async function waitFor(check: () => void, timeout = 3000) {
  const start = Date.now();
  for (;;) { try { check(); return; } catch (e) { if (Date.now() - start > timeout) throw e; await tick(); } }
}
const findText = (t: string) => {
  const all = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];
  return all.find(e => (e.textContent ?? '').includes(t) && !Array.from(e.children).some(c => (c.textContent ?? '').includes(t)));
};
const hasText = (t: string) => { if (!findText(t)) throw new Error('text not found: ' + t); };
const click = (el: HTMLElement | undefined) => act(async () => { el!.click(); });
const clickText = (t: string) => click(findText(t));
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const employees = [person('a', 'Ana Fixed'), person('b', 'Beto Hourly'), person('c', 'Caro NoContract')];
const props = { employees, isDirector: true, onOpenContract: vi.fn(), currentEmployee: person('dir', 'Boss') };

beforeEach(() => {
  contracts.length = 0; entries.length = 0; adjustments.length = 0; addPayAdjustment.mockClear(); deletePayAdjustment.mockClear(); props.onOpenContract.mockClear();
  contracts.push(contract('a', { payType: 'fixed', payPeriod: 'monthly', amount: 3000, currency: 'USD' }));
  contracts.push(contract('b', { payType: 'hourly', amount: 20000, currency: 'COP' }));
  entries.push(
    { id: '1', employeeId: 'b', action: 'clock_in', timestamp: '2026-10-06T14:00:00Z', date: '2026-10-06' },
    { id: '2', employeeId: 'b', action: 'clock_out', timestamp: '2026-10-06T22:00:00Z', date: '2026-10-06' },
  );
});
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

describe('PayrollPanel', () => {
  it('shows each person in their own currency, the totals per currency, and who has no contract', async () => {
    await mount(<PayrollPanel {...props} />);
    await waitFor(() => hasText('Ana Fixed'));
    hasText('Beto Hourly');
    hasText('Total USD');
    hasText('Total COP');
    hasText('Different currencies are never added together');
    hasText('$3,000.00');
    hasText('COP');
    hasText('1 without a contract');
    hasText('Caro NoContract: set up contract');
    hasText('Oct 1, 2026 – Oct 31, 2026');
  });

  it('moves to the previous period and recalculates (September has no hours for Beto)', async () => {
    await mount(<PayrollPanel {...props} />);
    await waitFor(() => hasText('Total COP'));
    await click(document.querySelector('button[aria-label="Previous period"]') as HTMLElement);
    await waitFor(() => hasText('Sep 1, 2026 – Sep 30, 2026'));
    expect(findText('Total COP')?.parentElement?.textContent).toContain('0 h');
  });

  it('opens the contract form for a person without a contract', async () => {
    await mount(<PayrollPanel {...props} />);
    await waitFor(() => hasText('Caro NoContract: set up contract'));
    await clickText('Caro NoContract: set up contract');
    expect(props.onOpenContract).toHaveBeenCalledWith(employees[2]);
  });

  it('adds a commission from the person detail and sends the right values', async () => {
    await mount(<PayrollPanel {...props} />);
    await waitFor(() => hasText('Ana Fixed'));
    await clickText('Ana Fixed');
    await waitFor(() => hasText('Commissions, bonuses, refunds and deductions in this period'));
    const amount = document.querySelector('input[type="number"]') as HTMLInputElement;
    await type(amount, '500');
    await clickText('Add');
    await waitFor(() => expect(addPayAdjustment).toHaveBeenCalledTimes(1));
    const [id, body] = addPayAdjustment.mock.calls[0] as unknown as [string, { kind: string; amount: number; date: string }];
    expect(id).toBe('a');
    expect(body.kind).toBe('commission');
    expect(body.amount).toBe(500);
    expect(body.date >= '2026-10-01' && body.date <= '2026-10-31').toBe(true);
    // the new line is part of the total: 3000 base + 500
    await waitFor(() => hasText('$3,500.00'));
  });

  it('a manager cannot add commissions to his own payroll row, but can view it', async () => {
    const mgr = person('m', 'Mia Manager');
    contracts.push(contract('m', { payType: 'fixed', amount: 4000 }));
    await mount(<PayrollPanel {...props} isDirector={false} currentEmployee={mgr} employees={[mgr, employees[0]]} />);
    await waitFor(() => hasText('Mia Manager'));
    await clickText('Mia Manager');
    await waitFor(() => hasText('Hours worked:'));
    expect(findText('Commissions, bonuses, refunds and deductions in this period')).toBeDefined();
    expect(document.querySelectorAll('input[type="number"]').length).toBe(0); // no add form for his own row
    // but he can for his team member
    await clickText('Close');
    await clickText('Ana Fixed');
    await waitFor(() => expect(document.querySelectorAll('input[type="number"]').length).toBeGreaterThan(0));
  });
});
