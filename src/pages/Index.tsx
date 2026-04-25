import React, { useState, useEffect } from 'react';
import { getEmployees } from '@/lib/store';
import { AppView, Employee } from '@/types/workforce';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Users, User, Loader2, LayoutDashboard } from 'lucide-react';
import geovannixLogo from '@/assets/geovannix-logo.png';

const CURRENT_USER_KEY = 'wms_current_user_id';

export default function Index() {
  const [view, setView] = useState<AppView>('employee');
  const [currentUserId, setCurrentUserId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const emps = await getEmployees();
        setEmployees(emps);
        const savedId = localStorage.getItem(CURRENT_USER_KEY);
        const defaultId = savedId && emps.find(e => e.id === savedId) ? savedId : emps[0]?.id ?? '';
        setCurrentUserId(defaultId);
      } catch (e) {
        setError('Failed to load data. Check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentEmployee = employees.find(e => e.id === currentUserId);

  const switchUser = (id: string) => {
    setCurrentUserId(id);
    localStorage.setItem(CURRENT_USER_KEY, id);
    const emp = employees.find(e => e.id === id);
    if (emp?.role === 'admin') setView('admin');
    else setView('employee');
  };

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
            <Button variant={view === 'admin' ? 'default' : 'ghost'} size="sm" onClick={() => setView('admin')}>
              <LayoutDashboard className="h-4 w-4" /> Admin
            </Button>
          </div>

          <Select value={currentUserId} onValueChange={switchUser} disabled={loading}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={loading ? 'Loading...' : 'Select user'} />
            </SelectTrigger>
            <SelectContent>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}{emp.role === 'admin' ? ' (Admin)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="container py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Connecting to Supabase…</span>
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
          <p className="text-muted-foreground text-center py-20">Select a user to get started.</p>
        )}
      </main>
    </div>
  );
}
