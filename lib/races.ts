import dataset from './race-data.json';
export type RaceOption = {
  label: string;
  distanceKm: number | null;
  date?: string | null;
};
export type RaceRecord = {
  id: string;
  name: string;
  city: string;
  country: string;
  terrain: string;
  date: string | null;
  dateStatus: string;
  distanceKm: number | null;
  officialUrl: string;
  verifiedAt: string;
  distanceOptions: RaceOption[];
  dateNote?: string;
  distanceNote?: string;
  requiresDateSelection?: boolean;
  aliases?: string[];
};
export const RACES = dataset.races as RaceRecord[];
export function searchRaces(query: string) {
  const words = query
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/);
  return RACES.filter((r) => {
    const text = [r.name, r.city, r.country, ...(r.aliases ?? [])]
      .join(' ')
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return words.every((w) => text.includes(w));
  });
}
