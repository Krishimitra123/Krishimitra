/**
 * Karnataka Districts — All 31 districts with Kannada names and agro-zone mapping.
 */

export interface District {
  name_en: string;
  name_kn: string;
  zone: number;   // Agro-climatic zone 1-10
}

export const DISTRICTS: District[] = [
  { name_en: 'Bagalkot',           name_kn: 'ಬಾಗಲಕೋಟೆ',         zone: 3 },
  { name_en: 'Ballari',            name_kn: 'ಬಳ್ಳಾರಿ',           zone: 2 },
  { name_en: 'Belagavi',           name_kn: 'ಬೆಳಗಾವಿ',          zone: 3 },
  { name_en: 'Bengaluru Rural',    name_kn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', zone: 6 },
  { name_en: 'Bengaluru Urban',    name_kn: 'ಬೆಂಗಳೂರು ನಗರ',     zone: 6 },
  { name_en: 'Bidar',              name_kn: 'ಬೀದರ',             zone: 1 },
  { name_en: 'Chamarajanagar',     name_kn: 'ಚಾಮರಾಜನಗರ',        zone: 6 },
  { name_en: 'Chikkaballapur',     name_kn: 'ಚಿಕ್ಕಬಳ್ಳಾಪುರ',       zone: 5 },
  { name_en: 'Chikkamagaluru',     name_kn: 'ಚಿಕ್ಕಮಗಳೂರು',       zone: 7 },
  { name_en: 'Chitradurga',        name_kn: 'ಚಿತ್ರದುರ್ಗ',         zone: 4 },
  { name_en: 'Dakshina Kannada',   name_kn: 'ದಕ್ಷಿಣ ಕನ್ನಡ',      zone: 9 },
  { name_en: 'Davangere',          name_kn: 'ದಾವಣಗೆರೆ',          zone: 4 },
  { name_en: 'Dharwad',            name_kn: 'ಧಾರವಾಡ',           zone: 3 },
  { name_en: 'Gadag',              name_kn: 'ಗದಗ',              zone: 3 },
  { name_en: 'Hassan',             name_kn: 'ಹಾಸನ',             zone: 7 },
  { name_en: 'Haveri',             name_kn: 'ಹಾವೇರಿ',           zone: 3 },
  { name_en: 'Kalaburagi',         name_kn: 'ಕಲಬುರಗಿ',          zone: 1 },
  { name_en: 'Kodagu',             name_kn: 'ಕೊಡಗು',            zone: 8 },
  { name_en: 'Kolar',              name_kn: 'ಕೋಲಾರ',            zone: 5 },
  { name_en: 'Koppal',             name_kn: 'ಕೊಪ್ಪಳ',            zone: 2 },
  { name_en: 'Mandya',             name_kn: 'ಮಂಡ್ಯ',             zone: 6 },
  { name_en: 'Mysuru',             name_kn: 'ಮೈಸೂರು',           zone: 6 },
  { name_en: 'Raichur',            name_kn: 'ರಾಯಚೂರು',          zone: 2 },
  { name_en: 'Ramanagara',         name_kn: 'ರಾಮನಗರ',           zone: 6 },
  { name_en: 'Shivamogga',         name_kn: 'ಶಿವಮೊಗ್ಗ',          zone: 7 },
  { name_en: 'Tumakuru',           name_kn: 'ತುಮಕೂರು',          zone: 4 },
  { name_en: 'Udupi',              name_kn: 'ಉಡುಪಿ',            zone: 9 },
  { name_en: 'Uttara Kannada',     name_kn: 'ಉತ್ತರ ಕನ್ನಡ',      zone: 8 },
  { name_en: 'Vijayapura',         name_kn: 'ವಿಜಯಪುರ',          zone: 3 },
  { name_en: 'Yadgir',             name_kn: 'ಯಾದಗಿರಿ',          zone: 1 },
  { name_en: 'Vijayanagara',       name_kn: 'ವಿಜಯನಗರ',          zone: 2 },
];

/**
 * Get zone number for a district name.
 */
export function getZoneForDistrict(districtNameEn: string): number | null {
  const d = DISTRICTS.find(
    (d) => d.name_en.toLowerCase() === districtNameEn.toLowerCase()
  );
  return d ? d.zone : null;
}
