import React, { useState, useRef } from 'react';
import { MedicalProof } from '@/types/workforce';
import { store } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/calculations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Upload, Trash2, Edit, Eye, X, Check } from 'lucide-react';

interface Props {
  leaveRequestId: string;
  onUpdate?: () => void;
}

export default function MedicalProofManager({ leaveRequestId, onUpdate }: Props) {
  const [proofs, setProofs] = useState<MedicalProof[]>(() =>
    store.getMedicalProofsForRequest(leaveRequestId)
  );
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setProofs(store.getMedicalProofsForRequest(leaveRequestId));
    onUpdate?.();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const proof: MedicalProof = {
        id: crypto.randomUUID(),
        leaveRequestId,
        fileName: file.name,
        fileData: reader.result as string,
        uploadedAt: new Date().toISOString(),
      };
      store.addMedicalProof(proof);
      refresh();
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplace = (proofId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      store.updateMedicalProof(proofId, {
        fileName: file.name,
        fileData: reader.result as string,
        uploadedAt: new Date().toISOString(),
      });
      setEditingId(null);
      refresh();
    };
    reader.readAsDataURL(file);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      store.deleteMedicalProof(deleteTarget);
      // Also remove from leave request's proofIds
      const requests = store.getLeaveRequests();
      const req = requests.find(r => r.id === leaveRequestId);
      if (req && req.medicalProofIds) {
        store.updateLeaveRequest(leaveRequestId, {
          medicalProofIds: req.medicalProofIds.filter(id => id !== deleteTarget),
        });
      }
      setDeleteTarget(null);
      refresh();
    }
  };

  const viewProof = (proof: MedicalProof) => {
    setPreviewUrl(proof.fileData);
  };

  return (
    <div className="space-y-3">
      {/* Upload button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <Upload className="h-4 w-4" /> Upload Medical Proof (PDF)
        </Button>
      </div>

      {/* List of uploaded proofs */}
      {proofs.length > 0 && (
        <div className="space-y-2">
          {proofs.map(proof => (
            <div
              key={proof.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{proof.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(proof.uploadedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => viewProof(proof)} title="View">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {editingId === proof.id ? (
                  <>
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => handleReplace(proof.id, e)}
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => replaceInputRef.current?.click()} title="Select new file">
                      <Check className="h-3.5 w-3.5 text-success" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)} title="Cancel">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(proof.id)} title="Replace file">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(proof.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-card rounded-xl shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h4 className="font-semibold text-foreground">Medical Proof Preview</h4>
              <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border border-border" title="Medical Proof" />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medical Proof?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this medical proof? This action cannot be undone and the document will be permanently removed from the system records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
