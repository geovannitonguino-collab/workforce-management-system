import React, { useState, useEffect } from 'react';
import { Employee, LeaveRequest, MedicalProof } from '@/types/workforce';
import { getLeaveRequests, getMedicalProofs } from '@/lib/store';
import { formatDate } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, FileText, Eye, Calendar, Clock, X, Filter, Download, Loader2 } from 'lucide-react';

interface Props { employee: Employee; }

const catLabels: Record<string, string> = { pto: 'PTO', sick: 'Sick Leave', vacation: 'Vacation', personal: 'Personal' };
const catColors: Record<string, string> = {
  pto: 'bg-blue-100 text-blue-800', sick: 'bg-orange-100 text-orange-800',
  vacation: 'bg-emerald-100 text-emerald-800', personal: 'bg-purple-100 text-purple-800',
};
const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  approved: 'default', pending: 'secondary', rejected: 'destructive',
};

const CATS = ['all', 'pto', 'sick', 'vacation', 'personal'] as const;
const STATS = ['all', 'pending', 'approved', 'rejected'] as const;

function exportCSV(requests: LeaveRequest[], name: string) {
  const rows = [
    ['Category','Status','Start','End','Hours','Days','Unpaid','Reason','Submitted'],
    ...requests.map(r => [catLabels[r.category], r.status, formatDate(r.startDate), formatDate(r.endDate),
      r.hours, (r.hours/8).toFixed(1), r.unpaidHours, `"${(r.reason||'').replace(/"/g,'""')}"`, formatDate(r.createdAt)])
  ].map(r => r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([rows], { type: 'text/csv' })),
    download: `leave-${name.replace(/\s+/g,'-').toLowerCase()}.csv`,
  });
  a.click();
}

export default function LeaveHistory({ employee }: Props) {
  const [all, setAll] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [proofs, setProofs] = useState<MedicalProof[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('all');
  const [filterStat, setFilterStat] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const reqs = await getLeaveRequests(employee.id);
      setAll(reqs);
      setLoading(false);
    })();
  }, [employee.id]);

  const requests = all.filter(r => {
    if (filterCat !== 'all' && r.category !== filterCat) return false;
    if (filterStat !== 'all' && r.status !== filterStat) return false;
    return true;
  });

  const handleSelect = async (req: LeaveRequest) => {
    setSelected(req);
    setProofs(await getMedicalProofs(req.id));
  };

  if (loading) return (
    <div className="stat-card flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (all.length === 0) return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-primary" /> Leave History
      </h3>
      <p className="text-sm text-muted-foreground text-center py-6">No leave requests yet.</p>
    </div>
  );

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Leave History
        </h3>
        <span className="text-sm text-muted-foreground ml-1">({requests.length}/{all.length})</span>
        <Button variant="outline" size="sm" className="ml-auto h-7 text-xs gap-1" onClick={() => exportCSV(requests, employee.name)}>
          <Download className="h-3 w-3" /> CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {CATS.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCat === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'}`}>
              {c === 'all' ? 'All Types' : catLabels[c]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap pl-5">
          {STATS.map(s => (
            <button key={s} onClick={() => setFilterStat(s)}
              className={`text-xs px-2.5 py-1 rounded-full border capitalize transition-colors ${filterStat === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'}`}>
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No requests match filters.</p>
        ) : requests.map(req => (
          <div key={req.id} onClick={() => handleSelect(req)}
            className="p-3.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColors[req.category]}`}>{catLabels[req.category]}</span>
              <Badge variant={statusVariant[req.status]} className="capitalize text-xs">{req.status}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(req.startDate)} — {formatDate(req.endDate)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{req.hours}h ({(req.hours/8).toFixed(1)}d)</span>
            </div>
            {req.unpaidHours > 0 && <p className="text-xs text-destructive mt-1">{req.unpaidHours}h unpaid</p>}
          </div>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Leave Request Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Category</p><p className="font-medium">{catLabels[selected.category]}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={statusVariant[selected.status]} className="capitalize">{selected.status}</Badge></div>
                <div><p className="text-muted-foreground">Start</p><p className="font-medium">{formatDate(selected.startDate)}</p></div>
                <div><p className="text-muted-foreground">End</p><p className="font-medium">{formatDate(selected.endDate)}</p></div>
                <div><p className="text-muted-foreground">Hours</p><p className="font-medium">{selected.hours}h ({(selected.hours/8).toFixed(1)} days)</p></div>
                <div><p className="text-muted-foreground">Payment</p>
                  <p className="font-medium">{selected.unpaidHours > 0
                    ? <span className="text-destructive">{selected.unpaidHours}h unpaid</span>
                    : <span className="text-emerald-600">Fully paid</span>}</p>
                </div>
              </div>
              {selected.reason && <div><p className="text-sm text-muted-foreground mb-1">Reason</p><p className="text-sm bg-muted/50 p-2.5 rounded-lg">{selected.reason}</p></div>}
              <p className="text-xs text-muted-foreground">Submitted {formatDate(selected.createdAt)}</p>
              {proofs.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> Medical Certificates ({proofs.length})</p>
                  <div className="space-y-2">
                    {proofs.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <div><p className="text-sm font-medium truncate">{p.fileName}</p><p className="text-xs text-muted-foreground">{formatDate(p.uploadedAt)}</p></div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(p.fileData)}><Eye className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF preview overlay */}
      {preview && (
        <div className="fixed inset-0 z-[60] bg-foreground/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-card rounded-xl shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h4 className="font-semibold">Medical Certificate Preview</h4>
              <Button variant="ghost" size="icon" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe src={preview} className="w-full h-[60vh] rounded-lg border border-border" title="Medical Certificate" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
