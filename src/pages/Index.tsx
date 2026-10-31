import React, { useState, useEffect } from 'react';
import { getEmployees, getOrganizationName } from '@/lib/store';
import { AppView, Employee, isDirectorRole } from '@/types/workforce';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import { useAuth } from '@/lib/auth';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import TermsGate from '@/components/TermsGate';
import { TERMS_VERSION } from '@/lib/legal';
import { Button } from '@/components/ui/button';
import { User, Loader2, LayoutDashboard, LogOut } from 'lucide-react';
import geovannixLogo from '@/assets/geovannix-logo.png';

export default function Index() {
  const { session, loading: authLoading, recovering, signOut } = useAuth();
  const [view, setView] = useState<AppView>('employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) { setEmployees([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        setEmployees(await getEmployees());
        setOrgName(await getOrganizationName());
      } catch {
        setError('Failed to load data. Check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // RLS decides what each role receives: an employee gets their own row, a manager their team, a director everyone.
  const currentEmployee = employees.find(e => e.userId === userId);
  const isDirector = isDirectorRole(currentEmployee?.role);
  const canManage = isDirector || currentEmployee?.role === 'manager';

  useEffect(() => {
    if (canManage) setView('admin');
    else setView('employee');
  }, [canManage]);

  if (authLoading) return null;
  if (recovering && session) return <ResetPassword />;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-background">
      <header className="app-header sticky top-0 z-50">
        <div className="container flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 min-h-16">
          <div className="flex items-center gap-2">
            <img src={geovannixLogo} alt="Geovannix" className="h-8 sm:h-9" />
            <div className="min-w-0">
              <h1 className="font-serif text-lg font-semibold text-foreground leading-none truncate max-w-[10rem] sm:max-w-none">{orgName ?? 'Geovannix'}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Workforce Management</p>
            </div>
          </div>

          <div className="flex gap-1 bg-muted/70 border border-border/60 rounded-full p-1 order-3 sm:order-none w-full sm:w-auto justify-center">
            <Button variant={view === 'employee' ? 'default' : 'ghost'} size="sm" onClick={() => setView('employee')}>
              <User className="h-4 w-4" /> Employee
            </Button>
            {canManage && (
              <Button variant={view === 'admin' ? 'default' : 'ghost'} size="sm" onClick={() => setView('admin')}>
                <LayoutDashboard className="h-4 w-4" /> {isDirector ? 'Admin' : 'Team'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{currentEmployee?.name ?? session.user.email}</span>
            <ChangePasswordDialog />
            <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden sm:inline"> Sign out</span></Button>
          </div>
        </div>
      </header>

      <main className="container py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-destructive">{error}</p>
          </div>
        ) : currentEmployee && currentEmployee.termsVersion !== TERMS_VERSION ? (
          <TermsGate
            onAccepted={async () => setEmployees(await getEmployees())}
            onSignOut={signOut}
          />
        ) : view === 'employee' && currentEmployee ? (
          <EmployeeDashboard employee={currentEmployee} onEmployeeUpdate={async () => setEmployees(await getEmployees())} />
        ) : view === 'admin' ? (
          <AdminDashboard currentEmployee={currentEmployee} onEmployeeChange={async () => setEmployees(await getEmployees())} />
        ) : (
          <p className="text-muted-foreground text-center py-20">Your account is not linked to an employee record. Contact your administrator.</p>
        )}
      </main>
    </div>
  );
}
