import React, { useEffect, useState } from 'react';
import { Department, Employee, roleLabel } from '@/types/workforce';
import { getDirectory, getTimeEntries } from '@/lib/store';
import { calculateDailySummary, formatHours, getCurrentPeriod } from '@/lib/calculations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';

interface Props { teamIds: string[]; departments: Department[]; }
type Row = { id: string; name: string; departmentId?: string; role: Employee['role']; hours: number };

/** Manager-only, read-only: attendance of the whole company this month. No pay data. */
export default function CompanyOverview({ teamIds, departments }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const [dir, entries] = await Promise.all([getDirectory(), getTimeEntries()]);
      const period = getCurrentPeriod();
      setRows(dir.map(p => {
        const mine = entries.filter(e => e.employeeId === p.id);
        const dates = [...new Set(mine.filter(e => e.date.startsWith(period)).map(e => e.date))];
        const hours = dates.reduce((s, d) => s + calculateDailySummary(mine, p.id, d).netWorkHours, 0);
        return { ...p, hours };
      }));
    })();
  }, []);

  if (!rows || rows.length === 0) return null;
  const team = new Set(teamIds);

  return (
    <div className="stat-card space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Company overview</h3>
        <span className="ml-auto text-xs text-muted-foreground">Read-only · hours this month</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {['Name', 'Department', 'Role', 'Hours'].map(h => (
                <TableHead key={h} className={`font-semibold text-xs ${h === 'Hours' ? 'text-right' : ''}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium">
                  {r.name}{team.has(r.id) && <span className="ml-2 text-[10px] rounded-full bg-violet-50 text-violet-700 px-2 py-0.5">your team</span>}
                </TableCell>
                <TableCell className="text-sm">{departments.find(d => d.id === r.departmentId)?.name ?? '—'}</TableCell>
                <TableCell className="text-sm">{roleLabel(r.role)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatHours(r.hours)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
