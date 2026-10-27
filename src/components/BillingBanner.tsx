import React, { useEffect, useState } from 'react';
import { BillingStatus } from '@/types/workforce';
import { getBillingStatus } from '@/lib/store';
import { formatDate } from '@/lib/calculations';
import { CONTACT_EMAIL } from '@/lib/legal';
import { CreditCard } from 'lucide-react';

function daysLeft(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/** Admin-only plan/usage strip. Payments are not wired yet, so it only informs. */
export default function BillingBanner() {
  const [b, setB] = useState<BillingStatus | null>(null);
  useEffect(() => { getBillingStatus().then(setB); }, []);
  if (!b) return null;

  const usage = b.maxEmployees ? `${b.employeeCount}/${b.maxEmployees} employees` : `${b.employeeCount} employees`;
  const warn = b.effective === 'expired' || b.effective === 'past_due' || !b.canAddEmployees;

  let message = '';
  if (b.effective === 'trialing') message = `Free trial: ${daysLeft(b.trialEndsAt)} day(s) left (ends ${formatDate(b.trialEndsAt!)}).`;
  else if (b.effective === 'expired') message = 'Your plan has expired. Time clock and leave requests keep working, but you cannot add employees.';
  else if (b.effective === 'past_due') message = 'Your last payment failed. Please update your payment method.';
  else if (b.status === 'canceled') message = `Subscription canceled. Access continues until ${formatDate(b.currentPeriodEnd ?? b.trialEndsAt ?? new Date().toISOString())}.`;
  else message = 'Subscription active.';
  if (!warn && b.maxEmployees && b.employeeCount >= b.maxEmployees) message += ' Employee limit reached.';

  return (
    <div className={`stat-card flex items-center gap-3 ${warn ? 'border-amber-200 bg-amber-50/40' : ''}`}>
      <CreditCard className={`h-5 w-5 shrink-0 ${warn ? 'text-amber-500' : 'text-primary'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{b.planName} · {usage}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      <a className="text-xs text-primary underline shrink-0" href={`mailto:${CONTACT_EMAIL}?subject=Trackly%20plan`}>Change plan</a>
    </div>
  );
}
