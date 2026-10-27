import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptTerms } from '@/lib/store';
import { CONTACT_EMAIL, TERMS_VERSION } from '@/lib/legal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

/** Blocks the app until the person accepts the current Terms and Privacy Policy. */
export default function TermsGate({ onAccepted, onSignOut }: { onAccepted: () => void; onSignOut: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true); setError(null);
    try { await acceptTerms(TERMS_VERSION); onAccepted(); }
    catch { setError('Could not save your acceptance. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto stat-card space-y-4 mt-10">
      <h2 className="text-lg font-semibold">Términos y Privacidad / Terms and Privacy</h2>
      <p className="text-sm text-muted-foreground">
        Para usar Trackly debes aceptar los Términos de Servicio y la Política de Privacidad.
        <br />To use Trackly you must accept the Terms of Service and the Privacy Policy.
      </p>
      <div className="flex gap-4 text-sm">
        <Link className="text-primary underline" to="/terms" target="_blank">Términos / Terms</Link>
        <Link className="text-primary underline" to="/privacy" target="_blank">Privacidad / Privacy</Link>
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <Checkbox checked={checked} onCheckedChange={v => setChecked(v === true)} className="mt-0.5" />
        <span>He leído y acepto los Términos y la Política de Privacidad. / I have read and accept the Terms and the Privacy Policy.</span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!checked || busy} onClick={accept}>
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Aceptar / Accept
        </Button>
        <Button variant="outline" onClick={onSignOut}>Salir / Sign out</Button>
      </div>
      <p className="text-xs text-muted-foreground">{CONTACT_EMAIL}</p>
    </div>
  );
}
