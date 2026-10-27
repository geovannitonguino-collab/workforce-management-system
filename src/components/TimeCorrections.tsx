import React, { useCallback, useEffect, useState } from 'react';
import { ClockAction, CorrectionKind, Employee, TimeCorrection, TimeEntry } from '@/types/workforce';
import { addTimeCorrection, getTimeCorrections, getTimeEntries } from '@/lib/store';
import { formatDate, formatTime } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilePenLine, Loader2 } from 'lucide-react';

export const ACTION_LABELS: Record<ClockAction, string> = {
  clock_in: 'Clock in', clock_out: 'Clock out', start_lunch: 'Start lunch',
  end_lunch: 'End lunch', start_break: 'Start break', end_break: 'End break',
};
const KIND_LABELS: Record<CorrectionKind, string> = {
  add: 'Add a missing punch', edit: 'Change the time of a punch', void: 'Remove a wrong punch',
};
const statusVariant = { pending: 'secondary', approved: 'default', rejected: 'destructive' } as const;

/** yyyy-MM-ddTHH:mm in LOCAL time for <input type="datetime-local"> */
function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TimeCorrections({ employee }: { employee: Employee }) {
  const [items, setItems] = useState<TimeCorrection[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<CorrectionKind>('add');
  const [action, setAction] = useState<ClockAction>('clock_in');
  const [entryId, setEntryId] = useState('');
  const [when, setWhen] = useState(localInput(new Date()));
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const [c, e] = await Promise.all([getTimeCorrections(employee.id), getTimeEntries(employee.id)]);
    setItems(c);
    setEntries(e.slice(-40).reverse());
  }, [employee.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    setKind('add'); setAction('clock_in'); setEntryId(''); setWhen(localInput(new Date())); setReason(''); setError(null);
  }, [open]);

  const needsEntry = kind !== 'add';
  const needsTime = kind !== 'void';
  const valid = reason.trim().length >= 5 && (!needsEntry || !!entryId) && (!needsTime || !!when);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const ts = needsTime ? new Date(when) : undefined;
      await addTimeCorrection({
        employeeId: employee.id, kind, reason: reason.trim(),
        entryId: needsEntry ? entryId : undefined, action: kind === 'add' ? action : undefined,
        requestedTimestamp: ts?.toISOString(),
        requestedDate: ts ? when.slice(0, 10) : undefined,
      });
      setOpen(false);
      await load();
    } catch {
      setError('Could not send the request. Check the time (not in the future, within 60 days) and try again.');
    } finally { setSaving(false); }
  };

  const entryLabel = (id?: string) => {
    const e = entries.find(x => x.id === id);
    return e ? `${ACTION_LABELS[e.action]} · ${formatDate(e.date)} ${formatTime(e.timestamp)}` : 'a punch';
  };

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FilePenLine className="h-5 w-5 text-primary" /> Time Corrections
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="ml-auto h-8 text-xs">Request correction</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request a time correction</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-1">
              <div>
                <Label>What happened?</Label>
                <Select value={kind} onValueChange={v => setKind(v as CorrectionKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABELS) as CorrectionKind[]).map(k => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {needsEntry && (
                <div>
                  <Label>Which punch?</Label>
                  <Select value={entryId} onValueChange={setEntryId}>
                    <SelectTrigger><SelectValue placeholder="Select a punch" /></SelectTrigger>
                    <SelectContent>
                      {entries.map(e => <SelectItem key={e.id} value={e.id}>{ACTION_LABELS[e.action]} · {formatDate(e.date)} {formatTime(e.timestamp)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {kind === 'add' && (
                <div>
                  <Label>Punch type</Label>
                  <Select value={action} onValueChange={v => setAction(v as ClockAction)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABELS) as ClockAction[]).map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsTime && (
                <div>
                  <Label>{kind === 'edit' ? 'Correct time' : 'Time it should have been'}</Label>
                  <Input type="datetime-local" value={when} max={localInput(new Date())} onChange={e => setWhen(e.target.value)} />
                </div>
              )}
              <div>
                <Label>Reason</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. I forgot to clock out" rows={3} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={submit} disabled={!valid || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send to admin
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No correction requests yet.</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 6).map(c => (
            <div key={c.id} className="p-3 rounded-lg border border-border/50 bg-muted/30 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{KIND_LABELS[c.kind]}</span>
                <Badge variant={statusVariant[c.status]} className="capitalize text-xs">{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.kind === 'add' && c.action && `${ACTION_LABELS[c.action]} at ${formatTime(c.requestedTimestamp!)} on ${formatDate(c.requestedDate!)}`}
                {c.kind === 'edit' && `${entryLabel(c.entryId)} → ${formatTime(c.requestedTimestamp!)} on ${formatDate(c.requestedDate!)}`}
                {c.kind === 'void' && entryLabel(c.entryId)}
              </p>
              <p className="text-xs mt-1">"{c.reason}"</p>
              {c.resolutionNote && <p className="text-xs text-muted-foreground mt-1">Admin: {c.resolutionNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
