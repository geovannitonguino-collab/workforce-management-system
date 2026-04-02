import React, { useState, useEffect, useCallback } from 'react';
import { ClockStatus, ClockAction, TimeEntry } from '@/types/workforce';
import { store } from '@/lib/store';
import { getToday, formatTime } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Clock, Coffee, Utensils, LogIn, LogOut, Pause } from 'lucide-react';

function deriveClockStatus(entries: TimeEntry[]): ClockStatus {
  const today = getToday();
  const todayEntries = entries
    .filter(e => e.date === today)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let isClockedIn = false;
  let isOnLunch = false;
  let isOnBreak = false;
  let currentSessionStart: string | undefined;

  for (const entry of todayEntries) {
    switch (entry.action) {
      case 'clock_in': isClockedIn = true; currentSessionStart = entry.timestamp; break;
      case 'start_lunch': isOnLunch = true; break;
      case 'end_lunch': isOnLunch = false; break;
      case 'start_break': isOnBreak = true; break;
      case 'end_break': isOnBreak = false; break;
      case 'clock_out': isClockedIn = false; isOnLunch = false; isOnBreak = false; break;
    }
  }

  return { isClockedIn, isOnLunch, isOnBreak, currentSessionStart, todayEntries };
}

interface Props {
  employeeId: string;
  onUpdate?: () => void;
}

export default function TimeClock({ employeeId, onUpdate }: Props) {
  const [status, setStatus] = useState<ClockStatus>({ isClockedIn: false, isOnLunch: false, isOnBreak: false, todayEntries: [] });
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(() => {
    const entries = store.getTimeEntries().filter(e => e.employeeId === employeeId);
    setStatus(deriveClockStatus(entries));
  }, [employeeId]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const recordAction = (action: ClockAction) => {
    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      employeeId,
      action,
      timestamp: new Date().toISOString(),
      date: getToday(),
    };
    store.addTimeEntry(entry);
    refresh();
    onUpdate?.();
  };

  const elapsedSinceClockIn = status.currentSessionStart
    ? Math.floor((now.getTime() - new Date(status.currentSessionStart).getTime()) / 1000)
    : 0;

  const hours = Math.floor(elapsedSinceClockIn / 3600);
  const mins = Math.floor((elapsedSinceClockIn % 3600) / 60);
  const secs = elapsedSinceClockIn % 60;

  const statusLabel = status.isOnLunch ? 'On Lunch' : status.isOnBreak ? 'On Break' : status.isClockedIn ? 'Working' : 'Off Clock';
  const statusColor = status.isOnLunch ? 'text-warning' : status.isOnBreak ? 'text-secondary' : status.isClockedIn ? 'text-success' : 'text-muted-foreground';

  return (
    <div className="stat-card space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Time Clock
        </h3>
        <span className={`text-sm font-medium ${statusColor}`}>
          {status.isClockedIn && <span className="inline-block w-2 h-2 rounded-full bg-success mr-1.5 animate-pulse" />}
          {statusLabel}
        </span>
      </div>

      {status.isClockedIn && (
        <div className="text-center py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Session Duration</p>
          <p className="text-4xl font-mono font-bold text-foreground tabular-nums">
            {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!status.isClockedIn ? (
          <Button variant="clockIn" size="lg" className="col-span-2" onClick={() => recordAction('clock_in')}>
            <LogIn className="h-4 w-4" /> Clock In
          </Button>
        ) : (
          <>
            {!status.isOnLunch ? (
              <Button variant="lunch" onClick={() => recordAction('start_lunch')} disabled={status.isOnBreak}>
                <Utensils className="h-4 w-4" /> Start Lunch
              </Button>
            ) : (
              <Button variant="lunch" onClick={() => recordAction('end_lunch')}>
                <Utensils className="h-4 w-4" /> End Lunch
              </Button>
            )}

            {!status.isOnBreak ? (
              <Button variant="breakAction" onClick={() => recordAction('start_break')} disabled={status.isOnLunch}>
                <Coffee className="h-4 w-4" /> Start Break
              </Button>
            ) : (
              <Button variant="breakAction" onClick={() => recordAction('end_break')}>
                <Coffee className="h-4 w-4" /> End Break
              </Button>
            )}

            <Button variant="clockOut" size="lg" className="col-span-2" onClick={() => recordAction('clock_out')} disabled={status.isOnLunch || status.isOnBreak}>
              <LogOut className="h-4 w-4" /> Clock Out
            </Button>
          </>
        )}
      </div>

      {status.todayEntries.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Today's Log</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {status.todayEntries.map(e => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">{e.action.replace('_', ' ')}</span>
                <span className="font-mono text-foreground">{formatTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
