// OpenWeatherMap API 연동

const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || 'demo';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// 날씨 상태 매핑
const weatherIconMap: Record<string, { icon: string; condition: string }> = {
    '01d': { icon: '☀️', condition: 'sunny' },
    '01n': { icon: '🌙', condition: 'sunny' },
    '02d': { icon: '⛅', condition: 'partly_cloudy' },
    '02n': { icon: '☁️', condition: 'partly_cloudy' },
    '03d': { icon: '☁️', condition: 'cloudy' },
    '03n': { icon: '☁️', condition: 'cloudy' },
    '04d': { icon: '☁️', condition: 'cloudy' },
    '04n': { icon: '☁️', condition: 'cloudy' },
    '09d': { icon: '🌧️', condition: 'rainy' },
    '09n': { icon: '🌧️', condition: 'rainy' },
    '10d': { icon: '🌦️', condition: 'rainy' },
    '10n': { icon: '🌧️', condition: 'rainy' },
    '11d': { icon: '⛈️', condition: 'rainy' },
    '11n': { icon: '⛈️', condition: 'rainy' },
    '13d': { icon: '🌨️', condition: 'snowy' },
    '13n': { icon: '🌨️', condition: 'snowy' },
    '50d': { icon: '🌫️', condition: 'cloudy' },
    '50n': { icon: '🌫️', condition: 'cloudy' },
};

// 요일 이름
const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 날짜 포맷팅
function formatDate(date: Date): string {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// 현재 위치 가져오기
export async function getCurrentLocation(): Promise<{ lat: number; lon: number; city?: string }> {
    // 먼저 브라우저 Geolocation 시도
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    // 역지오코딩으로 도시 이름 가져오기
                    try {
                        const cityName = await getCityName(latitude, longitude);
                        resolve({ lat: latitude, lon: longitude, city: cityName });
                    } catch {
                        resolve({ lat: latitude, lon: longitude });
                    }
                },
                async () => {
                    // Geolocation 실패 시 IP 기반 위치
                    try {
                        const ipLocation = await getLocationByIP();
                        resolve(ipLocation);
                    } catch (error) {
                        reject(error);
                    }
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
        });
    }

    // Geolocation 미지원 시 IP 기반
    return getLocationByIP();
}

// IP 기반 위치 추정
async function getLocationByIP(): Promise<{ lat: number; lon: number; city: string }> {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    return {
        lat: data.latitude,
        lon: data.longitude,
        city: data.city,
    };
}

// 역지오코딩으로 도시 이름 가져오기
async function getCityName(lat: number, lon: number): Promise<string> {
    const response = await fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&lang=kr`
    );
    const data = await response.json();
    return data.name || '알 수 없음';
}

// 현재 날씨 가져오기
export async function fetchCurrentWeather(lat: number, lon: number) {
    const response = await fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`
    );

    if (!response.ok) {
        throw new Error('날씨 정보를 가져올 수 없습니다.');
    }

    const data = await response.json();
    const now = new Date();
    const iconInfo = weatherIconMap[data.weather[0].icon] || { icon: '☀️', condition: 'sunny' };

    return {
        date: formatDate(now),
        dayName: dayNames[now.getDay()],
        condition: iconInfo.condition,
        icon: iconInfo.icon,
        temperature: Math.round(data.main.temp),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        description: data.weather[0].description,
    };
}

// 예보 데이터로 시간대별 날씨 파싱
function parsePeriods(forecastList: any[], targetDate: Date) {
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const dayItems = forecastList.filter((item: any) =>
        item.dt_txt.startsWith(targetDateStr)
    );

    const periods = [
        { name: 'morning' as const, hours: [6, 9, 12], data: null as any },
        { name: 'afternoon' as const, hours: [12, 15, 18], data: null as any },
        { name: 'evening' as const, hours: [18, 21, 24], data: null as any },
    ];

    periods.forEach(period => {
        const hourStr = period.hours[0].toString().padStart(2, '0');
        const match = dayItems.find((item: any) => item.dt_txt.includes(`${hourStr}:00:00`));
        if (match) {
            const iconInfo = weatherIconMap[match.weather[0].icon] || { icon: '☀️', condition: 'sunny' };
            period.data = {
                name: period.name,
                temperature: Math.round(match.main.temp),
                icon: iconInfo.icon,
                rainProbability: Math.round((match.pop || 0) * 100),
            };
        }
    });

    return periods.filter(p => p.data).map(p => p.data);
}

// 5일 예보 가져오기
export async function fetchForecast(lat: number, lon: number) {
    const response = await fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`
    );

    if (!response.ok) {
        throw new Error('예보 정보를 가져올 수 없습니다.');
    }

    const data = await response.json();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 오늘 날씨 (첫 번째 예보 데이터 기반)
    const todayData = data.list[0];
    const todayIconInfo = weatherIconMap[todayData.weather[0].icon] || { icon: '☀️', condition: 'sunny' };

    // 내일 날씨 (내일 정오 기준)
    const tomorrowNoon = data.list.find((item: any) => {
        const itemDate = new Date(item.dt * 1000);
        return itemDate.getDate() === tomorrow.getDate() && itemDate.getHours() >= 12;
    }) || data.list[8]; // 대략 24시간 뒤

    const tomorrowIconInfo = weatherIconMap[tomorrowNoon?.weather[0].icon] || { icon: '☀️', condition: 'sunny' };

    // 오늘과 내일의 최저/최고 기온 계산
    const todayItems = data.list.filter((item: any) => {
        const itemDate = new Date(item.dt * 1000);
        return itemDate.getDate() === today.getDate();
    });

    const tomorrowItems = data.list.filter((item: any) => {
        const itemDate = new Date(item.dt * 1000);
        return itemDate.getDate() === tomorrow.getDate();
    });

    const todayTemps = todayItems.map((item: any) => item.main.temp);
    const tomorrowTemps = tomorrowItems.map((item: any) => item.main.temp);

    return {
        today: {
            date: formatDate(today),
            dayName: dayNames[today.getDay()],
            condition: todayIconInfo.condition,
            icon: todayIconInfo.icon,
            temperature: Math.round(todayData.main.temp),
            tempMin: Math.round(Math.min(...todayTemps)),
            tempMax: Math.round(Math.max(...todayTemps)),
            feelsLike: Math.round(todayData.main.feels_like),
            humidity: todayData.main.humidity,
            periods: parsePeriods(data.list, today),
        },
        tomorrow: {
            date: formatDate(tomorrow),
            dayName: dayNames[tomorrow.getDay()],
            condition: tomorrowIconInfo.condition,
            icon: tomorrowIconInfo.icon,
            temperature: Math.round(tomorrowNoon?.main.temp || 0),
            tempMin: tomorrowTemps.length ? Math.round(Math.min(...tomorrowTemps)) : 0,
            tempMax: tomorrowTemps.length ? Math.round(Math.max(...tomorrowTemps)) : 0,
            feelsLike: Math.round(tomorrowNoon?.main.feels_like || 0),
            humidity: tomorrowNoon?.main.humidity || 0,
            periods: parsePeriods(data.list, tomorrow),
        },
    };
}

// 날씨 상태로 배경색 결정
export function getWeatherBackground(condition: string): string {
    switch (condition) {
        case 'sunny':
        case 'clear':
            return 'sunny';
        case 'partly_cloudy':
            return 'partly-cloudy';
        case 'cloudy':
        case 'overcast':
            return 'cloudy';
        case 'rainy':
        case 'drizzle':
        case 'thunderstorm':
            return 'rainy';
        case 'snowy':
        case 'snow':
        case 'sleet':
            return 'snowy';
        default:
            return 'sunny';
    }
}
