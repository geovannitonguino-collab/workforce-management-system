import React, { useState, useEffect } from 'react';
import { getEmployees } from '@/lib/store';
import { AppView, Employee } from '@/types/workforce';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import { useAuth } from '@/lib/auth';
import Login from '@/pages/Login';
import { Button } from '@/components/ui/button';
import { User, Loader2, LayoutDashboard, LogOut } from 'lucide-react';
import geovannixLogo from '@/assets/geovannix-logo.png';

export default function Index() {
  const { session, loading: authLoading, signOut } = useAuth();
  const [view, setView] = useState<AppView>('employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) { setEmployees([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        setEmployees(await getEmployees());
      } catch {
        setError('Failed to load data. Check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // RLS guarantees a non-admin only receives their own row; admins receive all.
  const currentEmployee = employees.find(e => e.userId === userId);
  const isAdmin = currentEmployee?.role === 'admin';

  useEffect(() => {
    if (isAdmin) setView('admin');
    else setView('employee');
  }, [isAdmin]);

  if (authLoading) return null;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={geovannixLogo} alt="Geovannix" className="h-9" />
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">Geovannix</h1>
              <p className="text-xs text-muted-foreground">Workforce Management</p>
            </div>
          </div>

          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button variant={view === 'employee' ? 'default' : 'ghost'} size="sm" onClick={() => setView('employee')}>
              <User className="h-4 w-4" /> Employee
            </Button>
            {isAdmin && (
              <Button variant={view === 'admin' ? 'default' : 'ghost'} size="sm" onClick={() => setView('admin')}>
                <LayoutDashboard className="h-4 w-4" /> Admin
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{currentEmployee?.name ?? session.user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-destructive">{error}</p>
          </div>
        ) : view === 'employee' && currentEmployee ? (
          <EmployeeDashboard employee={currentEmployee} onEmployeeUpdate={async () => setEmployees(await getEmployees())} />
        ) : view === 'admin' ? (
          <AdminDashboard onEmployeeChange={async () => setEmployees(await getEmployees())} />
        ) : (
          <p className="text-muted-foreground text-center py-20">Your account is not linked to an employee record. Contact your administrator.</p>
        )}
      </main>
    </div>
  );
}
