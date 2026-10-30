import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const plans = [
  { id: 'trial', name: 'Free trial', description: 'Try everything.', maxEmployees: 10, trialDays: 14, sortOrder: 0 },
  { id: 'team', name: 'Team', description: 'Small companies.', maxEmployees: 50, trialDays: 0, priceUsd: 79, priceCop: 249000, sortOrder: 2 },
  { id: 'standard', name: 'Standard', trialDays: 0, sortOrder: 1 },
];
vi.mock('@/lib/store', () => ({ getPlans: vi.fn(async () => plans) }));

import PlansDialog from '@/components/PlansDialog';

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

beforeEach(() => { Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } }); });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

describe('PlansDialog', () => {
  it('lists the plans in order with USD and COP prices, and marks the current one', async () => {
    await mount(<PlansDialog open currentPlanId="standard" onClose={() => {}} />);
    await waitFor(() => hasText('Team'));
    hasText('$79.00');
    hasText('COP');
    hasText('Up to 50 people');
    hasText('14-day free trial');
    hasText('Your plan');
    hasText('Contact us for the price'); // the plan with no price yet
    const names = Array.from(document.body.querySelectorAll('h4')).map(h => h.textContent);
    expect(names).toEqual(['Free trial', 'Standard', 'Team']);
  });

  it('choosing a plan shows how to contact us and copies the address', async () => {
    await mount(<PlansDialog open currentPlanId="trial" onClose={() => {}} />);
    await waitFor(() => hasText('Choose Team'));
    await act(async () => { findText('Choose Team')!.click(); });
    hasText('To switch to Team, write to us');
    hasText('contacto@geovannix.com');
    await act(async () => { findText('Copy address')!.click(); });
    await waitFor(() => hasText('Copied'));
    expect((navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('contacto@geovannix.com');
  });

  it('does not offer to choose the current plan or the trial', async () => {
    await mount(<PlansDialog open currentPlanId="team" onClose={() => {}} />);
    await waitFor(() => hasText('Team'));
    expect(findText('Choose Team')).toBeUndefined();
    expect(findText('Choose Free trial')).toBeUndefined();
    hasText('Choose Standard');
  });
});
