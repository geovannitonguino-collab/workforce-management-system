import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Employee } from '@/types/workforce';
import { ContractRecord } from '@/types/contract';
import { blankContract } from '@/lib/contractDefaults';

// Radix needs these browser APIs, which jsdom does not provide
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.releasePointerCapture = vi.fn();

const stored: ContractRecord[] = [];
const addContract = vi.fn(async (employeeId: string, form: Record<string, unknown>) => {
  const rec = { ...(form as object), id: 'c-new', employeeId, createdAt: '2026-10-30' } as unknown as ContractRecord;
  stored.unshift(rec);
  return rec;
});
const updateContract = vi.fn(async (id: string, form: Record<string, unknown>) => ({ ...(form as object), id, employeeId: 'e1', createdAt: '' } as unknown as ContractRecord));

vi.mock('@/lib/store', () => ({
  getContracts: vi.fn(async () => [...stored]),
  getOrgSettings: vi.fn(async () => ({ timeZone: 'America/Bogota', defaultCurrency: 'COP' })),
  addContract: (...a: Parameters<typeof addContract>) => addContract(...a),
  updateContract: (...a: Parameters<typeof updateContract>) => updateContract(...a),
}));

import ContractDialog from '@/components/ContractDialog';

const emp: Employee = {
  id: 'e1', name: 'Ana Test', email: 'ana@x.com', role: 'employee', hourlyRate: 0, vacationAccrualRate: 0,
  paidPtoLimitHours: 0, hireDate: '2026-01-01', department: 'Ops',
};
const existing = (over: Partial<ContractRecord> = {}): ContractRecord => ({
  ...blankContract('contractor', '2026-01-01', 'USD'), id: 'c1', employeeId: 'e1', tracksTime: true, createdAt: '', payType: 'fixed', amount: 3000, ...over,
});

let root: Root | null = null;
let host: HTMLElement | null = null;
async function mount(ui: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}
const tick = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
async function waitFor(check: () => void, timeout = 3000) {
  const start = Date.now();
  for (;;) {
    try { check(); return; } catch (e) { if (Date.now() - start > timeout) throw e; await tick(); }
  }
}
/** The deepest element whose whole text contains `t` (React splits text into several nodes). */
const findText = (t: string) => {
  const all = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];
  return all.find(e => (e.textContent ?? '').includes(t) && !Array.from(e.children).some(c => (c.textContent ?? '').includes(t)));
};
const hasText = (t: string) => { if (!findText(t)) throw new Error('text not found: ' + t); };
const inputByValue = (v: string) => Array.from(document.body.querySelectorAll('input')).find(i => i.value === v) as HTMLInputElement | undefined;
const click = (t: string) => act(async () => { findText(t)!.click(); });
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => { stored.length = 0; addContract.mockClear(); updateContract.mockClear(); });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

describe('ContractDialog', () => {
  it('opens a blank contractor form with the company default currency when the person has no contract yet', async () => {
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => hasText('How this person is paid'));
    expect(document.body.querySelector<HTMLInputElement>('input[placeholder="USD"]')!.value).toBe('COP');
    hasText('40 h per week');
    // legal extras stay hidden until asked for
    expect(findText('Night hour (+ %)')).toBeUndefined();
  });

  it('shows the current version of an existing contract and saves changes to that same version', async () => {
    stored.push(existing());
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => hasText('Save changes'));
    await click('Save changes');
    await waitFor(() => expect(updateContract).toHaveBeenCalledTimes(1));
    const [id, form] = updateContract.mock.calls[0] as unknown as [string, { amount: number; currency: string }];
    expect(id).toBe('c1');
    expect(form.amount).toBe(3000);
    expect(form.currency).toBe('USD');
    await waitFor(() => hasText('Saved.'));
  });

  it('opens the advanced section by itself when the contract has surcharges, and shows them', async () => {
    stored.push(existing({ surcharges: { ...existing().surcharges, night: 35 }, overtimeEligible: true, overtimeBasis: 'schedule' }));
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => hasText('Night hour (+ %)'));
    hasText('This person gets paid overtime');
    expect(inputByValue('35')).toBeDefined();
  });

  it('creates a new version, with no legal extras, for a person without a contract', async () => {
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => hasText('Save as new version'));
    await click('Save as new version');
    await waitFor(() => expect(addContract).toHaveBeenCalledTimes(1));
    const [employeeId, form] = addContract.mock.calls[0] as unknown as [string, { relationship: string; overtimeEligible: boolean; surcharges: Record<string, number> }];
    expect(employeeId).toBe('e1');
    expect(form.relationship).toBe('contractor');
    expect(form.overtimeEligible).toBe(false);
    expect(Object.values(form.surcharges).every(v => v === 0)).toBe(true);
  });

  it('refuses to save an invalid currency and says why', async () => {
    stored.push(existing());
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => expect(inputByValue('USD')).toBeDefined());
    await type(inputByValue('USD')!, 'U');
    await click('Save changes');
    await waitFor(() => hasText('3-letter code'));
    expect(updateContract).not.toHaveBeenCalled();
  });

  it('shows the deduction lines of a contract and saves a new line the company typed', async () => {
    stored.push(existing({ deductionLines: [{ name: 'Income tax', kind: 'deduction', basis: 'gross', mode: 'percent', value: 10 }] }));
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => hasText('Add a line'));
    expect(inputByValue('Income tax')).toBeDefined(); // section opens by itself when the contract has lines
    await click('Add a line');
    const names = document.body.querySelectorAll<HTMLInputElement>('input[placeholder="e.g. Health"]');
    const name = names[names.length - 1]; // the new, empty row
    await type(name, 'Health');
    const row = name.closest('.grid') as HTMLElement;
    await type(row.querySelector<HTMLInputElement>('input[type="number"]')!, '4');
    await click('Save changes');
    await waitFor(() => expect(updateContract).toHaveBeenCalledTimes(1));
    const form = updateContract.mock.calls[0][1] as unknown as { deductionLines: { name: string; kind: string; mode: string; basis: string; value: number }[] };
    expect(form.deductionLines).toEqual([
      { name: 'Income tax', kind: 'deduction', basis: 'gross', mode: 'percent', value: 10 },
      { name: 'Health', kind: 'deduction', basis: 'gross', mode: 'percent', value: 4 },
    ]);
  });

  it('refuses a deduction line with no name or a percentage above 100', async () => {
    stored.push(existing());
    await mount(<ContractDialog employee={emp} canEdit onClose={() => {}} />);
    await waitFor(() => hasText('Deductions and contributions (optional)'));
    await click('Deductions and contributions (optional)');
    await click('Add a line');
    await click('Save changes');
    await waitFor(() => hasText('needs a name'));
    const name = document.body.querySelector<HTMLInputElement>('input[placeholder="e.g. Health"]')!;
    await type(name, 'Too much');
    await type((name.closest('.grid') as HTMLElement).querySelector<HTMLInputElement>('input[type="number"]')!, '150');
    await click('Save changes');
    await waitFor(() => hasText('more than 100'));
    expect(updateContract).not.toHaveBeenCalled();
  });

  it('is read-only when the viewer cannot edit', async () => {
    stored.push(existing());
    await mount(<ContractDialog employee={emp} canEdit={false} onClose={() => {}} />);
    await waitFor(() => hasText('How this person is paid'));
    expect(findText('Save changes')).toBeUndefined();
    expect(inputByValue('USD')!.disabled).toBe(true);
  });
});
