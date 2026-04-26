/**
 * Primary crop list for onboarding picker — Kannada + English names.
 */

export interface Crop {
  name_en: string;
  name_kn: string;
  category: string;
  icon: string;     // Emoji for quick recognition (low-literacy farmers)
}

export const CROPS: Crop[] = [
  { name_en: 'Ragi',        name_kn: 'ರಾಗಿ',          category: 'cereal',       icon: '🌾' },
  { name_en: 'Paddy',       name_kn: 'ಭತ್ತ',          category: 'cereal',       icon: '🌾' },
  { name_en: 'Jowar',       name_kn: 'ಜೋಳ',           category: 'cereal',       icon: '🌾' },
  { name_en: 'Maize',       name_kn: 'ಮೆಕ್ಕೆಜೋಳ',      category: 'cereal',       icon: '🌽' },
  { name_en: 'Groundnut',   name_kn: 'ಶೇಂಗಾ',         category: 'oilseed',      icon: '🥜' },
  { name_en: 'Sunflower',   name_kn: 'ಸೂರ್ಯಕಾಂತಿ',     category: 'oilseed',      icon: '🌻' },
  { name_en: 'Sugarcane',   name_kn: 'ಕಬ್ಬು',          category: 'commercial',   icon: '🎋' },
  { name_en: 'Cotton',      name_kn: 'ಹತ್ತಿ',          category: 'commercial',   icon: '☁️' },
  { name_en: 'Tomato',      name_kn: 'ಟೊಮ್ಯಾಟೊ',       category: 'vegetable',    icon: '🍅' },
  { name_en: 'Onion',       name_kn: 'ಈರುಳ್ಳಿ',        category: 'vegetable',    icon: '🧅' },
  { name_en: 'Chilli',      name_kn: 'ಮೆಣಸಿನಕಾಯಿ',     category: 'vegetable',    icon: '🌶️' },
  { name_en: 'Banana',      name_kn: 'ಬಾಳೆ',          category: 'horticulture', icon: '🍌' },
  { name_en: 'Coconut',     name_kn: 'ತೆಂಗು',         category: 'horticulture', icon: '🥥' },
  { name_en: 'Mango',       name_kn: 'ಮಾವು',          category: 'horticulture', icon: '🥭' },
  { name_en: 'Areca Nut',   name_kn: 'ಅಡಿಕೆ',         category: 'plantation',   icon: '🌴' },
  { name_en: 'Coffee',      name_kn: 'ಕಾಫಿ',          category: 'plantation',   icon: '☕' },
  { name_en: 'Pepper',      name_kn: 'ಕಾಳುಮೆಣಸು',     category: 'spice',        icon: '🫑' },
  { name_en: 'Cardamom',    name_kn: 'ಏಲಕ್ಕಿ',         category: 'spice',        icon: '🌿' },
  { name_en: 'Turmeric',    name_kn: 'ಅರಿಶಿನ',        category: 'spice',        icon: '🟡' },
  { name_en: 'Tur Dal',     name_kn: 'ತೊಗರಿ',         category: 'pulse',        icon: '🫘' },
  { name_en: 'Pomegranate', name_kn: 'ದಾಳಿಂಬೆ',       category: 'horticulture', icon: '🍎' },
  { name_en: 'Grape',       name_kn: 'ದ್ರಾಕ್ಷಿ',        category: 'horticulture', icon: '🍇' },
  { name_en: 'Brinjal',     name_kn: 'ಬದನೆಕಾಯಿ',      category: 'vegetable',    icon: '🍆' },
  { name_en: 'Potato',      name_kn: 'ಆಲೂಗಡ್ಡೆ',       category: 'vegetable',    icon: '🥔' },
  { name_en: 'Rose',        name_kn: 'ಗುಲಾಬಿ',        category: 'flower',       icon: '🌹' },
  { name_en: 'Jasmine',     name_kn: 'ಮಲ್ಲಿಗೆ',        category: 'flower',       icon: '🌼' },
];
