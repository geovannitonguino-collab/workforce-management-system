import React, { useEffect, useState } from 'react';
import { getPlans, PlanInfo } from '@/lib/store';
import { CONTACT_EMAIL } from '@/lib/legal';
import { formatMoney } from '@/lib/payrollRun';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Copy, Loader2 } from 'lucide-react';

interface Props { open: boolean; currentPlanId?: string; /** people to price by default */ people?: number; onClose: () => void; }

/** price = base + per person x people */
export const planTotal = (base: number | undefined, perPerson: number | undefined, people: number) =>
  base === undefined ? undefined : base + (perPerson ?? 0) * Math.max(0, people);

/** The plans on offer. Online payment is not connected yet, so choosing a plan tells the person how to contact us. */
export default function PlansDialog({ open, currentPlanId, people: initialPeople = 10, onClose }: Props) {
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [chosen, setChosen] = useState<PlanInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [people, setPeople] = useState(Math.max(1, initialPeople));

  useEffect(() => {
    if (!open) return;
    setChosen(null); setCopied(false); setPeople(Math.max(1, initialPeople));
    getPlans().then(list => setPlans([...list].sort((a, b) => a.sortOrder - b.sortOrder)));
  }, [open, initialPeople]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(CONTACT_EMAIL); setCopied(true); } catch { setCopied(false); }
  };
  const priced = (plans ?? []).some(p => p.baseUsd !== undefined);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Plans</DialogTitle></DialogHeader>
        {!plans ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {priced && (
              <div className="flex items-center gap-2 text-sm">
                <Label htmlFor="plan-people">How many people?</Label>
                <Input id="plan-people" type="number" min={1} className="h-8 w-24" value={people}
                  onChange={e => setPeople(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                <span className="text-xs text-muted-foreground">Everyone with a contract counts.</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map(p => {
                const current = p.id === currentPlanId;
                const usd = planTotal(p.baseUsd, p.perPersonUsd, people);
                const cop = planTotal(p.baseCop, p.perPersonCop, people);
                return (
                  <div key={p.id} className={`rounded-xl border p-4 space-y-2 ${current ? 'border-primary bg-primary/5' : 'border-border/60'}`}>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{p.name}</h4>
                      {current && <span className="text-[10px] font-semibold rounded-full bg-primary text-primary-foreground px-2 py-0.5">Your plan</span>}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    <div>
                      {usd !== undefined ? (
                        <>
                          <p className="text-2xl font-bold">{formatMoney(usd, 'USD')}<span className="text-xs font-normal text-muted-foreground"> / month for {people}</span></p>
                          {cop !== undefined && <p className="text-sm text-muted-foreground">{formatMoney(cop, 'COP')} / month in Colombia</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatMoney(p.baseUsd!, 'USD')} base + {formatMoney(p.perPersonUsd ?? 0, 'USD')} per person
                            {p.baseCop !== undefined && <> · {formatMoney(p.baseCop, 'COP')} + {formatMoney(p.perPersonCop ?? 0, 'COP')} in Colombia</>}
                          </p>
                        </>
                      ) : p.trialDays > 0 ? <p className="text-lg font-semibold">Free</p>
                        : <p className="text-lg font-semibold text-muted-foreground">Contact us for the price</p>}
                    </div>
                    <p className="text-xs flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" />{p.maxEmployees ? `Up to ${p.maxEmployees} people` : 'No limit on people'}</p>
                    {p.trialDays > 0 && <p className="text-xs flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" />{p.trialDays}-day free trial</p>}
                    {!current && p.trialDays === 0 && <Button size="sm" className="w-full" onClick={() => setChosen(p)}>Choose {p.name}</Button>}
                  </div>
                );
              })}
            </div>

            {chosen && (
              <div className="rounded-xl border border-border/60 p-4 space-y-2 text-sm">
                <p className="font-medium">To switch to {chosen.name}, write to us:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1">{CONTACT_EMAIL}</code>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={copy}><Copy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy address'}</Button>
                  <a className="text-primary underline text-xs" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Trackly plan: ' + chosen.name + ' (' + people + ' people)')}`}>Open my email app</a>
                </div>
                <p className="text-xs text-muted-foreground">Say the plan, how many people, and your company name. Online payment will be available soon.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
