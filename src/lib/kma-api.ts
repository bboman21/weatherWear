// 대한민국 기상청 단기예보 API 연동
// 출처: 기상청

const KMA_API_KEY = process.env.NEXT_PUBLIC_KMA_API_KEY || '';
const KMA_BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

// 날씨 상태 코드 매핑 (기상청 PTY, SKY 코드)
const skyCodeMap: Record<string, { icon: string; condition: string }> = {
    '1': { icon: '☀️', condition: 'sunny' },      // 맑음
    '3': { icon: '⛅', condition: 'partly_cloudy' }, // 구름많음
    '4': { icon: '☁️', condition: 'cloudy' },     // 흐림
};

const ptyCodeMap: Record<string, { icon: string; condition: string }> = {
    '0': { icon: '☀️', condition: 'sunny' },      // 없음
    '1': { icon: '🌧️', condition: 'rainy' },     // 비
    '2': { icon: '🌨️', condition: 'rainy' },     // 비/눈
    '3': { icon: '🌨️', condition: 'snowy' },     // 눈
    '4': { icon: '🌧️', condition: 'rainy' },     // 소나기
};

// 요일 이름
const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 위경도 → 격자 좌표 변환 (기상청 API용)
function convertToGrid(lat: number, lon: number): { nx: number; ny: number } {
    const RE = 6371.00877; // 지구 반경(km)
    const GRID = 5.0; // 격자 간격(km)
    const SLAT1 = 30.0; // 투영 위도1(degree)
    const SLAT2 = 60.0; // 투영 위도2(degree)
    const OLON = 126.0; // 기준점 경도(degree)
    const OLAT = 38.0; // 기준점 위도(degree)
    const XO = 43; // 기준점 X좌표(GRID)
    const YO = 136; // 기준점 Y좌표(GRID)

    const DEGRAD = Math.PI / 180.0;
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = (re * sf) / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
    ra = (re * sf) / Math.pow(ra, sn);
    let theta = lon * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

    return { nx, ny };
}

// 기상청 API용 날짜/시간 포맷
function getKMADateTime(): { baseDate: string; baseTime: string } {
    const now = new Date();
    const hours = now.getHours();

    // 기상청 단기예보 발표시각: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
    let baseTime = 23;

    for (let i = baseTimes.length - 1; i >= 0; i--) {
        if (hours >= baseTimes[i] + 1) { // 발표 후 1시간 뒤 API 제공
            baseTime = baseTimes[i];
            break;
        }
    }

    // 만약 아직 02시 발표가 안됐으면 전날 23시
    let date = new Date(now);
    if (hours < 3) {
        date.setDate(date.getDate() - 1);
        baseTime = 23;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return {
        baseDate: `${year}${month}${day}`,
        baseTime: String(baseTime).padStart(2, '0') + '00',
    };
}

// 날짜 포맷팅
function formatDateKR(date: Date): string {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// 한국 지역인지 확인
export function isKoreaLocation(lat: number, lon: number): boolean {
    // 대한민국 영역: 위도 33~39, 경도 124~132
    return lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
}

// 기상청 단기예보 조회
export async function fetchKMAForecast(lat: number, lon: number) {
    const { nx, ny } = convertToGrid(lat, lon);
    const { baseDate, baseTime } = getKMADateTime();

    const url = `${KMA_BASE_URL}/getVilageFcst?serviceKey=${KMA_API_KEY}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('기상청 API 요청 실패');
    }

    const data = await response.json();

    if (!data.response?.body?.items?.item) {
        throw new Error('기상청 데이터 없음');
    }

    const items = data.response.body.items.item;

    // 오늘/내일 날짜
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const tomorrowStr = `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, '0')}${String(tomorrow.getDate()).padStart(2, '0')}`;

    // 데이터 파싱
    const todayData: any = { temps: [], pty: '0', sky: '1' };
    const tomorrowData: any = { temps: [], pty: '0', sky: '1' };

    items.forEach((item: any) => {
        const { category, fcstDate, fcstValue, fcstTime } = item;
        const target = fcstDate === todayStr ? todayData : (fcstDate === tomorrowStr ? tomorrowData : null);

        if (!target) return;

        if (category === 'TMP') { // 기온
            target.temps.push(parseFloat(fcstValue));
            if (fcstTime === '1200') target.temp = parseFloat(fcstValue);
        }
        if (category === 'TMN') target.tempMin = parseFloat(fcstValue); // 최저기온
        if (category === 'TMX') target.tempMax = parseFloat(fcstValue); // 최고기온
        if (category === 'PTY' && fcstTime === '1200') target.pty = fcstValue; // 강수형태
        if (category === 'SKY' && fcstTime === '1200') target.sky = fcstValue; // 하늘상태
        if (category === 'POP' && fcstTime === '1200') target.pop = parseInt(fcstValue); // 강수확률
        if (category === 'REH' && fcstTime === '1200') target.humidity = parseInt(fcstValue); // 습도
    });

    // 날씨 상태 결정
    const getWeatherInfo = (data: any) => {
        if (data.pty !== '0') {
            return ptyCodeMap[data.pty] || ptyCodeMap['0'];
        }
        return skyCodeMap[data.sky] || skyCodeMap['1'];
    };

    const todayWeather = getWeatherInfo(todayData);
    const tomorrowWeather = getWeatherInfo(tomorrowData);

    // 시간대별 예보 파싱 (오전 → 오후 → 저녁 순서)
    const parsePeriods = (dateStr: string) => {
        const periods: any[] = [];
        // 시간 순서 명시적 지정: 오전(06시), 오후(12시), 저녁(18시)
        const timeOrder = [
            { time: '0600', name: 'morning' },
            { time: '1200', name: 'afternoon' },
            { time: '1800', name: 'evening' },
        ];

        timeOrder.forEach(({ time, name }) => {
            const tmpItem = items.find((i: any) => i.fcstDate === dateStr && i.fcstTime === time && i.category === 'TMP');
            const skyItem = items.find((i: any) => i.fcstDate === dateStr && i.fcstTime === time && i.category === 'SKY');
            const ptyItem = items.find((i: any) => i.fcstDate === dateStr && i.fcstTime === time && i.category === 'PTY');
            const popItem = items.find((i: any) => i.fcstDate === dateStr && i.fcstTime === time && i.category === 'POP');

            if (tmpItem) {
                const pty = ptyItem?.fcstValue || '0';
                const sky = skyItem?.fcstValue || '1';
                const info = pty !== '0' ? ptyCodeMap[pty] : skyCodeMap[sky];

                periods.push({
                    name,
                    temperature: parseFloat(tmpItem.fcstValue),
                    icon: info?.icon || '☀️',
                    rainProbability: popItem ? parseInt(popItem.fcstValue) : 0,
                });
            }
        });

        return periods;
    };

    return {
        today: {
            date: formatDateKR(today),
            dayName: dayNames[today.getDay()],
            condition: todayWeather.condition,
            icon: todayWeather.icon,
            temperature: todayData.temp || (todayData.temps.length ? Math.round(todayData.temps.reduce((a: number, b: number) => a + b, 0) / todayData.temps.length) : 0),
            tempMin: todayData.tempMin || (todayData.temps.length ? Math.round(Math.min(...todayData.temps)) : 0),
            tempMax: todayData.tempMax || (todayData.temps.length ? Math.round(Math.max(...todayData.temps)) : 0),
            feelsLike: todayData.temp || 0, // 기상청은 체감온도 별도 계산 필요
            humidity: todayData.humidity || 50,
            periods: parsePeriods(todayStr),
        },
        tomorrow: {
            date: formatDateKR(tomorrow),
            dayName: dayNames[tomorrow.getDay()],
            condition: tomorrowWeather.condition,
            icon: tomorrowWeather.icon,
            temperature: tomorrowData.temp || (tomorrowData.temps.length ? Math.round(tomorrowData.temps.reduce((a: number, b: number) => a + b, 0) / tomorrowData.temps.length) : 0),
            tempMin: tomorrowData.tempMin || (tomorrowData.temps.length ? Math.round(Math.min(...tomorrowData.temps)) : 0),
            tempMax: tomorrowData.tempMax || (tomorrowData.temps.length ? Math.round(Math.max(...tomorrowData.temps)) : 0),
            feelsLike: tomorrowData.temp || 0,
            humidity: tomorrowData.humidity || 50,
            periods: parsePeriods(tomorrowStr),
        },
        source: 'kma', // 기상청 출처 표시
    };
}
