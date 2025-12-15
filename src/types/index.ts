// 타입 정의

// 날씨 관련 타입
export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snowy';

export interface WeatherPeriod {
  name: 'morning' | 'afternoon' | 'evening';
  temperature: number;
  icon: string;
  rainProbability: number;
}

export interface WeatherData {
  date: string;
  dayName: string;
  condition: WeatherCondition;
  icon: string;
  temperature: number;
  tempMin: number;
  tempMax: number;
  feelsLike: number;
  humidity: number;
  periods: WeatherPeriod[];
}

// 사용자 옵션 타입
export type TransportationType = 'car' | 'taxi' | 'public_transit' | 'bicycle' | 'motorcycle' | 'walking' | 'kickboard';

export type ScheduleType = 'work' | 'meeting' | 'date' | 'travel' | 'exercise' | 'school' | 'home' | 'event' | 'outdoor' | 'casual_outing';

export type FashionStyle = 'casual' | 'formal' | 'business_casual' | 'sporty' | 'minimal' | 'street' | 'lovely' | 'classic' | 'warm' | 'light';

export interface UserOptions {
  transportation: TransportationType;
  scheduleType: ScheduleType;
  scheduleDescription?: string;
  fashionStyles: FashionStyle[];
}

// 추천 아이템 타입
export interface RecommendItem {
  id: string;
  category: 'outer' | 'top' | 'bottom' | 'shoes' | 'accessory' | 'essential';
  name: string;
  icon: string;
  reason: string;
  brand?: string;
  priority: number;
}

export interface Recommendations {
  outer: RecommendItem[];
  top: RecommendItem[];
  bottom: RecommendItem[];
  shoes: RecommendItem[];
  accessories: RecommendItem[];
  essentials: RecommendItem[];
  tips: string[];
}

// 프리셋 옵션 타입
export interface PresetOption {
  code: string;
  name: string;
  icon: string;
}

export interface TransportPreset extends PresetOption {
  exposureLevel: 'low' | 'medium' | 'high' | 'very_high';
}

// 앱 상태 타입
export interface AppState {
  weatherBackground: WeatherCondition;
  todayWeather: WeatherData | null;
  tomorrowWeather: WeatherData | null;
  userOptions: UserOptions;
  recommendations: Recommendations | null;
  isLoading: boolean;
}
