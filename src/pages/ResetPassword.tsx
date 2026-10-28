import React, { useState } from 'react';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

/** Shown after the user opens the link from the password-recovery email. */
export default function ResetPassword() {
  const { setNewPassword, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    setError(await setNewPassword(pw));
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={submit} className="stat-card w-full max-w-sm space-y-4">
        <h1 className="text-lg font-semibold">Create a new password / Crea una contraseña nueva</h1>
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <Input id="new-pw" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH}
            value={pw} onChange={e => setPw(e.target.value)} />
          <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pw">Confirm password</Label>
          <Input id="confirm-pw" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save password / Guardar'}
        </Button>
        <button type="button" className="text-xs text-primary underline w-full text-center" onClick={signOut}>
          Cancel / Cancelar
        </button>
      </form>
    </div>
  );
}
