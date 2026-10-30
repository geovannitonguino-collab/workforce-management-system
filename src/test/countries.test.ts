import { describe, it, expect } from 'vitest';
import { AMERICAS, AMERICAS_CURRENCIES, findCountry } from '@/lib/countries';

describe('Americas country list', () => {
  it('covers the 35 sovereign states of the Americas plus Puerto Rico', () => {
    expect(AMERICAS.length).toBe(36);
    expect(new Set(AMERICAS.map(c => c.name)).size).toBe(36);
    for (const must of ['Canada', 'United States', 'Mexico', 'Colombia', 'Argentina', 'Chile', 'Peru', 'Brazil', 'Puerto Rico', 'Venezuela']) {
      expect(findCountry(must)).toBeDefined();
    }
  });
  it('every currency is a 3-letter ISO code and the database accepts it', () => {
    for (const c of AMERICAS) expect(c.currency).toMatch(/^[A-Z]{3}$/);
    expect(AMERICAS_CURRENCIES).toContain('COP');
    expect(AMERICAS_CURRENCIES).toContain('USD');
  });
  it('every currency is one the browser can format (so amounts display correctly)', () => {
    for (const code of AMERICAS_CURRENCIES) {
      expect(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(1)).not.toThrow();
    }
  });
  it('every time zone exists', () => {
    for (const c of AMERICAS) expect(() => new Intl.DateTimeFormat('en-US', { timeZone: c.timeZone })).not.toThrow();
  });
  it('dollarized economies default to USD, but the list is only a default', () => {
    for (const n of ['Ecuador', 'El Salvador', 'Panama', 'Puerto Rico', 'United States']) expect(findCountry(n)!.currency).toBe('USD');
    expect(findCountry('colombia')!.currency).toBe('COP');
    expect(findCountry('  Mexico ')!.currency).toBe('MXN');
    expect(findCountry('Atlantis')).toBeUndefined();
  });
});
