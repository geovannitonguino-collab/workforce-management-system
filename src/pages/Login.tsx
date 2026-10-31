import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import geovannixLogo from '@/assets/geovannix-logo.png';

export default function Login() {
  const { signIn, sendPasswordReset, linkError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'forgot'>(linkError ? 'forgot' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'signin') {
      setError(await signIn(email.trim(), password));
    } else {
      await sendPasswordReset(email.trim());
      setSent(true);
    }
    setBusy(false);
  };

  const switchMode = (m: 'signin' | 'forgot') => { setMode(m); setError(null); setSent(false); };

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-primary text-primary-foreground p-12">
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.22]" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          <defs><pattern id="ledger" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 40H40M40 0V40" stroke="currentColor" strokeWidth=".5" fill="none" /></pattern></defs>
          <rect width="400" height="600" fill="url(#ledger)" />
          <circle cx="300" cy="140" r="120" fill="none" stroke="hsl(36 94% 56%)" strokeWidth="1.2" />
          <circle cx="300" cy="140" r="80" fill="none" stroke="hsl(36 94% 56%)" strokeWidth=".8" />
          <path d="M0 460C90 400 160 520 260 430S360 360 400 380" fill="none" stroke="hsl(36 94% 56%)" strokeWidth="1.6" />
        </svg>
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-card p-2"><img src={geovannixLogo} alt="Geovannix" className="h-8" /></span>
          <span className="font-serif text-xl">Trackly</span>
        </div>
        <div className="relative max-w-md">
          <p className="display-num text-5xl xl:text-6xl leading-[1.02] font-medium">Horas claras.<br /><span className="text-secondary">Nómina sin sorpresas.</span></p>
          <p className="mt-6 text-primary-foreground/75 text-base leading-relaxed">Equipos, contratos y pagos en un solo lugar, con las reglas que tu empresa define.</p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">by Geovannix</p>
      </aside>
      <div className="flex items-center justify-center p-4 sm:p-8">
      <form onSubmit={submit} className="stat-card w-full max-w-sm space-y-4 rise">
        <div className="flex items-center gap-2">
          <img src={geovannixLogo} alt="Geovannix" className="h-9" />
          <div>
            <h1 className="font-serif text-lg font-semibold leading-none">Trackly</h1>
            <p className="text-xs text-muted-foreground">by Geovannix</p>
          </div>
        </div>

        {linkError && (
          <p className="text-sm text-destructive">
            That link is invalid, expired or was already used. Request a new one below.
            <br />El enlace no es válido, caducó o ya se usó. Pide uno nuevo aquí abajo.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        {mode === 'signin' ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
            <button type="button" className="text-xs text-primary underline w-full text-center" onClick={() => switchMode('forgot')}>
              Forgot your password? / ¿Olvidaste tu contraseña?
            </button>
          </>
        ) : (
          <>
            {sent ? (
              <p className="text-sm text-muted-foreground">
                If that email has an account, we sent a link to create a new password. Check your inbox and spam folder.
                <br />Si ese correo tiene una cuenta, enviamos un enlace para crear una contraseña nueva.
              </p>
            ) : (
              <Button type="submit" className="w-full" disabled={busy || !email}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link / Enviar enlace'}
              </Button>
            )}
            <button type="button" className="text-xs text-primary underline w-full text-center" onClick={() => switchMode('signin')}>
              Back to sign in / Volver
            </button>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center">
          <Link className="underline" to="/terms">Términos / Terms</Link> · <Link className="underline" to="/privacy">Privacidad / Privacy</Link>
        </p>
      </form>
      </div>
    </div>
  );
}
