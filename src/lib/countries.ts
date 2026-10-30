/**
 * Countries of the Americas with their local currency and the time zone of the main business city.
 * Choosing a country only PRE-FILLS the company settings and new contracts; everything stays editable
 * (many companies pay in US dollars whatever their country).
 */
export interface CountryInfo {
  name: string;
  /** ISO 4217 currency code of the local currency in everyday use */
  currency: string;
  /** IANA time zone of the main business city; large countries have several, the company can change it */
  timeZone: string;
  region: 'North America' | 'Central America' | 'Caribbean' | 'South America';
}

export const AMERICAS: CountryInfo[] = [
  // North America
  { name: 'Canada', currency: 'CAD', timeZone: 'America/Toronto', region: 'North America' },
  { name: 'United States', currency: 'USD', timeZone: 'America/New_York', region: 'North America' },
  { name: 'Mexico', currency: 'MXN', timeZone: 'America/Mexico_City', region: 'North America' },
  // Central America
  { name: 'Belize', currency: 'BZD', timeZone: 'America/Belize', region: 'Central America' },
  { name: 'Costa Rica', currency: 'CRC', timeZone: 'America/Costa_Rica', region: 'Central America' },
  { name: 'El Salvador', currency: 'USD', timeZone: 'America/El_Salvador', region: 'Central America' },
  { name: 'Guatemala', currency: 'GTQ', timeZone: 'America/Guatemala', region: 'Central America' },
  { name: 'Honduras', currency: 'HNL', timeZone: 'America/Tegucigalpa', region: 'Central America' },
  { name: 'Nicaragua', currency: 'NIO', timeZone: 'America/Managua', region: 'Central America' },
  { name: 'Panama', currency: 'USD', timeZone: 'America/Panama', region: 'Central America' },
  // Caribbean
  { name: 'Antigua and Barbuda', currency: 'XCD', timeZone: 'America/Antigua', region: 'Caribbean' },
  { name: 'Bahamas', currency: 'BSD', timeZone: 'America/Nassau', region: 'Caribbean' },
  { name: 'Barbados', currency: 'BBD', timeZone: 'America/Barbados', region: 'Caribbean' },
  { name: 'Cuba', currency: 'CUP', timeZone: 'America/Havana', region: 'Caribbean' },
  { name: 'Dominica', currency: 'XCD', timeZone: 'America/Dominica', region: 'Caribbean' },
  { name: 'Dominican Republic', currency: 'DOP', timeZone: 'America/Santo_Domingo', region: 'Caribbean' },
  { name: 'Grenada', currency: 'XCD', timeZone: 'America/Grenada', region: 'Caribbean' },
  { name: 'Haiti', currency: 'HTG', timeZone: 'America/Port-au-Prince', region: 'Caribbean' },
  { name: 'Jamaica', currency: 'JMD', timeZone: 'America/Jamaica', region: 'Caribbean' },
  { name: 'Puerto Rico', currency: 'USD', timeZone: 'America/Puerto_Rico', region: 'Caribbean' },
  { name: 'Saint Kitts and Nevis', currency: 'XCD', timeZone: 'America/St_Kitts', region: 'Caribbean' },
  { name: 'Saint Lucia', currency: 'XCD', timeZone: 'America/St_Lucia', region: 'Caribbean' },
  { name: 'Saint Vincent and the Grenadines', currency: 'XCD', timeZone: 'America/St_Vincent', region: 'Caribbean' },
  { name: 'Trinidad and Tobago', currency: 'TTD', timeZone: 'America/Port_of_Spain', region: 'Caribbean' },
  // South America
  { name: 'Argentina', currency: 'ARS', timeZone: 'America/Argentina/Buenos_Aires', region: 'South America' },
  { name: 'Bolivia', currency: 'BOB', timeZone: 'America/La_Paz', region: 'South America' },
  { name: 'Brazil', currency: 'BRL', timeZone: 'America/Sao_Paulo', region: 'South America' },
  { name: 'Chile', currency: 'CLP', timeZone: 'America/Santiago', region: 'South America' },
  { name: 'Colombia', currency: 'COP', timeZone: 'America/Bogota', region: 'South America' },
  { name: 'Ecuador', currency: 'USD', timeZone: 'America/Guayaquil', region: 'South America' },
  { name: 'Guyana', currency: 'GYD', timeZone: 'America/Guyana', region: 'South America' },
  { name: 'Paraguay', currency: 'PYG', timeZone: 'America/Asuncion', region: 'South America' },
  { name: 'Peru', currency: 'PEN', timeZone: 'America/Lima', region: 'South America' },
  { name: 'Suriname', currency: 'SRD', timeZone: 'America/Paramaribo', region: 'South America' },
  { name: 'Uruguay', currency: 'UYU', timeZone: 'America/Montevideo', region: 'South America' },
  { name: 'Venezuela', currency: 'VES', timeZone: 'America/Caracas', region: 'South America' },
];

export const findCountry = (name: string | undefined | null): CountryInfo | undefined =>
  AMERICAS.find(c => c.name.toLowerCase() === (name ?? '').trim().toLowerCase());

/** Every currency used in the region, for suggestions in forms. */
export const AMERICAS_CURRENCIES = [...new Set(['USD', 'EUR', ...AMERICAS.map(c => c.currency)])].sort();
