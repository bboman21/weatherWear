'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { fetchForecast, getCurrentLocation } from '@/lib/weather-api';
import { fetchKMAForecast, isKoreaLocation } from '@/lib/kma-api';
import { getRecommendations, getWeatherTip } from '@/lib/recommend';
import { FashionStyle, TransportationType, ScheduleType, WeatherCondition } from '@/types';

// 옵션 데이터
const TRANSPORT_OPTIONS = [
  { code: 'car', name: '자가용', icon: '🚗' },
  { code: 'taxi', name: '택시', icon: '🚕' },
  { code: 'public_transit', name: '대중교통', icon: '🚌' },
  { code: 'bicycle', name: '자전거', icon: '🚲' },
  { code: 'motorcycle', name: '오토바이', icon: '🏍️' },
  { code: 'walking', name: '걷기', icon: '🚶' },
  { code: 'kickboard', name: '전동킥보드', icon: '🛴' },
];

const SCHEDULE_OPTIONS = [
  { code: 'work', name: '출근/업무', icon: '💼' },
  { code: 'meeting', name: '미팅/면접', icon: '🤝' },
  { code: 'date', name: '데이트', icon: '💕' },
  { code: 'travel', name: '여행/나들이', icon: '✈️' },
  { code: 'exercise', name: '운동', icon: '🏋️' },
  { code: 'school', name: '등교/학교', icon: '📚' },
  { code: 'home', name: '재택/집', icon: '🏠' },
  { code: 'event', name: '행사/파티', icon: '🎉' },
  { code: 'outdoor', name: '야외활동', icon: '⛰️' },
  { code: 'casual_outing', name: '가벼운 외출', icon: '🚶' },
];

const STYLE_OPTIONS: { code: FashionStyle; name: string; icon: string }[] = [
  { code: 'casual', name: '캐주얼', icon: '👕' },
  { code: 'formal', name: '포멀', icon: '👔' },
  { code: 'business_casual', name: '비캐', icon: '👞' },
  { code: 'sporty', name: '스포티', icon: '🏃' },
  { code: 'minimal', name: '미니멀', icon: '⬜' },
  { code: 'warm', name: '따뜻함', icon: '🔥' },
  { code: 'light', name: '가벼움', icon: '🪶' },
];

export default function Home() {
  const {
    todayWeather,
    tomorrowWeather,
    options,
    recommendations,
    location,
    isLoading,
    error,
    setWeather,
    setWeatherBackground,
    setLoading,
    setError,
    setOptions,
    setRecommendations,
    setLocation,
    toggleFashionStyle,
  } = useAppStore();

  // 날씨 데이터 출처 (기상청 or OpenWeatherMap)
  const [weatherSource, setWeatherSource] = useState<'kma' | 'openweather' | 'demo'>('demo');

  // 추천 의상 이미지 상태
  const [outfitImages, setOutfitImages] = useState([
    { src: '/outfit-model.png', name: 'Winter Cozy' },
    { src: '/outfit-style-1.png', name: 'Street Casual' },
    { src: '/outfit-style-2.png', name: 'Elegant Coat' },
    { src: '/outfit-style-3.png', name: 'Sporty Active' },
    { src: '/outfit-style-4.png', name: 'Classic Preppy' }
  ]);
  const [mainImageIndex, setMainImageIndex] = useState(0);

  // 모델 회전 뷰 상태 (0-100%)
  const [modelRotation, setModelRotation] = useState(0);

  // 회전 각도에 따른 뷰 라벨
  const getViewLabel = (value: number) => {
    if (value <= 12.5 || value >= 87.5) return '정면';
    if (value > 12.5 && value <= 37.5) return '우측면';
    if (value > 37.5 && value <= 62.5) return '후면';
    if (value > 62.5 && value < 87.5) return '좌측면';
    return '정면';
  };

  // 회전 각도에 따른 이미지 경로
  const getRotationImage = (value: number, baseImage: string) => {
    const view = getViewLabel(value);
    if (view === '정면') return baseImage;

    // 기본 이미지 경로에서 스타일 번호 추출
    const getStyleSuffix = (img: string) => {
      if (img.includes('outfit-model')) return ''; // 메인 모델
      if (img.includes('outfit-style-1')) return '-1';
      if (img.includes('outfit-style-2')) return '-2';
      if (img.includes('outfit-style-3')) return '-3';
      if (img.includes('outfit-style-4')) return '-4';
      return '';
    };

    const styleSuffix = getStyleSuffix(baseImage);
    const prefix = styleSuffix ? `/outfit-style${styleSuffix}` : '/model';

    switch (view) {
      case '우측면': return `${prefix}-right.png`;
      case '후면': return `${prefix}-back.png`;
      case '좌측면': return `${prefix}-left.png`;
      default: return baseImage;
    }
  };

  // 썸네일 클릭 시 메인 이미지와 교체
  const handleOutfitSwap = (clickedIndex: number) => {
    const newImages = [...outfitImages];
    const temp = newImages[0];
    newImages[0] = newImages[clickedIndex];
    newImages[clickedIndex] = temp;
    setOutfitImages(newImages);
  };

  // 오늘 의상 사진 업로드
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 날씨 데이터 로드
  const loadWeatherData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 위치 가져오기 (기본값: 서울)
      let loc = location || { lat: 37.5665, lon: 126.9780, city: '서울' };

      if (!location) {
        try {
          const fetchedLoc = await getCurrentLocation();
          loc = { lat: fetchedLoc.lat, lon: fetchedLoc.lon, city: fetchedLoc.city || '현재 위치' };
          setLocation(loc);
        } catch {
          // 위치 가져오기 실패 시 서울 기본값 사용
          setLocation(loc);
        }
      }

      // 한국 지역인지 확인
      let forecast;
      if (isKoreaLocation(loc.lat, loc.lon)) {
        // 기상청 API 사용
        try {
          forecast = await fetchKMAForecast(loc.lat, loc.lon);
          setWeatherSource('kma');
        } catch (kmaErr) {
          console.error('기상청 API 실패, OpenWeatherMap 시도:', kmaErr);
          forecast = await fetchForecast(loc.lat, loc.lon);
          setWeatherSource('openweather');
        }
      } else {
        // 해외: OpenWeatherMap 사용
        forecast = await fetchForecast(loc.lat, loc.lon);
        setWeatherSource('openweather');
      }

      setWeather(forecast.today as any, forecast.tomorrow as any);
      setWeatherBackground(forecast.tomorrow.condition as WeatherCondition);

      // 추천 생성
      const recs = getRecommendations(
        options,
        forecast.tomorrow.condition as WeatherCondition,
        forecast.tomorrow.temperature,
        forecast.tomorrow.feelsLike
      );
      setRecommendations(recs as any);
      setError(null);

    } catch (err) {
      console.error('날씨 데이터 로드 실패:', err);
      setWeatherSource('demo');
      setError('API 키 활성화 대기 중입니다. (최대 2시간 소요) 데모 데이터로 표시합니다.');
      // 데모 데이터 사용
      useDemoData();
    } finally {
      setLoading(false);
    }
  }, [location, options]);

  // 데모 데이터 설정
  const useDemoData = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

    const demoToday = {
      date: `${today.getMonth() + 1}월 ${today.getDate()}일`,
      dayName: dayNames[today.getDay()],
      condition: 'sunny' as WeatherCondition,
      icon: '☀️',
      temperature: 5,
      tempMin: 2,
      tempMax: 8,
      feelsLike: 3,
      humidity: 55,
      periods: [
        { name: 'morning' as const, temperature: 3, icon: '☀️', rainProbability: 10 },
        { name: 'afternoon' as const, temperature: 7, icon: '⛅', rainProbability: 15 },
        { name: 'evening' as const, temperature: 4, icon: '☁️', rainProbability: 20 },
      ],
    };

    const demoTomorrow = {
      date: `${tomorrow.getMonth() + 1}월 ${tomorrow.getDate()}일`,
      dayName: dayNames[tomorrow.getDay()],
      condition: 'snowy' as WeatherCondition,
      icon: '🌨️',
      temperature: -2,
      tempMin: -5,
      tempMax: 2,
      feelsLike: -5,
      humidity: 70,
      periods: [
        { name: 'morning' as const, temperature: -1, icon: '🌨️', rainProbability: 60 },
        { name: 'afternoon' as const, temperature: 2, icon: '🌨️', rainProbability: 70 },
        { name: 'evening' as const, temperature: 0, icon: '☁️', rainProbability: 50 },
      ],
    };

    setWeather(demoToday, demoTomorrow);
    setWeatherBackground('snowy');

    const recs = getRecommendations(options, 'snowy', -2, -5);
    setRecommendations(recs as any);
  };

  // 초기 로드
  useEffect(() => {
    loadWeatherData();
  }, []);

  // 배경색 적용
  useEffect(() => {
    if (tomorrowWeather) {
      document.body.className = `weather-${tomorrowWeather.condition}`;
    }
  }, [tomorrowWeather]);

  // 적용하기 클릭
  const handleApply = () => {
    if (tomorrowWeather) {
      const recs = getRecommendations(
        options,
        tomorrowWeather.condition as WeatherCondition,
        tomorrowWeather.temperature,
        tomorrowWeather.feelsLike
      );
      setRecommendations(recs as any);
    }
  };

  const getPeriodName = (name: string) => {
    switch (name) {
      case 'morning': return '오전';
      case 'afternoon': return '오후';
      case 'evening': return '저녁';
      default: return name;
    }
  };

  // 로딩 상태
  if (isLoading && !todayWeather) {
    return (
      <main className="main-container">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌤️</div>
          <div>날씨 정보를 가져오는 중...</div>
        </div>
      </main>
    );
  }

  // 날씨 데이터 없으면 데모 사용
  const today = todayWeather || {
    date: '오늘',
    dayName: '토요일',
    condition: 'sunny',
    icon: '☀️',
    temperature: 5,
    tempMin: 2,
    tempMax: 8,
    feelsLike: 3,
    periods: [],
  };

  const tomorrow = tomorrowWeather || {
    date: '내일',
    dayName: '일요일',
    condition: 'snowy',
    icon: '🌨️',
    temperature: -2,
    tempMin: -5,
    tempMax: 2,
    feelsLike: -5,
    periods: [],
  };

  const recs = recommendations || getRecommendations(options, 'snowy', -2, -5);
  const tip = getWeatherTip(today.temperature, tomorrow.temperature, tomorrow.condition);

  return (
    <main className="main-container">
      {/* 헤더 */}
      <header className="header neu-card">
        <div className="logo">
          <span className="logo-icon">👔</span>
          <span>WeatherWear</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {location?.city && (
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              📍 {location.city}
            </span>
          )}
          <button className="neu-button">로그인</button>
        </div>
      </header>

      {/* 에러 메시지 */}
      {error && (
        <div style={{ padding: '10px 16px', marginBottom: '16px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px', color: 'var(--accent-coral)', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* 입력 섹션 */}
      <section className="input-section">
        <div className="input-group">
          <label className="input-label">
            <span>🚌</span> 이동수단
          </label>
          <select
            className="neu-select"
            value={options.transportation}
            onChange={(e) => setOptions({ transportation: e.target.value as TransportationType })}
          >
            {TRANSPORT_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.icon} {opt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">
            <span>💼</span> 주요일정
          </label>
          <select
            className="neu-select"
            value={options.scheduleType}
            onChange={(e) => setOptions({ scheduleType: e.target.value as ScheduleType })}
          >
            {SCHEDULE_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.icon} {opt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">
            <span>👕</span> 원하는 스타일
          </label>
          <div className="style-tags">
            {STYLE_OPTIONS.map(style => (
              <span
                key={style.code}
                className={`tag ${options.fashionStyles.includes(style.code) ? 'tag-active' : 'tag-default'}`}
                onClick={() => toggleFashionStyle(style.code)}
              >
                {style.icon} {style.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 적용 버튼 */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <button
          className="neu-button"
          onClick={handleApply}
          style={{ padding: '12px 40px', fontSize: '16px', fontWeight: '600', background: 'var(--accent-blue)', color: 'white' }}
        >
          ✨ 적용하기
        </button>
      </div>

      {/* 날씨 & 추천 그리드 */}
      <section className="weather-grid">
        {/* 왼쪽: 날씨 카드들 */}
        <div className="weather-column">
          {/* 오늘 날씨 + 오늘 의상 (통합 카드) */}
          <div className="weather-card neu-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* 왼쪽: 오늘 날씨 */}
            <div>
              <div className="weather-card-header">
                <div>
                  <div className="weather-date">{today.date}</div>
                  <div className="weather-day">오늘 ({today.dayName})</div>
                </div>
              </div>
              <div className="weather-main">
                <span className="weather-icon">{today.icon}</span>
                <div>
                  <div className="weather-temp">{today.temperature}°C</div>
                  <div className="weather-temp-range">
                    {today.tempMin}° / {today.tempMax}°
                  </div>
                  <div className="weather-condition">체감 {today.feelsLike}°C</div>
                </div>
              </div>
              {today.periods && today.periods.length > 0 && (
                <div className="weather-periods">
                  {today.periods.map((period: any) => (
                    <div key={period.name} className="period-card neu-card-inset">
                      <div className="period-name">{getPeriodName(period.name)}</div>
                      <div className="period-icon">{period.icon}</div>
                      <div className="period-temp">{period.temperature}°C</div>
                      <div className="period-rain">💧 {period.rainProbability}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 오른쪽: 오늘 의상 등록 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--border-subtle)',
              paddingLeft: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="recommend-title" style={{ margin: 0 }}>📷 오늘 의상</h3>
                {uploadedImage && (
                  <button
                    className="buy-button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'var(--bg-secondary)', border: 'none' }}
                  >
                    다시 등록
                  </button>
                )}
              </div>
              {/* 숨겨진 파일 입력 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />

              {uploadedImage ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}>
                  <img
                    src={uploadedImage}
                    alt="오늘 의상"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '280px',
                      borderRadius: '12px',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px dashed var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minHeight: '200px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                  }}
                >
                  <span style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.7 }}>📸</span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    오늘 의상 사진 등록
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '8px' }}>
                    클릭하여 업로드
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 내일 날씨 카드 */}
          <div className="weather-card neu-card">
            <div className="weather-card-header">
              <div>
                <div className="weather-date">{tomorrow.date}</div>
                <div className="weather-day">내일 ({tomorrow.dayName})</div>
              </div>
            </div>
            <div className="weather-main">
              <span className="weather-icon">{tomorrow.icon}</span>
              <div>
                <div className="weather-temp">{tomorrow.temperature}°C</div>
                <div className="weather-temp-range">
                  {tomorrow.tempMin}° / {tomorrow.tempMax}°
                </div>
                <div className="weather-condition">체감 {tomorrow.feelsLike}°C</div>
              </div>
            </div>
            {tomorrow.periods && tomorrow.periods.length > 0 && (
              <div className="weather-periods">
                {tomorrow.periods.map((period: any) => (
                  <div key={period.name} className="period-card neu-card-inset">
                    <div className="period-name">{getPeriodName(period.name)}</div>
                    <div className="period-icon">{period.icon}</div>
                    <div className="period-temp">{period.temperature}°C</div>
                    <div className="period-rain">💧 {period.rainProbability}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 추천 복장 - 룩북 스타일 */}
        <div className="weather-column">
          <div className="recommend-section neu-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 룩북 헤더 */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 className="recommend-title" style={{ margin: 0 }}>👔 내일 복장 추천</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>내일 날씨에 맞춘 추천 코디</span>
              </div>
              <button
                className="neu-button"
                onClick={handleApply}
                style={{ fontSize: '12px', padding: '8px 16px' }}
              >
                🔄 다른 스타일
              </button>
            </div>

            {/* 룩북 컨텐츠 */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', height: '792px' }}>
              {/* 메인 모델 이미지 - 전체 영역 */}
              <div style={{
                flex: 1,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <img
                  src={getRotationImage(modelRotation, outfitImages[0].src)}
                  alt="추천 코디"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center top'
                  }}
                />

                {/* 왼쪽: 추가 추천 의상 썸네일 - 오버레이 */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  bottom: '80px',
                  width: '136px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowY: 'auto'
                }}>
                  {outfitImages.slice(1, 4).map((outfit, index) => (
                    <div
                      key={index}
                      onClick={() => handleOutfitSwap(index + 1)}
                      style={{
                        background: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '12px',
                        padding: '6px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        aspectRatio: '1/1',
                        background: '#f5f5f5',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        overflow: 'hidden'
                      }}>
                        <img src={outfit.src} alt={outfit.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{outfit.name}</div>
                    </div>
                  ))}
                </div>

                {/* 코디 라벨 */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  background: 'rgba(255,255,255,0.95)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {outfitImages[0].name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {recs.outer.length + recs.top.length + recs.bottom.length + recs.shoes.length + recs.accessories.length}개 아이템
                  </div>
                </div>

                {/* 360도 회전 슬라이더 */}
                <div style={{
                  position: 'absolute',
                  bottom: '28px',
                  right: '16px',
                  background: 'rgba(255,255,255,0.95)',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '40px' }}>
                    {getViewLabel(modelRotation)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={modelRotation}
                    onChange={(e) => setModelRotation(Number(e.target.value))}
                    style={{
                      width: '120px',
                      height: '6px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-light)' }}>360°</span>
                </div>
              </div>

              {/* 오른쪽: 아이템 썸네일 리스트 - 오버레이 */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '139px',
                maxHeight: 'calc(100% - 96px)',
                background: 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(10px)',
                borderRadius: '14px',
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* 아우터 */}
                  {recs.outer.map(item => (
                    <a
                      key={item.id}
                      href={`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'transparent',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                    </a>
                  ))}

                  {/* 상의 */}
                  {recs.top.map(item => (
                    <a
                      key={item.id}
                      href={`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'transparent',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                    </a>
                  ))}

                  {/* 하의 */}
                  {recs.bottom.map(item => (
                    <a
                      key={item.id}
                      href={`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'transparent',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                    </a>
                  ))}

                  {/* 신발 */}
                  {recs.shoes.map(item => (
                    <a
                      key={item.id}
                      href={`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'transparent',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                    </a>
                  ))}

                  {/* 액세서리 */}
                  {recs.accessories.map(item => (
                    <a
                      key={item.id}
                      href={`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'transparent',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                    </a>
                  ))}

                  {/* 필수품 */}
                  {recs.essentials.map(item => (
                    <a
                      key={item.id}
                      href={`https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f5';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'transparent',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 팁 배너 */}
      <div className="tip-banner neu-card">
        <div className="tip-title">💡 오늘의 팁</div>
        <div className="tip-content">{tip}</div>
      </div>

      {/* 출처 표시 */}
      <footer style={{ textAlign: 'center', padding: '20px 0', marginTop: '20px', fontSize: '12px', color: 'var(--text-light)' }}>
        {weatherSource === 'kma' && <span>날씨 정보 출처: 기상청</span>}
        {weatherSource === 'openweather' && <span>날씨 정보 출처: OpenWeatherMap</span>}
        {weatherSource === 'demo' && <span>데모 데이터</span>}
        <span style={{ margin: '0 8px' }}>|</span>
        <span>© 2024 WeatherWear</span>
      </footer>
    </main>
  );
}
