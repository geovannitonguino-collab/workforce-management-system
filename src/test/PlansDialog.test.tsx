import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// the paid plan exactly as loaded in the database
const plans = [
  { id: 'trackly', name: 'Trackly', description: 'Hours, leave, contracts and pay.', trialDays: 0, baseUsd: 79, perPersonUsd: 6, baseCop: 250000, perPersonCop: 12000, sortOrder: 1 },
  { id: 'trial', name: 'Free trial', description: 'Try everything.', maxEmployees: 10, trialDays: 14, sortOrder: 0 },
  { id: 'enterprise', name: 'Enterprise', trialDays: 0, sortOrder: 2 },
];
vi.mock('@/lib/store', () => ({ getPlans: vi.fn(async () => plans) }));

import PlansDialog, { planTotal } from '@/components/PlansDialog';

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
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => { Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } }); });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

describe('plan price = base + per person', () => {
  it('matches the agreed price list', () => {
    expect(planTotal(79, 6, 3)).toBe(97);
    expect(planTotal(79, 6, 10)).toBe(139);
    expect(planTotal(79, 6, 20)).toBe(199);
    expect(planTotal(79, 6, 50)).toBe(379);
    expect(planTotal(79, 6, 100)).toBe(679);
    expect(planTotal(250000, 12000, 3)).toBe(286000);
    expect(planTotal(250000, 12000, 20)).toBe(490000);
    expect(planTotal(250000, 12000, 50)).toBe(850000);
    expect(planTotal(undefined, 6, 5)).toBeUndefined();
  });
});

describe('PlansDialog', () => {
  it('shows the price for the company size in USD and COP, in order, and the formula', async () => {
    await mount(<PlansDialog open currentPlanId="trial" people={20} onClose={() => {}} />);
    await waitFor(() => hasText('$199.00'));
    hasText('COP');
    hasText('490,000');
    hasText('$79.00 base + $6.00 per person');
    const names = Array.from(document.body.querySelectorAll('h4')).map(h => h.textContent);
    expect(names).toEqual(['Free trial', 'Trackly', 'Enterprise']);
    hasText('No limit on people');
    hasText('14-day free trial');
    hasText('Contact us for the price'); // the plan with no price
  });

  it('recalculates when the number of people changes', async () => {
    await mount(<PlansDialog open currentPlanId="trial" people={3} onClose={() => {}} />);
    await waitFor(() => hasText('$97.00'));
    await type(document.getElementById('plan-people') as HTMLInputElement, '50');
    await waitFor(() => hasText('$379.00'));
    hasText('850,000');
  });

  it('choosing a plan shows how to contact us, with the plan and the headcount in the email subject, and copies the address', async () => {
    await mount(<PlansDialog open currentPlanId="trial" people={20} onClose={() => {}} />);
    await waitFor(() => hasText('Choose Trackly'));
    await act(async () => { findText('Choose Trackly')!.click(); });
    hasText('To switch to Trackly, write to us');
    hasText('contacto@geovannix.com');
    const mail = (Array.from(document.body.querySelectorAll('a')).find(a => a.textContent === 'Open my email app') as HTMLAnchorElement).href;
    expect(decodeURIComponent(mail)).toContain('Trackly plan: Trackly (20 people)');
    await act(async () => { findText('Copy address')!.click(); });
    await waitFor(() => hasText('Copied'));
    expect((navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('contacto@geovannix.com');
  });

  it('does not offer to choose the current plan or the free trial', async () => {
    await mount(<PlansDialog open currentPlanId="trackly" people={5} onClose={() => {}} />);
    await waitFor(() => hasText('Your plan'));
    expect(findText('Choose Trackly')).toBeUndefined();
    expect(findText('Choose Free trial')).toBeUndefined();
  });
});
