import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClockStatus, ClockAction, TimeEntry } from '@/types/workforce';
import { store } from '@/lib/store';
import { getToday, formatTime } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, Coffee, Utensils, LogIn, LogOut } from 'lucide-react';

interface Segment {
  action: ClockAction;
  start: string;
  end?: string;
  durationMs: number;
  label: string;
  type: 'work' | 'lunch' | 'break';
}

function deriveSegments(entries: TimeEntry[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const next = entries[i + 1];
    const endTime = next ? next.timestamp : undefined;
    const durationMs = endTime
      ? new Date(endTime).getTime() - new Date(entry.timestamp).getTime()
      : 0;

    let type: Segment['type'] = 'work';
    let label = 'Work';
    switch (entry.action) {
      case 'clock_in': type = 'work'; label = 'Work'; break;
      case 'start_lunch': type = 'lunch'; label = 'Lunch'; break;
      case 'end_lunch': type = 'work'; label = 'Work'; break;
      case 'start_break': type = 'break'; label = 'Break'; break;
      case 'end_break': type = 'work'; label = 'Work'; break;
      case 'clock_out': type = 'work'; label = 'Clocked Out'; break;
    }

    segments.push({ action: entry.action, start: entry.timestamp, end: endTime, durationMs, label, type });
  }
  return segments;
}

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

function formatDurationMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface Props {
  employeeId: string;
  dailyGoalHours?: number;
  onUpdate?: () => void;
}

export default function TimeClock({ employeeId, dailyGoalHours = 8, onUpdate }: Props) {
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

  const lastEntry = status.todayEntries.length > 0
    ? status.todayEntries[status.todayEntries.length - 1]
    : null;

  const currentSegmentElapsed = lastEntry && status.isClockedIn
    ? Math.max(0, Math.floor((now.getTime() - new Date(lastEntry.timestamp).getTime()) / 1000))
    : 0;

  const hours = Math.floor(currentSegmentElapsed / 3600);
  const mins = Math.floor((currentSegmentElapsed % 3600) / 60);
  const secs = currentSegmentElapsed % 60;

  const timingLabel = status.isOnLunch ? 'TIMING LUNCH' : status.isOnBreak ? 'TIMING BREAK' : status.isClockedIn ? 'TIMING WORK SESSION' : 'OFF CLOCK';
  const timerColor = status.isOnLunch
    ? 'text-amber-500'
    : status.isOnBreak
      ? 'text-blue-400'
      : status.isClockedIn
        ? 'text-emerald-500'
        : 'text-muted-foreground';
  const timerBgColor = status.isOnLunch
    ? 'bg-amber-500/10'
    : status.isOnBreak
      ? 'bg-blue-400/10'
      : status.isClockedIn
        ? 'bg-emerald-500/10'
        : 'bg-muted/30';

  const segments = useMemo(() => deriveSegments(status.todayEntries), [status.todayEntries]);

  // Totals by type (completed segments only)
  const totals = useMemo(() => {
    let workMs = 0, breakMs = 0, lunchMs = 0;
    for (const seg of segments) {
      if (seg.end && seg.action !== 'clock_out') {
        if (seg.type === 'work') workMs += seg.durationMs;
        else if (seg.type === 'break') breakMs += seg.durationMs;
        else if (seg.type === 'lunch') lunchMs += seg.durationMs;
      }
    }
    // Add live segment
    if (status.isClockedIn && lastEntry) {
      const liveMs = currentSegmentElapsed * 1000;
      if (status.isOnLunch) lunchMs += liveMs;
      else if (status.isOnBreak) breakMs += liveMs;
      else workMs += liveMs;
    }
    const paidMs = workMs + breakMs;
    return { workMs, breakMs, lunchMs, paidMs };
  }, [segments, status.isClockedIn, status.isOnLunch, status.isOnBreak, currentSegmentElapsed, lastEntry]);

  const goalMs = dailyGoalHours * 3600 * 1000;
  const progressPercent = Math.min(100, (totals.paidMs / goalMs) * 100);

  const statusLabel = status.isOnLunch ? 'On Lunch' : status.isOnBreak ? 'On Break' : status.isClockedIn ? 'Working' : 'Off Clock';
  const statusColor = status.isOnLunch ? 'text-amber-500' : status.isOnBreak ? 'text-blue-400' : status.isClockedIn ? 'text-emerald-500' : 'text-muted-foreground';

  return (
    <div className="stat-card space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Time Clock
        </h3>
        <span className={`text-sm font-medium ${statusColor}`}>
          {status.isClockedIn && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
          {statusLabel}
        </span>
      </div>

      {status.isClockedIn && (
        <div className={`text-center py-4 rounded-lg ${timerBgColor} transition-colors duration-300`}>
          <p className={`text-xs uppercase tracking-widest font-bold mb-1 ${timerColor}`}>
            {timingLabel}
          </p>
          <p className={`text-4xl font-mono font-bold tabular-nums ${timerColor} transition-colors duration-300`}>
            {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Total Paid Time: <span className="font-mono font-bold text-foreground">{formatDurationMs(totals.paidMs)}</span>
          </p>
        </div>
      )}

      {/* Daily Progress Bar */}
      {status.isClockedIn && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Daily Progress</span>
            <span className="font-mono font-semibold text-foreground">{formatDurationMs(totals.paidMs)} / {dailyGoalHours}h</span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />
          <p className="text-[10px] text-muted-foreground text-right">{progressPercent.toFixed(0)}% of {dailyGoalHours}h goal</p>
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

      {segments.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Today's Log</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {segments.map((seg, i) => {
              const isLive = !seg.end && status.isClockedIn && seg.action !== 'clock_out';
              const segColor = seg.type === 'lunch' ? 'text-amber-500' : seg.type === 'break' ? 'text-blue-400' : 'text-emerald-500';
              const displayDuration = isLive ? formatDurationMs(currentSegmentElapsed * 1000) : formatDurationMs(seg.durationMs);

              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${seg.type === 'lunch' ? 'bg-amber-500' : seg.type === 'break' ? 'bg-blue-400' : 'bg-emerald-500'}`} />
                    <span className="text-muted-foreground">{seg.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTime(seg.start)}{seg.end ? ` → ${formatTime(seg.end)}` : ''}
                    </span>
                    <span className={`font-mono font-semibold text-xs ${segColor}`}>
                      {seg.action === 'clock_out' ? '—' : displayDuration}
                      {isLive && <span className="ml-1 animate-pulse">●</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daily Total Summary */}
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Daily Totals</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-emerald-500/10 p-2">
                <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-medium">Work</p>
                <p className="font-mono font-bold text-sm text-emerald-500">{formatDurationMs(totals.workMs)}</p>
              </div>
              <div className="rounded-md bg-blue-400/10 p-2">
                <p className="text-[10px] uppercase tracking-wider text-blue-400 font-medium">Breaks</p>
                <p className="font-mono font-bold text-sm text-blue-400">{formatDurationMs(totals.breakMs)}</p>
              </div>
              <div className="rounded-md bg-amber-500/10 p-2">
                <p className="text-[10px] uppercase tracking-wider text-amber-500 font-medium">Lunch</p>
                <p className="font-mono font-bold text-sm text-amber-500">{formatDurationMs(totals.lunchMs)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Paid Time <span className="text-emerald-500">(Work + Breaks)</span></p>
              </div>
              <p className="font-mono font-bold text-lg text-foreground">{formatDurationMs(totals.paidMs)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Unpaid Time <span className="text-amber-500">(Lunch)</span></p>
              <p className="font-mono font-semibold text-sm text-amber-500">{formatDurationMs(totals.lunchMs)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}