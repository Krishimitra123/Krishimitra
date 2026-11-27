// Karnataka farming seasons, used for the season badge and seasonal tips on the home screen.
export type FarmingSeason = 'kharif' | 'rabi' | 'summer';

export const SEASON_INFO: Record<FarmingSeason, { name_en: string; name_kn: string; months: string; icon: string }> = {
  kharif: { name_en: 'Kharif',  name_kn: 'ಖಾರಿಫ್',  months: 'Jun–Oct', icon: '🌧️' },
  rabi:   { name_en: 'Rabi',    name_kn: 'ರಬಿ',     months: 'Nov–Mar', icon: '❄️' },
  summer: { name_en: 'Summer',  name_kn: 'ಬೇಸಿಗೆ',   months: 'Mar–May', icon: '☀️' },
};

export function getCurrentSeason(): FarmingSeason {
  const m = new Date().getMonth();
  if (m >= 5 && m <= 9) return 'kharif';   // Jun–Oct
  if (m >= 10 || m <= 2) return 'rabi';     // Nov–Mar
  return 'summer';                           // Mar–May
}
