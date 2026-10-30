import React, { useEffect, useState } from 'react';
import { getPlans, PlanInfo } from '@/lib/store';
import { CONTACT_EMAIL } from '@/lib/legal';
import { formatMoney } from '@/lib/payrollRun';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Copy, Loader2 } from 'lucide-react';

interface Props { open: boolean; currentPlanId?: string; onClose: () => void; }

/** The plans on offer. Online payment is not connected yet, so choosing a plan tells the person how to contact us. */
export default function PlansDialog({ open, currentPlanId, onClose }: Props) {
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [chosen, setChosen] = useState<PlanInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChosen(null); setCopied(false);
    getPlans().then(list => setPlans([...list].sort((a, b) => a.sortOrder - b.sortOrder)));
  }, [open]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(CONTACT_EMAIL); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Plans</DialogTitle></DialogHeader>
        {!plans ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map(p => {
                const current = p.id === currentPlanId;
                return (
                  <div key={p.id} className={`rounded-xl border p-4 space-y-2 ${current ? 'border-primary bg-primary/5' : 'border-border/60'}`}>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{p.name}</h4>
                      {current && <span className="text-[10px] font-semibold rounded-full bg-primary text-primary-foreground px-2 py-0.5">Your plan</span>}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    <div>
                      {p.priceUsd !== undefined ? (
                        <>
                          <p className="text-2xl font-bold">{formatMoney(p.priceUsd, 'USD')}<span className="text-xs font-normal text-muted-foreground"> / month</span></p>
                          {p.priceCop !== undefined && <p className="text-sm text-muted-foreground">{formatMoney(p.priceCop, 'COP')} / month in Colombia</p>}
                        </>
                      ) : <p className="text-lg font-semibold text-muted-foreground">Contact us for the price</p>}
                    </div>
                    <p className="text-xs flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-600" />{p.maxEmployees ? `Up to ${p.maxEmployees} people` : 'Unlimited people'}</p>
                    {p.trialDays > 0 && <p className="text-xs flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-600" />{p.trialDays}-day free trial</p>}
                    {!current && p.id !== 'trial' && <Button size="sm" className="w-full" onClick={() => setChosen(p)}>Choose {p.name}</Button>}
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
                  <a className="text-primary underline text-xs" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Trackly plan: ' + chosen.name)}`}>Open my email app</a>
                </div>
                <p className="text-xs text-muted-foreground">Say the plan you want and your company name. Online payment will be available soon.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
