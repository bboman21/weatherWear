import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WeatherCondition, UserOptions, FashionStyle, TransportationType, ScheduleType } from '@/types';

// 날씨 데이터 타입
interface WeatherData {
    date: string;
    dayName: string;
    condition: WeatherCondition;
    icon: string;
    temperature: number;
    tempMin: number;
    tempMax: number;
    feelsLike: number;
    humidity: number;
    periods: {
        name: 'morning' | 'afternoon' | 'evening';
        temperature: number;
        icon: string;
        rainProbability: number;
    }[];
}

// 추천 아이템 타입
interface RecommendItem {
    id: string;
    name: string;
    icon: string;
    reason: string;
    priority: number;
}

interface Recommendations {
    outer: RecommendItem[];
    top: RecommendItem[];
    bottom: RecommendItem[];
    shoes: RecommendItem[];
    accessories: RecommendItem[];
    essentials: RecommendItem[];
}

// 앱 스토어 타입
interface AppStore {
    // 날씨 상태
    todayWeather: WeatherData | null;
    tomorrowWeather: WeatherData | null;
    weatherBackground: WeatherCondition;
    isLoading: boolean;
    error: string | null;

    // 사용자 옵션
    options: UserOptions;

    // 추천 결과
    recommendations: Recommendations | null;

    // 위치 정보
    location: {
        lat: number;
        lon: number;
        city: string;
    } | null;

    // 액션
    setWeather: (today: WeatherData, tomorrow: WeatherData) => void;
    setWeatherBackground: (condition: WeatherCondition) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setOptions: (options: Partial<UserOptions>) => void;
    setRecommendations: (recommendations: Recommendations) => void;
    setLocation: (location: { lat: number; lon: number; city: string }) => void;
    toggleFashionStyle: (style: FashionStyle) => void;
}

export const useAppStore = create<AppStore>()(
    persist(
        (set) => ({
            // 초기 상태
            todayWeather: null,
            tomorrowWeather: null,
            weatherBackground: 'sunny',
            isLoading: false,
            error: null,
            options: {
                transportation: 'public_transit',
                scheduleType: 'work',
                scheduleDescription: '',
                fashionStyles: ['casual', 'warm'],
            },
            recommendations: null,
            location: null,

            // 액션
            setWeather: (today, tomorrow) =>
                set({ todayWeather: today, tomorrowWeather: tomorrow }),

            setWeatherBackground: (condition) =>
                set({ weatherBackground: condition }),

            setLoading: (loading) => set({ isLoading: loading }),

            setError: (error) => set({ error }),

            setOptions: (newOptions) =>
                set((state) => ({
                    options: { ...state.options, ...newOptions },
                })),

            setRecommendations: (recommendations) => set({ recommendations }),

            setLocation: (location) => set({ location }),

            toggleFashionStyle: (style) =>
                set((state) => ({
                    options: {
                        ...state.options,
                        fashionStyles: state.options.fashionStyles.includes(style)
                            ? state.options.fashionStyles.filter((s) => s !== style)
                            : [...state.options.fashionStyles, style],
                    },
                })),
        }),
        {
            name: 'weatherwear-storage', // localStorage 키 이름
            partialize: (state) => ({
                options: state.options,
                location: state.location,
            }),
        }
    )
);
