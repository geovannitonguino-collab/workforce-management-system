import React, { useState, useEffect } from 'react';
import { store, initializeStore } from '@/lib/store';
import { AppView, Employee } from '@/types/workforce';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Users, User } from 'lucide-react';
import geovannixLogo from '@/assets/geovannix-logo.png';

export default function Index() {
  const [view, setView] = useState<AppView>('employee');
  const [currentUserId, setCurrentUserId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    initializeStore();
    const emps = store.getEmployees();
    setEmployees(emps);
    setCurrentUserId(store.getCurrentUserId());
  }, []);

  const currentEmployee = employees.find(e => e.id === currentUserId);

  const switchUser = (id: string) => {
    setCurrentUserId(id);
    store.setCurrentUserId(id);
    const emp = employees.find(e => e.id === id);
    if (emp?.role === 'admin') setView('admin');
    else setView('employee');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={geovannixLogo} alt="Geovannix" className="h-9" />
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">Geovannix</h1>
              <p className="text-xs text-muted-foreground">Workforce Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={view === 'employee' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('employee')}
              >
                <User className="h-4 w-4" /> Employee
              </Button>
              <Button
                variant={view === 'admin' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('admin')}
              >
                <Users className="h-4 w-4" /> Admin
              </Button>
            </div>

            <Select value={currentUserId} onValueChange={switchUser}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} {emp.role === 'admin' && '(Admin)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        {view === 'employee' && currentEmployee ? (
          <EmployeeDashboard employee={currentEmployee} />
        ) : view === 'admin' ? (
          <AdminDashboard />
        ) : (
          <p className="text-muted-foreground text-center py-20">Select a user to get started.</p>
        )}
      </main>
    </div>
  );
}
