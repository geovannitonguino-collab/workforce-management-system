import React, { useCallback, useEffect, useState } from 'react';
import { AuditEvent, Employee, TimeCorrection } from '@/types/workforce';
import { getAuditLog, getTimeCorrections, resolveTimeCorrection } from '@/lib/store';
import { formatDate, formatTime } from '@/lib/calculations';
import { ACTION_LABELS } from '@/components/TimeCorrections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, FilePenLine, ScrollText, Loader2 } from 'lucide-react';

interface Props { employees: Employee[]; onResolved?: () => void; showAudit?: boolean; }

export default function AdminCorrections({ employees, onResolved, showAudit: canSeeAudit = true }: Props) {
  const [items, setItems] = useState<TimeCorrection[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([getTimeCorrections(), canSeeAudit ? getAuditLog(50) : Promise.resolve([] as AuditEvent[])]);
    setItems(c.filter(x => x.status === 'pending'));
    setAudit(a);
  }, [canSeeAudit]);
  useEffect(() => { load(); }, [load]);

  const name = (id?: string) => employees.find(e => e.id === id)?.name ?? 'System';

  const resolve = async (c: TimeCorrection, approve: boolean) => {
    setBusy(c.id); setError(null);
    try {
      await resolveTimeCorrection(c.id, approve, notes[c.id]);
      await load();
      onResolved?.();
    } catch {
      setError('Could not resolve this request. It may already be resolved or the original punch changed.');
    } finally { setBusy(null); }
  };

  const describe = (c: TimeCorrection) =>
    c.kind === 'add' ? `Add ${c.action ? ACTION_LABELS[c.action] : 'punch'} at ${formatTime(c.requestedTimestamp!)} on ${formatDate(c.requestedDate!)}`
    : c.kind === 'edit' ? `Change a punch to ${formatTime(c.requestedTimestamp!)} on ${formatDate(c.requestedDate!)}`
    : 'Remove a punch';

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="stat-card border-secondary/50 bg-accent/50">
          <div className="flex items-center gap-2 mb-3">
            <FilePenLine className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold">Time Correction Requests</h3>
            <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">{items.length} pending</span>
          </div>
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}
          <div className="space-y-2">
            {items.map(c => (
              <div key={c.id} className="bg-card border border-secondary/40 rounded-xl p-3.5 space-y-2">
                <p className="text-sm font-semibold">{name(c.employeeId)}</p>
                <p className="text-sm">{describe(c)}</p>
                <p className="text-xs text-muted-foreground">"{c.reason}"</p>
                <div className="flex gap-2 items-center">
                  <Input className="h-8 text-xs" placeholder="Note (optional)" value={notes[c.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))} />
                  <Button size="sm" className="h-8 gap-1" disabled={busy === c.id} onClick={() => resolve(c, true)}>
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy === c.id} onClick={() => resolve(c, false)}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canSeeAudit && <div className="stat-card">
        <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowAudit(s => !s)}>
          <ScrollText className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Audit Log</h3>
          <span className="ml-auto text-xs text-muted-foreground">{showAudit ? 'Hide' : `Show last ${audit.length}`}</span>
        </button>
        {showAudit && (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Event</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(a.createdAt)} {formatTime(a.createdAt)}</TableCell>
                    <TableCell className="text-xs">{name(a.actorId)}</TableCell>
                    <TableCell className="text-xs font-medium">{a.event}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate" title={JSON.stringify(a.details)}>{JSON.stringify(a.details)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>}
    </div>
  );
}
