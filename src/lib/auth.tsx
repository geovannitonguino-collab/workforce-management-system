import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const MIN_PASSWORD_LENGTH = 10;

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** true while the user arrived through a password-recovery email link */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Always resolves without revealing whether the email has an account. */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Sets a new password (recovery flow). Returns an error message or null. */
  setNewPassword: (password: string) => Promise<string | null>;
  /** Verifies the current password, then sets a new one. */
  changePassword: (current: string, next: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? 'Invalid email or password.' : null;
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  const sendPasswordReset = async (email: string) => {
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    } catch {
      // swallow: the UI shows the same neutral message either way
    }
  };

  const validate = (password: string): string | null =>
    password.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null;

  const setNewPassword = async (password: string) => {
    const bad = validate(password);
    if (bad) return bad;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return 'Could not update the password. The link may have expired; request a new one.';
    setRecovering(false);
    return null;
  };

  const changePassword = async (current: string, next: string) => {
    const bad = validate(next);
    if (bad) return bad;
    const email = session?.user.email;
    if (!email) return 'Not signed in.';
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (authError) return 'Your current password is incorrect.';
    const { error } = await supabase.auth.updateUser({ password: next });
    return error ? 'Could not update the password. Try again.' : null;
  };

  return (
    <AuthContext.Provider value={{ session, loading, recovering, signIn, signOut, sendPasswordReset, setNewPassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
