import React, { useMemo } from 'react';
import { Employee, LeaveRequest } from '@/types/workforce';
import { store } from '@/lib/store';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface Props {
  employee: Employee;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  pto: { label: 'PTO', color: 'hsl(214, 80%, 28%)' },
  sick: { label: 'Sick Leave', color: 'hsl(24, 85%, 48%)' },
  vacation: { label: 'Vacation', color: 'hsl(152, 60%, 40%)' },
  personal: { label: 'Personal', color: 'hsl(270, 60%, 50%)' },
};

const STATUS_COLORS: Record<string, string> = {
  approved: 'hsl(152, 60%, 40%)',
  pending: 'hsl(38, 92%, 50%)',
  rejected: 'hsl(0, 72%, 51%)',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function LeaveAnalytics({ employee }: Props) {
  const requests = useMemo(() =>
    store.getLeaveRequests().filter((r) => r.employeeId === employee.id),
    [employee.id]
  );

  const year = new Date().getFullYear();
  const thisYearRequests = requests.filter(
    (r) => new Date(r.createdAt).getFullYear() === year
  );

  // --- By category (pie) ---
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    thisYearRequests.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.hours;
    });
    return Object.entries(map).map(([cat, hours]) => ({
      name: CATEGORY_CONFIG[cat]?.label || cat,
      value: hours,
      color: CATEGORY_CONFIG[cat]?.color || '#888',
    }));
  }, [thisYearRequests]);

  // --- By month (bar) ---
  const byMonth = useMemo(() => {
    const data = MONTHS.map((m) => ({ month: m, pto: 0, sick: 0, vacation: 0, personal: 0 }));
    thisYearRequests.forEach((r) => {
      const monthIdx = new Date(r.createdAt).getMonth();
      if (data[monthIdx]) {
        data[monthIdx][r.category as keyof typeof data[0]] += r.hours;
      }
    });
    return data;
  }, [thisYearRequests]);

  // --- By status (pie) ---
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    thisYearRequests.forEach((r) => {
      map[r.status] = (map[r.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: STATUS_COLORS[status] || '#888',
    }));
  }, [thisYearRequests]);

  const totalHours = thisYearRequests.reduce((s, r) => s + r.hours, 0);

  if (requests.length === 0) {
    return (
      <div className="stat-card">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          Leave Analytics — {year}
        </h3>
        <p className="text-sm text-muted-foreground text-center py-6">
          No data yet. Submit leave requests to see analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
        <BarChart3 className="h-5 w-5 text-primary" />
        Leave Analytics — {year}
      </h3>
      <p className="text-xs text-muted-foreground mb-5">
        {thisYearRequests.length} request(s) · {totalHours}h total · {(totalHours / 8).toFixed(1)} days
      </p>

      {/* Monthly stacked bar chart */}
      <div className="mb-6">
        <p className="text-sm font-medium text-foreground mb-3">Hours by Month</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215, 14%, 46%)" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 14%, 46%)" />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid hsl(214, 20%, 90%)',
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `${value}h`,
                CATEGORY_CONFIG[name]?.label || name,
              ]}
            />
            <Legend
              formatter={(value: string) => CATEGORY_CONFIG[value]?.label || value}
              wrapperStyle={{ fontSize: 11 }}
            />
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <Bar key={key} dataKey={key} stackId="a" fill={cfg.color} radius={key === 'personal' ? [3, 3, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-foreground mb-2 text-center">By Category</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={byCategory}
                cx="50%" cy="50%"
                innerRadius={40} outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}h`}
                labelLine={false}
              >
                {byCategory.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}h`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-2 text-center">By Status</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={byStatus}
                cx="50%" cy="50%"
                innerRadius={40} outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {byStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
