import { describe, it, expect } from "vitest";
import { calculateDailySummary } from "@/lib/calculations";
import { TimeEntry } from "@/types/workforce";

describe("calculateDailySummary", () => {
  it("accumulates hours across multiple clock_in/clock_out sessions in the same day", () => {
    const entries: TimeEntry[] = [
      { id: "1", employeeId: "e1", action: "clock_in", timestamp: "2026-01-05T09:00:00", date: "2026-01-05" },
      { id: "2", employeeId: "e1", action: "clock_out", timestamp: "2026-01-05T12:00:00", date: "2026-01-05" },
      { id: "3", employeeId: "e1", action: "clock_in", timestamp: "2026-01-05T13:00:00", date: "2026-01-05" },
      { id: "4", employeeId: "e1", action: "clock_out", timestamp: "2026-01-05T17:00:00", date: "2026-01-05" },
    ];

    const summary = calculateDailySummary(entries, "e1", "2026-01-05");

    expect(summary.netWorkHours).toBe(7);
    expect(summary.netWorkMinutes).toBe(420);
  });
});
