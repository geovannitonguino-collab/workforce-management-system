import React, { useEffect, useState } from 'react';
import { getClockPolicy, getMyIp, setClockPolicy } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Wifi, X } from 'lucide-react';

/** Admin-only: restrict punching to the workplace network. */
export default function ClockNetworkSettings() {
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ips, setIps] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [myIp, setMyIp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [p, ip] = await Promise.all([getClockPolicy(), getMyIp()]);
      if (p) { setEnabled(p.enabled); setIps(p.ips); setAllowed(true); }
      setMyIp(ip);
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !allowed) return null;

  const add = (value: string) => {
    const v = value.trim();
    if (v && !ips.includes(v)) setIps([...ips, v]);
    setDraft('');
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await setClockPolicy(enabled, ips);
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      setMsg({ ok: false, text: m.includes('invalid IP') ? 'One of the addresses is not valid.' : m.includes('at least one') ? 'Add at least one address before turning this on.' : 'Could not save. Try again.' });
    } finally { setSaving(false); }
  };

  const mineListed = myIp ? ips.includes(myIp) : false;

  return (
    <div className="stat-card space-y-3">
      <div className="flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Clock-in network</h3>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{enabled ? 'Only from these networks' : 'Anywhere'}</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        When on, employees can only punch from the public IP addresses below (your workplace internet).
        Anyone else can still ask for a correction. Open this page from the workplace and press "Add my current network".
      </p>

      <div className="flex flex-wrap gap-2">
        {ips.length === 0 && <span className="text-xs text-muted-foreground">No addresses yet.</span>}
        {ips.map(ip => (
          <span key={ip} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-mono">
            {ip}
            <button aria-label={`Remove ${ip}`} onClick={() => setIps(ips.filter(x => x !== ip))}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input className="h-8 w-56 text-xs font-mono" placeholder="203.0.113.10 or 203.0.113.0/24" value={draft}
          onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && add(draft)} />
        <Button size="sm" variant="outline" className="h-8" onClick={() => add(draft)} disabled={!draft.trim()}>Add</Button>
        <Button size="sm" variant="outline" className="h-8" onClick={() => myIp && add(myIp)} disabled={!myIp || mineListed}>
          Add my current network{myIp ? ` (${myIp})` : ''}
        </Button>
      </div>

      {enabled && myIp && !mineListed && (
        <p className="text-xs text-amber-700">
          Your current connection ({myIp}) is not in the list, so you could not punch from here. That is fine if you are not at the workplace.
        </p>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-destructive'}`}>{msg.text}</p>}
      <Button size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Save
      </Button>
    </div>
  );
}
