import { ContractTerms, Relationship, Surcharges } from '@/types/contract';

export const NO_SURCHARGES: Surcharges = {
  night: 0, holiday: 0, holidayNight: 0, otDay: 0, otNight: 0, otHolidayDay: 0, otHolidayNight: 0,
};

/**
 * Starting point for the form. A contractor gets no legal extras at all (no overtime, surcharges or
 * vacation accrual): just an agreed pay. Every value can be changed by whoever fills in the form.
 */
export function blankContract(relationship: Relationship, effectiveFrom: string, currency = 'USD'): ContractTerms {
  return {
    effectiveFrom,
    relationship,
    contractType: relationship === 'contractor' ? 'Service provision (contractor)' : 'Indefinite term',
    payType: relationship === 'contractor' ? 'fixed' : 'hourly',
    payPeriod: 'monthly',
    amount: 0,
    currency,
    schedule: { 0: 0, 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0 },
    overtimeEligible: false,
    overtimeBasis: 'none',
    nightStart: '21:00',
    nightEnd: '06:00',
    holidayWeekdays: [0],
    surcharges: { ...NO_SURCHARGES },
    unpaidDayDivisor: 30,
    vacationDaysPerMonth: 0,
    ptoHoursPerYear: 0,
  };
}
