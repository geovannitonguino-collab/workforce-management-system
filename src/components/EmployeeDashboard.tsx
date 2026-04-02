import React, { useState } from 'react';
import { Employee } from '@/types/workforce';
import TimeClock from '@/components/TimeClock';
import LeaveBalanceCard from '@/components/LeaveBalanceCard';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import PayrollEstimate from '@/components/PayrollEstimate';
import LeaveHistory from '@/components/LeaveHistory';
import LeaveAnalytics from '@/components/LeaveAnalytics';
import { User, Briefcase, Mail, CalendarDays } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/calculations';

interface Props {
  employee: Employee;
}

export default function EmployeeDashboard({ employee }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6 animate-fade-in" key={refreshKey}>
      {/* Profile header */}
      <div className="stat-card flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{employee.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{employee.department}</span>
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{employee.email}</span>
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Hired {formatDate(employee.hireDate)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{formatCurrency(employee.hourlyRate)}</p>
          <p className="text-xs text-muted-foreground">per hour</p>
        </div>
      </div>

      {/* Analytics full width */}
      <LeaveAnalytics employee={employee} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <TimeClock employeeId={employee.id} onUpdate={refresh} />
          <LeaveRequestForm employee={employee} onSubmit={refresh} />
        </div>
        <div className="space-y-6">
          <PayrollEstimate employee={employee} />
          <LeaveBalanceCard employee={employee} />
          <LeaveHistory employee={employee} />
        </div>
      </div>
    </div>
  );
}
