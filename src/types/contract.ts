/**
 * Employee contract terms. EVERYTHING the payroll engine calculates comes from these fields:
 * the person who loads the employee (director or manager) fills them in, and the system only applies them.
 * The country does not change the calculation logic; it only pre-fills the form (templates), and provides
 * the holiday calendar, currency and time zone.
 */

/** hourly = hours worked x rate. fixed = an agreed amount every pay period, whatever the hours. */
export type PayType = 'hourly' | 'fixed';
/** How often a 'fixed' amount is paid. 'semimonthly' = twice a month (quincena). */
export type PayPeriod = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
/** contractor = no legal extras by default (no overtime, surcharges or vacation accrual). */
export type Relationship = 'contractor' | 'employee';

/** Free label shown to people; it does not change calculations. Suggested values below, any text is allowed. */
export const SUGGESTED_CONTRACT_TYPES = [
  'Indefinite term',
  'Fixed term',
  'Service provision (contractor)',
  'Work or labor (project)',
  'Part time',
  'Other',
] as const;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

/** Extra percentage over the ordinary hour value for each kind of hour. Ordinary daytime hours pay 0 extra. */
export interface Surcharges {
  night: number;           // ordinary night hour
  holiday: number;         // ordinary hour on a Sunday/holiday
  holidayNight: number;    // night hour on a Sunday/holiday
  otDay: number;           // overtime, daytime
  otNight: number;         // overtime, night
  otHolidayDay: number;    // overtime, Sunday/holiday daytime
  otHolidayNight: number;  // overtime, Sunday/holiday night
}

export type OvertimeBasis = 'schedule' | 'fixed' | 'none';

/**
 * A deduction or contribution the COMPANY defines (income tax withholding, health, pension, a loan repayment...).
 * Trackly ships no legal tables: whoever fills in the contract types the name and the percentage or amount.
 */
export interface DeductionLine {
  name: string;
  /** 'deduction' is withheld from the person's pay; 'employer' is an extra cost the company pays on top of it */
  kind: 'deduction' | 'employer';
  /** 'gross' = everything taxable (without expense refunds); 'base' = base pay only, after unpaid days */
  basis: 'gross' | 'base';
  /** 'percent' of the basis, or a 'fixed' amount per month (prorated by days when the period is shorter) */
  mode: 'percent' | 'fixed';
  value: number;
}

export interface ContractTerms {
  effectiveFrom: string;            // YYYY-MM-DD, first day this version applies
  endDate?: string;                 // fixed-term / project contracts
  relationship: Relationship;
  contractType: string;             // free label
  payType: PayType;
  payPeriod: PayPeriod;             // used when payType = 'fixed'
  amount: number;                   // hourly rate, or the fixed amount per pay period
  currency: string;                 // ISO code, e.g. COP, USD
  /** Contracted hours for each weekday (0 = Sunday). Their sum is the weekly hours. */
  schedule: Record<Weekday, number>;
  maxDailyHours?: number;           // informational: the engine warns when exceeded
  overtimeEligible: boolean;
  overtimeBasis: OvertimeBasis;     // 'schedule' = over that weekday's scheduled hours; 'fixed' = over overtimeDailyHours
  overtimeDailyHours?: number;
  overtimeWeeklyHours?: number;     // hours beyond this per Mon-Sun week are overtime (e.g. 40 in the US)
  nightStart: string;               // 'HH:MM'
  nightEnd: string;                 // 'HH:MM'
  holidayWeekdays: Weekday[];       // weekdays paid with the holiday rates (usually [0])
  surcharges: Surcharges;
  deductionLines?: DeductionLine[];
  monthlyHoursDivisor?: number;     // hours per month used to value one hour of a fixed pay; default weekly*52/12
  unpaidDayDivisor: number;         // monthly pay / divisor = value of one unpaid day (usually 30)
  vacationDaysPerMonth: number;     // accrual
  ptoHoursPerYear: number;
}

export type LeaveInput = {
  category: 'sick' | 'pto' | 'vacation' | 'personal' | 'family' | 'other';
  startDate: string;
  endDate: string;
  hours: number;
  isPaid: boolean;
  unpaidHours: number;
  status: 'pending' | 'approved' | 'rejected';
};

export type Period = { from: string; to: string }; // YYYY-MM-DD, inclusive

export type HourKind = keyof Surcharges | 'ordinary';

export interface PayrollResult {
  period: Period;
  currency: string;
  /** Hours worked in the period, by kind. */
  hours: Record<HourKind, number>;
  totalHours: number;
  overtimeHours: number;
  pay: {
    base: number;        // prorated salary, or ordinary hourly pay
    surcharges: number;  // night / holiday extras on ordinary-time hours
    overtime: number;    // overtime hours, including their surcharge
    paidLeave: number;   // paid leave for hourly contracts (fixed pay already includes it in base)
    unpaidDeduction: number; // deduction from fixed pay for unpaid leave
    commissions: number; // commissions + bonuses entered by hand
    reimbursements: number; // expense refunds: paid, but never taxable
    deductions: number;  // manual deductions
  };
  gross: number;
  /** the lines defined in the contract, with what each one comes to in this period */
  deductionLines: { name: string; kind: 'deduction' | 'employer'; amount: number }[];
  withheld: number;              // sum of the 'deduction' lines
  net: number;                   // gross - withheld: what the person receives
  employerContributions: number; // sum of the 'employer' lines
  employerCost: number;          // gross + employer contributions: what the company really spends
  warnings: string[];
}

/** Extra pay lines the manager enters per person: commissions, bonuses, deductions, expense refunds. */
export type AdjustmentKind = 'commission' | 'bonus' | 'reimbursement' | 'deduction';
export interface PayAdjustment {
  id?: string;
  date: string;          // YYYY-MM-DD, decides the pay period it falls in
  kind: AdjustmentKind;
  amount: number;        // always positive; 'deduction' subtracts
  note?: string;
}

/** A contract version as stored: the terms plus bookkeeping fields. */
export interface ContractRecord extends ContractTerms {
  id: string;
  employeeId: string;
  tracksTime: boolean;   // false = this person does not need to clock hours
  note?: string;
  createdBy?: string;
  createdAt: string;
}

/** What the contract form edits and saves. */
export type ContractFormValues = ContractTerms & { tracksTime: boolean; note?: string };

export interface OrgSettings {
  timeZone: string;
  country?: string;
  defaultCurrency?: string;
}
