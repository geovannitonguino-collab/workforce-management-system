import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PRIVACY, TERMS, Lang, LegalDoc } from '@/lib/legal';
import geovannixLogo from '@/assets/geovannix-logo.png';

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{doc.title}</h1>
        <p className="text-xs text-muted-foreground mt-1">{doc.updated}</p>
        <p className="text-sm text-muted-foreground mt-3">{doc.intro}</p>
      </header>
      {doc.sections.map(s => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
          {s.body.map((p, i) => <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>)}
        </section>
      ))}
    </article>
  );
}

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const [lang, setLang] = useState<Lang>(navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en');
  const doc = (kind === 'terms' ? TERMS : PRIVACY)[lang];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={geovannixLogo} alt="Geovannix" className="h-9" />
            <span className="text-base font-bold text-foreground">Geovannix</span>
          </Link>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button size="sm" variant={lang === 'es' ? 'default' : 'ghost'} onClick={() => setLang('es')}>ES</Button>
            <Button size="sm" variant={lang === 'en' ? 'default' : 'ghost'} onClick={() => setLang('en')}>EN</Button>
          </div>
        </div>
      </header>
      <main className="container max-w-3xl py-8 space-y-8">
        <LegalDocView doc={doc} />
        <nav className="flex gap-4 text-sm border-t border-border pt-4">
          <Link className="text-primary underline" to="/terms">{TERMS[lang].title}</Link>
          <Link className="text-primary underline" to="/privacy">{PRIVACY[lang].title}</Link>
        </nav>
      </main>
    </div>
  );
}
