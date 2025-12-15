// 추천 로직

import { UserOptions } from '@/types';

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

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snowy';

// 옵션과 날씨에 따른 추천 생성
export function getRecommendations(
    options: UserOptions,
    weatherCondition: WeatherCondition = 'sunny',
    temperature: number = 0,
    feelsLike: number = 0
): Recommendations {
    const { transportation, scheduleType, fashionStyles } = options;

    const isWarm = fashionStyles.includes('warm');
    const isFormal = fashionStyles.includes('formal') || fashionStyles.includes('business_casual');
    const isSporty = fashionStyles.includes('sporty');
    const isCasual = fashionStyles.includes('casual');
    const isOutdoorExposure = ['walking', 'bicycle', 'motorcycle', 'kickboard'].includes(transportation);

    // 날씨 조건
    const isSnowy = weatherCondition === 'snowy';
    const isRainy = weatherCondition === 'rainy';
    const isPrecipitation = isSnowy || isRainy;
    const isCold = feelsLike < 5;
    const isVeryCold = feelsLike < 0;

    const outer: RecommendItem[] = [];
    const top: RecommendItem[] = [];
    const bottom: RecommendItem[] = [];
    const shoes: RecommendItem[] = [];
    const accessories: RecommendItem[] = [];
    const essentials: RecommendItem[] = [];

    // ===== 아우터 추천 =====
    if (isVeryCold || (isWarm && isCold)) {
        outer.push({ id: 'o1', name: '롱패딩', icon: '🧥', reason: `체감온도 ${feelsLike}°C`, priority: 1 });
    }
    if (isFormal && isCold) {
        outer.push({ id: 'o2', name: '울 코트', icon: '🧥', reason: '포멀한 느낌', priority: 2 });
    }
    if (isSporty) {
        outer.push({ id: 'o3', name: '패딩 점퍼', icon: '🧥', reason: '활동성 좋음', priority: 2 });
    }
    if (outer.length === 0 && isCold) {
        outer.push({ id: 'o4', name: '숏패딩', icon: '🧥', reason: `기온 ${temperature}°C`, priority: 1 });
    }

    // ===== 상의 추천 =====
    if (isFormal || scheduleType === 'work' || scheduleType === 'meeting') {
        top.push({ id: 't1', name: isCold ? '기모 셔츠' : '면 셔츠', icon: '👔', reason: '비즈니스 룩', priority: 1 });
    } else if (isSporty || scheduleType === 'exercise') {
        top.push({ id: 't2', name: isCold ? '기모 맨투맨' : '드라이핏', icon: '👕', reason: '운동에 적합', priority: 1 });
    } else if (isCasual || scheduleType === 'date') {
        top.push({ id: 't3', name: isCold ? '울 니트' : '가디건', icon: '🧶', reason: '캐주얼 + 스타일', priority: 1 });
    } else {
        top.push({ id: 't4', name: '맨투맨', icon: '👕', reason: '편안함', priority: 1 });
    }

    // ===== 하의 추천 =====
    if (isFormal || scheduleType === 'work' || scheduleType === 'meeting') {
        bottom.push({ id: 'b1', name: isCold ? '기모 슬랙스' : '슬랙스', icon: '👖', reason: '비즈니스 + 보온', priority: 1 });
    } else if (isSporty || scheduleType === 'exercise') {
        bottom.push({ id: 'b2', name: isCold ? '기모 조거팬츠' : '트레이닝', icon: '👖', reason: '활동성', priority: 1 });
    } else {
        bottom.push({ id: 'b3', name: isCold ? '기모 청바지' : '청바지', icon: '👖', reason: '캐주얼', priority: 1 });
    }

    // ===== 신발 추천 =====
    if (isSnowy) {
        shoes.push({ id: 's1', name: '방한 부츠', icon: '🥾', reason: '눈길 미끄럼 방지', priority: 1 });
    } else if (isRainy) {
        shoes.push({ id: 's2', name: '레인부츠', icon: '👢', reason: '비 오는 날 필수', priority: 1 });
    } else if (isFormal) {
        shoes.push({ id: 's3', name: '구두/로퍼', icon: '👞', reason: '포멀 스타일', priority: 1 });
    } else if (isSporty) {
        shoes.push({ id: 's4', name: '운동화', icon: '👟', reason: '활동성', priority: 1 });
    } else {
        shoes.push({ id: 's5', name: isCold ? '방한 운동화' : '스니커즈', icon: '👟', reason: '편안함', priority: 1 });
    }

    // ===== 액세서리 추천 =====
    if (isCold) {
        accessories.push({ id: 'a1', name: '목도리', icon: '🧣', reason: '목 보온', priority: 1 });
    }
    if (isVeryCold || isOutdoorExposure) {
        accessories.push({ id: 'a2', name: '장갑', icon: '🧤', reason: '손 보온', priority: 1 });
    }
    if (isOutdoorExposure && isVeryCold) {
        accessories.push({ id: 'a3', name: '귀마개', icon: '🎧', reason: '귀 보온', priority: 2 });
    }
    if (scheduleType === 'date') {
        accessories.push({ id: 'a4', name: '향수', icon: '🌸', reason: '데이트 필수템', priority: 2 });
    }

    // ===== 필수품 추천 =====
    if (isPrecipitation) {
        essentials.push({ id: 'e1', name: '우산', icon: '☂️', reason: isSnowy ? '눈 대비' : '비 대비', priority: 1 });
    }
    if (isVeryCold) {
        essentials.push({ id: 'e2', name: '핫팩', icon: '🔥', reason: `체감온도 ${feelsLike}°C`, priority: 1 });
    }
    if (scheduleType === 'travel' || scheduleType === 'outdoor') {
        essentials.push({ id: 'e3', name: '보조배터리', icon: '🔋', reason: '야외 활동 필수', priority: 2 });
    }

    return { outer, top, bottom, shoes, accessories, essentials };
}

// 날씨 비교 팁 생성
export function getWeatherTip(
    todayTemp: number,
    tomorrowTemp: number,
    tomorrowCondition: string
): string {
    const diff = todayTemp - tomorrowTemp;
    let tip = '';

    if (diff > 5) {
        tip = `내일은 오늘보다 ${diff}도 낮습니다. 따뜻하게 입으세요!`;
    } else if (diff < -5) {
        tip = `내일은 오늘보다 ${Math.abs(diff)}도 높습니다. 가볍게 입으세요!`;
    } else if (diff > 0) {
        tip = `내일은 오늘보다 ${diff}도 낮습니다.`;
    } else if (diff < 0) {
        tip = `내일은 오늘보다 ${Math.abs(diff)}도 높습니다.`;
    } else {
        tip = '오늘과 내일 기온이 비슷합니다.';
    }

    if (tomorrowCondition === 'snowy') {
        tip += ' 눈이 예보되어 있어 미끄럼 주의하세요.';
    } else if (tomorrowCondition === 'rainy') {
        tip += ' 비가 예보되어 있어 우산을 챙기세요.';
    }

    return tip;
}
