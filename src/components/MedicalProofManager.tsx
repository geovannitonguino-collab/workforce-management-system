import React, { useState, useRef, useEffect } from 'react';
import { MedicalProof } from '@/types/workforce';
import { getMedicalProofs, addMedicalProof, updateMedicalProof, deleteMedicalProof } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/calculations';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Upload, Trash2, Edit, Eye, X, Check, Loader2 } from 'lucide-react';

interface Props { leaveRequestId: string; onUpdate?: () => void; }

export default function MedicalProofManager({ leaveRequestId, onUpdate }: Props) {
  const [proofs, setProofs] = useState<MedicalProof[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const updated = await getMedicalProofs(leaveRequestId);
    setProofs(updated);
    onUpdate?.();
  };

  useEffect(() => { refresh(); }, [leaveRequestId]);

  const readFile = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error('Read failed'));
      r.readAsDataURL(file);
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('PDF files only.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB.'); return; }
    setUploading(true);
    try {
      const data = await readFile(file);
      await addMedicalProof({ id: crypto.randomUUID(), leaveRequestId, fileName: file.name, fileData: data, uploadedAt: new Date().toISOString() });
      await refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReplace = async (proofId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('PDF files only.'); return; }
    setUploading(true);
    try {
      const data = await readFile(file);
      await updateMedicalProof(proofId, { fileName: file.name, fileData: data, uploadedAt: new Date().toISOString() });
      setEditingId(null);
      await refresh();
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteMedicalProof(deleteTarget);
    setDeleteTarget(null);
    await refresh();
  };

  return (
    <div className="space-y-3">
      <div>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="outline" size="sm" className="w-full"
          onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
            : <><Upload className="h-4 w-4" /> Upload Medical Proof (PDF)</>}
        </Button>
      </div>

      {proofs.length > 0 && (
        <div className="space-y-2">
          {proofs.map(proof => (
            <div key={proof.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{proof.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(proof.uploadedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewUrl(proof.fileData)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {editingId === proof.id ? (
                  <>
                    <input ref={replaceRef} type="file" accept=".pdf" className="hidden" onChange={e => handleReplace(proof.id, e)} />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => replaceRef.current?.click()}>
                      <Check className="h-3.5 w-3.5 text-success" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(proof.id)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(proof.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-card rounded-xl shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h4 className="font-semibold">Medical Proof Preview</h4>
              <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border border-border" title="Medical Proof" />
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medical Proof?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
