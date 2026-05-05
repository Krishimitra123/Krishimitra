/**
 * Weather Service — API calls for weather data.
 * Uses Open-Meteo via backend proxy (no API key needed).
 */

import { apiClient } from './api';

export interface CurrentWeather {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
}

export interface DailyForecast {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
}

export interface WeatherResponse {
  district: string;
  latitude: number;
  longitude: number;
  current: CurrentWeather;
  current_units: Record<string, string>;
  daily: DailyForecast;
  daily_units: Record<string, string>;
  source: string;
}

export interface AgricultureWeather {
  district: string;
  farming_tips: string[];
  hourly: Record<string, number[]>;
  daily: Record<string, number[]>;
  source: string;
}

/**
 * Weather code → emoji + description mapping
 */
export function getWeatherDescription(code: number): { icon: string; desc: string; desc_kn: string } {
  const map: Record<number, { icon: string; desc: string; desc_kn: string }> = {
    0:  { icon: '☀️', desc: 'Clear sky',       desc_kn: 'ಶುಭ್ರ ಆಕಾಶ' },
    1:  { icon: '🌤️', desc: 'Mainly clear',    desc_kn: 'ಮುಖ್ಯವಾಗಿ ಶುಭ್ರ' },
    2:  { icon: '⛅', desc: 'Partly cloudy',    desc_kn: 'ಭಾಗಶಃ ಮೋಡ' },
    3:  { icon: '☁️', desc: 'Overcast',         desc_kn: 'ಮೋಡಕಟ್ಟಿದೆ' },
    45: { icon: '🌫️', desc: 'Fog',             desc_kn: 'ಮಂಜು' },
    48: { icon: '🌫️', desc: 'Depositing fog',  desc_kn: 'ದಟ್ಟ ಮಂಜು' },
    51: { icon: '🌦️', desc: 'Light drizzle',   desc_kn: 'ಸಣ್ಣ ಮಳೆ' },
    53: { icon: '🌦️', desc: 'Moderate drizzle', desc_kn: 'ಮಧ್ಯಮ ಮಳೆ' },
    55: { icon: '🌧️', desc: 'Dense drizzle',   desc_kn: 'ಭಾರೀ ಜಿಟಿ ಮಳೆ' },
    61: { icon: '🌧️', desc: 'Slight rain',     desc_kn: 'ಸಣ್ಣ ಮಳೆ' },
    63: { icon: '🌧️', desc: 'Moderate rain',   desc_kn: 'ಮಧ್ಯಮ ಮಳೆ' },
    65: { icon: '🌧️', desc: 'Heavy rain',      desc_kn: 'ಭಾರೀ ಮಳೆ' },
    80: { icon: '🌦️', desc: 'Rain showers',    desc_kn: 'ಮಳೆ ಸುರಿಯುತ್ತಿದೆ' },
    81: { icon: '🌧️', desc: 'Moderate showers', desc_kn: 'ಮಧ್ಯಮ ಮಳೆ' },
    82: { icon: '⛈️', desc: 'Heavy showers',   desc_kn: 'ಭಾರೀ ಮಳೆ' },
    95: { icon: '⛈️', desc: 'Thunderstorm',    desc_kn: 'ಗುಡುಗು ಮಳೆ' },
    96: { icon: '⛈️', desc: 'Thunderstorm + hail', desc_kn: 'ಗುಡುಗು + ಆಲಿಕಲ್ಲು' },
    99: { icon: '⛈️', desc: 'Heavy thunderstorm', desc_kn: 'ಭಾರೀ ಗುಡುಗು ಮಳೆ' },
  };
  return map[code] || { icon: '🌤️', desc: 'Unknown', desc_kn: 'ಅಜ್ಞಾತ' };
}

/**
 * Fetch weather for a Karnataka district.
 */
export async function getWeather(district: string): Promise<WeatherResponse> {
  const res = await apiClient.get('/api/weather', {
    params: { district },
    timeout: 15000,
  });
  return res.data;
}

/**
 * Fetch agriculture weather (soil temp, moisture, tips).
 */
export async function getAgricultureWeather(district: string): Promise<AgricultureWeather> {
  const res = await apiClient.get('/api/weather/agriculture', {
    params: { district },
    timeout: 15000,
  });
  return res.data;
}
