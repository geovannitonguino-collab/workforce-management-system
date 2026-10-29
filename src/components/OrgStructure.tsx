import React, { useState } from 'react';
import { Department, Employee, isDirectorRole, roleLabel } from '@/types/workforce';
import { addDepartment, deleteDepartment, updateDepartment, updateEmployee } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Network, Trash2, Loader2 } from 'lucide-react';

const NONE = '__none__';
type Role = 'director' | 'manager' | 'employee';

interface Props { employees: Employee[]; departments: Department[]; onChange: () => void | Promise<void>; }

/** Director-only: departments, who heads them, and each person's role and department. */
export default function OrgStructure({ employees, departments, onChange }: Props) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managers = employees.filter(e => e.role === 'manager');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); await onChange(); }
    catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      setError(
        m.includes('at least one director') ? 'The organization must keep at least one director.'
        : m.includes('department head') ? 'A department can only be headed by someone with the Manager role.'
        : m.includes('duplicate') || m.includes('uniq') ? 'A department with that name already exists.'
        : 'Could not save the change.');
    } finally { setBusy(null); }
  };

  const setRole = (emp: Employee, role: Role) => run(`role-${emp.id}`, () => updateEmployee(emp.id, { role }));
  const setDept = (emp: Employee, id: string) => run(`dept-${emp.id}`, async () => {
    const dept = departments.find(d => d.id === id);
    await updateEmployee(emp.id, { departmentId: id, department: dept?.name });
  });

  return (
    <div className="stat-card space-y-5">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Organization structure</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        A manager edits and approves only the people of the departments they head. Everyone else in the company they see read-only, without pay data.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <p className="text-sm font-medium">Departments</p>
        {departments.length === 0 && <p className="text-xs text-muted-foreground">No departments yet. Create the first one below.</p>}
        {departments.map(d => (
          <div key={d.id} className="flex items-center gap-2 flex-wrap rounded-lg border border-border/60 p-2.5">
            <span className="text-sm font-medium min-w-[8rem]">{d.name}</span>
            <span className="text-xs text-muted-foreground">
              {employees.filter(e => e.departmentId === d.id).length} people
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={d.managerEmployeeId ?? NONE}
                onValueChange={v => run(`mgr-${d.id}`, () => updateDepartment(d.id, { managerEmployeeId: v === NONE ? null : v }))}
              >
                <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="No manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No manager</SelectItem>
                  {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive"
                aria-label={`Delete ${d.name}`} disabled={busy === `del-${d.id}`}
                onClick={() => { if (confirm(`Delete department "${d.name}"? Its people stay in the company without a department.`)) run(`del-${d.id}`, () => deleteDepartment(d.id)); }}
              >
                {busy === `del-${d.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ))}
        {managers.length === 0 && departments.length > 0 && (
          <p className="text-xs text-muted-foreground">To appoint a department head, first set someone's role to Manager below.</p>
        )}
        <div className="flex gap-2 pt-1">
          <Input className="h-8 text-xs max-w-xs" placeholder="New department name" value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && newName.trim() && run('add', async () => { await addDepartment(newName); setNewName(''); })} />
          <Button size="sm" className="h-8" disabled={!newName.trim() || busy === 'add'}
            onClick={() => run('add', async () => { await addDepartment(newName); setNewName(''); })}>
            {busy === 'add' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Add department
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">People</p>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {['Name', 'Role', 'Department'].map(h => <TableHead key={h} className="font-semibold text-xs">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell className="text-sm font-medium">{emp.name}</TableCell>
                  <TableCell>
                    <Select value={isDirectorRole(emp.role) ? 'director' : emp.role} onValueChange={v => setRole(emp, v as Role)} disabled={busy === `role-${emp.id}`}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue>{roleLabel(emp.role)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="director">Director</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {departments.length > 0 ? (
                      <Select value={emp.departmentId ?? undefined} onValueChange={v => setDept(emp, v)} disabled={busy === `dept-${emp.id}`}>
                        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="No department" /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs text-muted-foreground">{emp.department}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
