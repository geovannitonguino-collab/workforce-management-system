import React, { useCallback, useEffect, useState } from 'react';
import { addHoliday, deleteHoliday, getHolidays, getOrgSettings, setOrgSettings } from '@/lib/store';
import type { Holiday } from '@/lib/store';
import { formatDate } from '@/lib/calculations';
import { AMERICAS, AMERICAS_CURRENCIES, findCountry } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, Loader2, Trash2 } from 'lucide-react';

const COMMON_ZONES = [
  'America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo',
  'America/Montevideo', 'America/Caracas', 'America/Guayaquil', 'America/Panama', 'America/Costa_Rica', 'America/Guatemala',
  'America/Santo_Domingo', 'America/Puerto_Rico', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'UTC',
];

/** Director-only: company time zone, country, default currency and the list of holiday dates. */
export default function CompanyCalendar() {
  const [tz, setTz] = useState('UTC');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [org, hs] = await Promise.all([getOrgSettings(), getHolidays()]);
    if (org) { setTz(org.timeZone); setCountry(org.country ?? ''); setCurrency(org.defaultCurrency ?? ''); }
    setHolidays(hs);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setBusy(true); setMsg(null);
    try { await setOrgSettings(tz.trim(), country.trim(), currency.trim()); setMsg({ ok: true, text: 'Saved.' }); }
    catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      setMsg({ ok: false, text: m.includes('time zone') ? 'That time zone does not exist. Use a name like America/Bogota.' : m.includes('currency') ? 'The currency must be a 3-letter code, for example USD.' : 'Could not save.' });
    } finally { setBusy(false); }
  };
  const add = async () => {
    if (!date) return;
    setBusy(true); setMsg(null);
    try { await addHoliday(date, name); setDate(''); setName(''); await load(); }
    catch { setMsg({ ok: false, text: 'That date is already in the list, or it could not be saved.' }); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => { setBusy(true); try { await deleteHoliday(id); await load(); } finally { setBusy(false); } };

  if (!loaded) return null;
  return (
    <div className="stat-card space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Company calendar and settings</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Choosing a country fills in its currency and time zone; you can change either, for example if you pay everyone in US dollars. The time zone decides what counts as night and which day an hour belongs to. Holiday dates are the days paid with the holiday percentages in each person's contract.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Time zone</Label>
          <Input list="tz-list" value={tz} onChange={e => setTz(e.target.value)} />
          <datalist id="tz-list">{COMMON_ZONES.map(z => <option key={z} value={z} />)}</datalist>
        </div>
        <div>
          <Label>Country</Label>
          <Input list="country-list" value={country} maxLength={60} placeholder="Pick or type a country"
            onChange={e => {
              setCountry(e.target.value);
              const c = findCountry(e.target.value);
              if (c) { setCurrency(c.currency); setTz(c.timeZone); } // pre-fill, still editable
            }} />
          <datalist id="country-list">{AMERICAS.map(c => <option key={c.name} value={c.name} />)}</datalist>
        </div>
        <div>
          <Label>Default currency</Label>
          <Input list="currency-list" value={currency} maxLength={3} placeholder="USD" onChange={e => setCurrency(e.target.value.toUpperCase())} />
          <datalist id="currency-list">{AMERICAS_CURRENCIES.map(c => <option key={c} value={c} />)}</datalist>
        </div>
      </div>
      <Button size="sm" onClick={saveSettings} disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Save settings</Button>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <p className="text-sm font-medium">Holidays</p>
        {holidays.length === 0 && <p className="text-xs text-muted-foreground">No holidays yet.</p>}
        <div className="flex flex-wrap gap-2">
          {holidays.map(h => (
            <span key={h.id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 pl-3 pr-1.5 py-0.5 text-xs">
              {formatDate(h.date)}{h.name ? ` · ${h.name}` : ''}
              <button aria-label={`Remove ${h.date}`} className="p-1 text-destructive" disabled={busy} onClick={() => remove(h.id)}><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div><Label className="text-xs">Date</Label><Input type="date" className="h-8" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">Name (optional)</Label><Input className="h-8" value={name} maxLength={100} onChange={e => setName(e.target.value)} /></div>
          <Button size="sm" className="h-8" onClick={add} disabled={!date || busy}>Add holiday</Button>
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? 'text-success' : 'text-destructive'}`}>{msg.text}</p>}
    </div>
  );
}
