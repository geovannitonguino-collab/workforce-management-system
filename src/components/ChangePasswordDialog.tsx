import React, { useEffect, useState } from 'react';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { KeyRound, Loader2 } from 'lucide-react';

export default function ChangePasswordDialog() {
  const { changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setCurrent(''); setNext(''); setConfirm(''); setError(null); setDone(false); }
  }, [open]);

  const submit = async () => {
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const err = await changePassword(current, next);
    setBusy(false);
    if (err) setError(err); else setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Change password"><KeyRound className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Password updated. / Contraseña actualizada.</p>
            <Button className="w-full" onClick={() => setOpen(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div><Label>Current password</Label><Input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></div>
            <div>
              <Label>New password</Label>
              <Input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <div><Label>Confirm new password</Label><Input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={submit} disabled={busy || !current || !next || !confirm}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Update password
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
