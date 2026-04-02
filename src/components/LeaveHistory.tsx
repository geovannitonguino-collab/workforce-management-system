import React, { useState } from 'react';
import { Employee, LeaveRequest, MedicalProof } from '@/types/workforce';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { store } from '@/lib/store';
import { formatDate } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { History, FileText, Eye, Calendar, Clock, X, Filter, Download, FileSpreadsheet } from 'lucide-react';

interface Props {
  employee: Employee;
}

const categoryLabels: Record<string, string> = {
  pto: 'PTO',
  sick: 'Sick Leave',
  vacation: 'Vacation',
  personal: 'Personal',
};

const categoryColors: Record<string, string> = {
  pto: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sick: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  vacation: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  personal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
};

const categories = ['all', 'pto', 'sick', 'vacation', 'personal'] as const;
const statuses = ['all', 'pending', 'approved', 'rejected'] as const;

function exportToCsv(requests: LeaveRequest[], employeeName: string) {
  const headers = ['Category', 'Status', 'Start Date', 'End Date', 'Hours', 'Days', 'Unpaid Hours', 'Reason', 'Submitted'];
  const rows = requests.map((r) => [
    categoryLabels[r.category],
    r.status,
    formatDate(r.startDate),
    formatDate(r.endDate),
    r.hours,
    (r.hours / 8).toFixed(1),
    r.unpaidHours,
    `"${(r.reason || '').replace(/"/g, '""')}"`,
    formatDate(r.createdAt),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leave-history-${employeeName.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const categoryExcelColors: Record<string, { bg: string; font: string }> = {
  pto: { bg: 'FFDBEAFE', font: 'FF1E40AF' },
  sick: { bg: 'FFFED7AA', font: 'FF9A3412' },
  vacation: { bg: 'FFD1FAE5', font: 'FF065F46' },
  personal: { bg: 'FFE9D5FF', font: 'FF6B21A8' },
};

const statusExcelColors: Record<string, { bg: string; font: string }> = {
  approved: { bg: 'FFD1FAE5', font: 'FF065F46' },
  pending: { bg: 'FFFEF3C7', font: 'FF92400E' },
  rejected: { bg: 'FFFEE2E2', font: 'FF991B1B' },
};

async function exportToExcel(requests: LeaveRequest[], employeeName: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Geovannix Workforce';
  wb.created = new Date();

  const ws = wb.addWorksheet('Leave History');

  // Title row
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `Leave History — ${employeeName}`;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Subtitle
  ws.mergeCells('A2:I2');
  const subCell = ws.getCell('A2');
  subCell.value = `Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${requests.length} record(s)`;
  subCell.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
  ws.getRow(2).height = 20;

  // Headers
  const headers = ['Category', 'Status', 'Start Date', 'End Date', 'Hours', 'Days', 'Unpaid Hours', 'Reason', 'Submitted'];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
  headerRow.height = 24;

  // Data rows
  requests.forEach((r) => {
    const row = ws.addRow([
      categoryLabels[r.category],
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
      formatDate(r.startDate),
      formatDate(r.endDate),
      r.hours,
      Number((r.hours / 8).toFixed(1)),
      r.unpaidHours,
      r.reason || '',
      formatDate(r.createdAt),
    ]);

    // Category cell color
    const catColors = categoryExcelColors[r.category];
    if (catColors) {
      const catCell = row.getCell(1);
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: catColors.bg } };
      catCell.font = { bold: true, size: 10, color: { argb: catColors.font } };
    }

    // Status cell color
    const statColors = statusExcelColors[r.status];
    if (statColors) {
      const statCell = row.getCell(2);
      statCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statColors.bg } };
      statCell.font = { bold: true, size: 10, color: { argb: statColors.font } };
    }

    // Unpaid hours highlight
    if (r.unpaidHours > 0) {
      const unpaidCell = row.getCell(7);
      unpaidCell.font = { bold: true, size: 10, color: { argb: 'FFDC2626' } };
    }

    // Alternate row shading
    row.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });

    // Reason left-aligned
    row.getCell(8).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  });

  // Column widths
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 16 }, { width: 16 },
    { width: 8 }, { width: 8 }, { width: 14 }, { width: 30 }, { width: 16 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `leave-history-${employeeName.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
}

export default function LeaveHistory({ employee }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const allRequests = store
    .getLeaveRequests()
    .filter((r) => r.employeeId === employee.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const requests = allRequests.filter((r) => {
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const getProofsForRequest = (requestId: string): MedicalProof[] => {
    return store.getMedicalProofsForRequest(requestId);
  };

  if (allRequests.length === 0) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-primary" />
          Leave History
        </h3>
        <p className="text-sm text-muted-foreground text-center py-6">
          No leave requests yet. Submit your first request above.
        </p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-primary" />
        Leave History
        <span className="ml-auto flex items-center gap-2">
          <span className="text-sm font-normal text-muted-foreground">
            {requests.length}/{allRequests.length}
          </span>
          {allRequests.length > 0 && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  exportToCsv(requests, employee.name);
                }}
                title="Export filtered results to CSV"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  exportToExcel(requests, employee.name);
                }}
                title="Export filtered results to Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </Button>
            </div>
          )}
        </span>
      </h3>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
              }`}
            >
              {cat === 'all' ? 'All Types' : categoryLabels[cat]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-3.5 shrink-0" />
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                filterStatus === st
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
              }`}
            >
              {st === 'all' ? 'All Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Request list */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No requests match the selected filters.</p>
        ) : requests.map((req) => {
          const proofs = getProofsForRequest(req.id);
          return (
            <div
              key={req.id}
              className="p-3.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setSelectedRequest(req)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColors[req.category]}`}>
                  {categoryLabels[req.category]}
                </span>
                <Badge variant={statusVariant[req.status]} className="capitalize text-xs">
                  {req.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(req.startDate)} — {formatDate(req.endDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {req.hours}h ({(req.hours / 8).toFixed(1)}d)
                </span>
              </div>
              {proofs.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  {proofs.length} medical certificate{proofs.length !== 1 ? 's' : ''} attached
                </div>
              )}
              {req.unpaidHours > 0 && (
                <p className="text-xs text-destructive mt-1">
                  {req.unpaidHours}h unpaid
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Leave Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <RequestDetail
              request={selectedRequest}
              proofs={getProofsForRequest(selectedRequest.id)}
              onPreview={setPreviewUrl}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PDF preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] bg-foreground/50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-card rounded-xl shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h4 className="font-semibold text-foreground">Medical Certificate Preview</h4>
              <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border border-border" title="Medical Certificate" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestDetail({
  request,
  proofs,
  onPreview,
}: {
  request: LeaveRequest;
  proofs: MedicalProof[];
  onPreview: (url: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Category</p>
          <p className="font-medium">{categoryLabels[request.category]}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <Badge variant={statusVariant[request.status]} className="capitalize">
            {request.status}
          </Badge>
        </div>
        <div>
          <p className="text-muted-foreground">Start Date</p>
          <p className="font-medium">{formatDate(request.startDate)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">End Date</p>
          <p className="font-medium">{formatDate(request.endDate)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Hours</p>
          <p className="font-medium">{request.hours}h ({(request.hours / 8).toFixed(1)} days)</p>
        </div>
        <div>
          <p className="text-muted-foreground">Payment</p>
          <p className="font-medium">
            {request.unpaidHours > 0 ? (
              <span className="text-destructive">{request.unpaidHours}h unpaid</span>
            ) : (
              <span className="text-emerald-600">Fully paid</span>
            )}
          </p>
        </div>
      </div>

      {request.reason && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Reason</p>
          <p className="text-sm bg-muted/50 p-2.5 rounded-lg">{request.reason}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground">
          Submitted {formatDate(request.createdAt)}
        </p>
      </div>

      {/* Medical proofs */}
      {proofs.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            Medical Certificates ({proofs.length})
          </p>
          <div className="space-y-2">
            {proofs.map((proof) => (
              <div
                key={proof.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{proof.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(proof.uploadedAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onPreview(proof.fileData)}
                  title="View certificate"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
