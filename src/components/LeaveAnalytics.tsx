import React, { useState, useEffect, useMemo } from 'react';
import { Employee, LeaveRequest } from '@/types/workforce';
import { getLeaveRequests } from '@/lib/store';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, Loader2 } from 'lucide-react';

interface Props { employee: Employee; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_CONFIG: Record<string, { label: string; color: string }> = {
  pto:      { label: 'PTO',        color: 'hsl(214,80%,28%)' },
  sick:     { label: 'Sick Leave', color: 'hsl(24,85%,48%)' },
  vacation: { label: 'Vacation',   color: 'hsl(152,60%,40%)' },
  personal: { label: 'Personal',   color: 'hsl(270,60%,50%)' },
};
const STATUS_COLORS: Record<string, string> = {
  approved: 'hsl(152,60%,40%)', pending: 'hsl(38,92%,50%)', rejected: 'hsl(0,72%,51%)',
};

export default function LeaveAnalytics({ employee }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const reqs = await getLeaveRequests(employee.id);
      setRequests(reqs);
      setLoading(false);
    })();
  }, [employee.id]);

  const year = new Date().getFullYear();

  // Bug fix #1: filter and group by startDate (actual leave), not createdAt (submission)
  const thisYear = useMemo(() =>
    requests.filter(r => new Date(r.startDate).getFullYear() === year),
    [requests, year]
  );

  const byMonth = useMemo(() => {
    const data = MONTHS.map(m => ({ month: m, pto: 0, sick: 0, vacation: 0, personal: 0 } as Record<string, string|number>));
    thisYear.forEach(r => {
      const idx = new Date(r.startDate).getMonth();
      if (data[idx]) (data[idx][r.category] as number) += r.hours;
    });
    return data;
  }, [thisYear]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    thisYear.forEach(r => { map[r.category] = (map[r.category] || 0) + r.hours; });
    return Object.entries(map).map(([cat, hours]) => ({
      name: CAT_CONFIG[cat]?.label || cat, value: hours, color: CAT_CONFIG[cat]?.color || '#888',
    }));
  }, [thisYear]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    thisYear.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1), value: count, color: STATUS_COLORS[status] || '#888',
    }));
  }, [thisYear]);

  const totalHours = thisYear.reduce((s, r) => s + r.hours, 0);

  if (loading) return (
    <div className="stat-card flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (requests.length === 0) return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" /> Leave Analytics — {year}
      </h3>
      <p className="text-sm text-muted-foreground text-center py-6">No data yet. Submit leave requests to see analytics.</p>
    </div>
  );

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
        <BarChart3 className="h-5 w-5 text-primary" /> Leave Analytics — {year}
      </h3>
      <p className="text-xs text-muted-foreground mb-5">
        {thisYear.length} request(s) · {totalHours}h total · {(totalHours / 8).toFixed(1)} days
      </p>

      <div className="mb-6">
        <p className="text-sm font-medium text-foreground mb-3">Hours by Month</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number, name: string) => [`${v}h`, CAT_CONFIG[name]?.label || name]} />
            <Legend formatter={(v: string) => CAT_CONFIG[v]?.label || v} wrapperStyle={{ fontSize: 11 }} />
            {Object.entries(CAT_CONFIG).map(([key, cfg]) => (
              <Bar key={key} dataKey={key} stackId="a" fill={cfg.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[{ title: 'By Category', data: byCategory }, { title: 'By Status', data: byStatus }].map(({ title, data }) => (
          <div key={title}>
            <p className="text-sm font-medium text-foreground mb-2 text-center">{title}</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => title === 'By Category' ? `${v}h` : v} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
