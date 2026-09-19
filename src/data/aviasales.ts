import type { FlightInfo } from './FlightSource';

const SEARCH_FORM = 'https://www.aviasales.ru/';

/** Ссылка на поиск билетов по направлению рейса на дату через неделю; без легенды — форма поиска. */
export function aviasalesUrl(info: FlightInfo | null, today: Date): string {
  if (!info) return SEARCH_FORM;
  const d = new Date(today);
  d.setDate(d.getDate() + 7);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${SEARCH_FORM}search/${info.from.iata}${dd}${mm}${info.to.iata}1`;
}
