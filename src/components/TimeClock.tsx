import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClockStatus, ClockAction, TimeEntry } from '@/types/workforce';
import { getTimeEntries, addTimeEntry } from '@/lib/store';
import { getToday, formatTime } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, Coffee, Utensils, LogIn, LogOut } from 'lucide-react';

function deriveClockStatus(entries: TimeEntry[]): ClockStatus {
  const today = getToday();
  const todayEntries = entries
    .filter(e => e.date === today)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let isClockedIn = false, isOnLunch = false, isOnBreak = false;
  let currentSessionStart: string | undefined;
  for (const entry of todayEntries) {
    switch (entry.action) {
      case 'clock_in':    isClockedIn = true; currentSessionStart = entry.timestamp; break;
      case 'start_lunch': isOnLunch = true; break;
      case 'end_lunch':   isOnLunch = false; break;
      case 'start_break': isOnBreak = true; break;
      case 'end_break':   isOnBreak = false; break;
      case 'clock_out':   isClockedIn = false; isOnLunch = false; isOnBreak = false; break;
    }
  }
  return { isClockedIn, isOnLunch, isOnBreak, currentSessionStart, todayEntries };
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

interface Props { employeeId: string; dailyGoalHours?: number; onUpdate?: () => void; }

export default function TimeClock({ employeeId, dailyGoalHours = 8, onUpdate }: Props) {
  const [status, setStatus] = useState<ClockStatus>({ isClockedIn: false, isOnLunch: false, isOnBreak: false, todayEntries: [] });
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const entries = await getTimeEntries(employeeId);
    setStatus(deriveClockStatus(entries));
  }, [employeeId]);

  // Bug fix #9: reset timer when employeeId changes
  useEffect(() => {
    refresh();
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [refresh, employeeId]);

  const recordAction = async (action: ClockAction) => {
    setLoading(true);
    try {
      await addTimeEntry({ employeeId, action, timestamp: new Date().toISOString(), date: getToday() });
      await refresh();
      onUpdate?.();
    } finally { setLoading(false); }
  };

  const lastEntry = status.todayEntries.at(-1) ?? null;
  const elapsed = lastEntry && status.isClockedIn
    ? Math.max(0, Math.floor((now.getTime() - new Date(lastEntry.timestamp).getTime()) / 1000)) : 0;
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;

  const timerColor   = status.isOnLunch ? 'text-amber-500' : status.isOnBreak ? 'text-blue-400' : status.isClockedIn ? 'text-emerald-500' : 'text-muted-foreground';
  const timerBg     = status.isOnLunch ? 'bg-amber-500/10' : status.isOnBreak ? 'bg-blue-400/10' : status.isClockedIn ? 'bg-emerald-500/10' : 'bg-muted/30';
  const timingLabel = status.isOnLunch ? 'TIMING LUNCH' : status.isOnBreak ? 'TIMING BREAK' : status.isClockedIn ? 'TIMING WORK SESSION' : 'OFF CLOCK';
  const statusLabel = status.isOnLunch ? 'On Lunch' : status.isOnBreak ? 'On Break' : status.isClockedIn ? 'Working' : 'Off Clock';
  const statusColor = status.isOnLunch ? 'text-amber-500' : status.isOnBreak ? 'text-blue-400' : status.isClockedIn ? 'text-emerald-500' : 'text-muted-foreground';

  // Compute totals from today's entries
  const totals = useMemo(() => {
    let workMs = 0, breakMs = 0, lunchMs = 0;
    const sorted = [...status.todayEntries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const dur = new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
      if (sorted[i].action === 'start_lunch') lunchMs += dur;
      else if (sorted[i].action === 'start_break') breakMs += dur;
      else if (['clock_in', 'end_lunch', 'end_break'].includes(sorted[i].action)) workMs += dur;
    }
    if (status.isClockedIn && lastEntry) {
      const liveMs = elapsed * 1000;
      if (status.isOnLunch) lunchMs += liveMs;
      else if (status.isOnBreak) breakMs += liveMs;
      else workMs += liveMs;
    }
    return { workMs, breakMs, lunchMs, paidMs: workMs + breakMs };
  }, [status, elapsed, lastEntry]);

  const progressPct = Math.min(100, (totals.paidMs / (dailyGoalHours * 3600000)) * 100);

  return (
    <div className="stat-card space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Time Clock
        </h3>
        <span className={`text-sm font-medium ${statusColor}`}>
          {status.isClockedIn && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
          {statusLabel}
        </span>
      </div>

      {status.isClockedIn && (
        <div className={`text-center py-4 rounded-lg ${timerBg} transition-colors duration-300`}>
          <p className={`text-xs uppercase tracking-widest font-bold mb-1 ${timerColor}`}>{timingLabel}</p>
          <p className={`text-4xl font-mono font-bold tabular-nums ${timerColor}`}>
            {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Total Paid: <span className="font-mono font-bold text-foreground">{formatMs(totals.paidMs)}</span>
          </p>
        </div>
      )}

      {status.isClockedIn && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Daily Progress</span>
            <span className="font-mono font-semibold text-foreground">{formatMs(totals.paidMs)} / {dailyGoalHours}h</span>
          </div>
          <Progress value={progressPct} className="h-2.5" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!status.isClockedIn ? (
          <Button variant="clockIn" size="lg" className="col-span-2" onClick={() => recordAction('clock_in')} disabled={loading}>
            <LogIn className="h-4 w-4" /> Clock In
          </Button>
        ) : (
          <>
            {!status.isOnLunch ? (
              <Button variant="lunch" onClick={() => recordAction('start_lunch')} disabled={status.isOnBreak || loading}>
                <Utensils className="h-4 w-4" /> Start Lunch
              </Button>
            ) : (
              <Button variant="lunch" onClick={() => recordAction('end_lunch')} disabled={loading}>
                <Utensils className="h-4 w-4" /> End Lunch
              </Button>
            )}
            {!status.isOnBreak ? (
              <Button variant="breakAction" onClick={() => recordAction('start_break')} disabled={status.isOnLunch || loading}>
                <Coffee className="h-4 w-4" /> Start Break
              </Button>
            ) : (
              <Button variant="breakAction" onClick={() => recordAction('end_break')} disabled={loading}>
                <Coffee className="h-4 w-4" /> End Break
              </Button>
            )}
            <Button variant="clockOut" size="lg" className="col-span-2" onClick={() => recordAction('clock_out')} disabled={status.isOnLunch || status.isOnBreak || loading}>
              <LogOut className="h-4 w-4" /> Clock Out
            </Button>
          </>
        )}
      </div>

      {status.todayEntries.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's Log</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto text-sm">
            {status.todayEntries.map((e, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span className="capitalize">{e.action.replace(/_/g, ' ')}</span>
                <span className="font-mono text-xs">{formatTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-2">
            <div className="rounded-md bg-emerald-500/10 p-2">
              <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-medium">Work</p>
              <p className="font-mono font-bold text-sm text-emerald-500">{formatMs(totals.workMs)}</p>
            </div>
            <div className="rounded-md bg-blue-400/10 p-2">
              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-medium">Breaks</p>
              <p className="font-mono font-bold text-sm text-blue-400">{formatMs(totals.breakMs)}</p>
            </div>
            <div className="rounded-md bg-amber-500/10 p-2">
              <p className="text-[10px] uppercase tracking-wider text-amber-500 font-medium">Lunch</p>
              <p className="font-mono font-bold text-sm text-amber-500">{formatMs(totals.lunchMs)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
