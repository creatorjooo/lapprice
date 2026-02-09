# LapPrice - IT 제품 최저가 비교 사이트

노트북, 모니터, 데스크탑의 최저가를 10개 쇼핑몰에서 실시간으로 비교하는 어필리에이트 가격비교 사이트입니다.

## 주요 기능

- **10개 플랫폼 가격비교**: 쿠팡, 네이버, 11번가, G마켓, 옥션, 다나와, 에누리, SSG, 롯데ON, 인터파크
- **3개 카테고리**: 노트북, 모니터, 데스크탑
- **자동 상품 수집**: 네이버 쇼핑 API 기반 자동 동기화 (6시간마다)
- **어필리에이트 수익화**: 쿠팡 파트너스 Deeplink API + 네이버 브랜드커넥트
- **가격 추이**: 상품별 가격 히스토리 기록 및 차트
- **구매 타이밍 어드바이저**: 가격지수 기반 구매 시점 추천
- **스펙 비교**: 최대 4개 제품 나란히 비교
- **가격 알림**: 목표가 도달 시 알림
- **클릭 트래킹**: 어필리에이트 클릭 통계 (관리자 패널)
- **반응형 디자인**: 모바일/데스크탑 최적화

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Vite 7, Tailwind CSS, shadcn/ui, Recharts, Framer Motion |
| 백엔드 | Express 5, Node.js |
| API 연동 | 네이버 쇼핑 API, 쿠팡 파트너스 API, 11번가 Open API |
| 크롤링 | Cheerio (G마켓, 옥션, 다나와, 에누리, SSG, 롯데ON, 인터파크) |
| 데이터 | JSON 파일 기반 카탈로그 + 가격 히스토리 |

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 `.env`로 복사하고 API 키를 입력하세요.

```bash
cp .env.example .env
```

API 키가 없는 플랫폼은 자동으로 스킵됩니다.

### 3. 개발 서버 실행

```bash
# 프론트엔드 + 백엔드 동시 실행
npm run dev:full

# 프론트엔드만
npm run dev

# 백엔드만
npm run dev:server
```

- 프론트엔드: http://localhost:5173
- API 서버: http://localhost:3001

### 4. 프로덕션 빌드

```bash
npm run build
NODE_ENV=production node server/index.js
```

## 환경변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `NAVER_CLIENT_ID` | 네이버 개발자 Client ID | 선택 |
| `NAVER_CLIENT_SECRET` | 네이버 개발자 Client Secret | 선택 |
| `COUPANG_ACCESS_KEY` | 쿠팡 파트너스 Access Key | 선택 |
| `COUPANG_SECRET_KEY` | 쿠팡 파트너스 Secret Key | 선택 |
| `ELEVENTH_ST_API_KEY` | 11번가 Open API Key | 선택 |
| `PORT` | 서버 포트 (기본: 3001) | 아니오 |
| `ADMIN_PASSWORD` | 관리자 패널 비밀번호 | 권장 |
| `AFFILIATE_ENABLED` | 어필리에이트 활성화 (기본: true) | 아니오 |
| `AUTO_SYNC_ENABLED` | 자동 동기화 활성화 (기본: true) | 아니오 |
| `SYNC_INTERVAL_HOURS` | 동기화 주기 (기본: 6시간) | 아니오 |

## 배포

이 프로젝트는 Express 서버가 API + 프론트엔드를 동시에 서빙합니다. **장기 실행 프로세스**를 지원하는 호스팅이 필요합니다.

### Render (추천)

- Build Command: `npm install && npm run build`
- Start Command: `NODE_ENV=production node server/index.js`
- 환경변수: 대시보드에서 설정

### Railway

- Render와 동일한 설정

### 부적합한 플랫폼

- Vercel, Netlify: 서버리스 구조라 Express 장기 실행, 자동 동기화, 파일 로깅이 작동하지 않음

## 관리자 패널

URL 뒤에 `#admin`을 붙여 접근합니다 (예: `https://your-domain.com/#admin`).

- 어필리에이트 링크 관리 (전 카테고리)
- 클릭 통계 대시보드
- 수동 상품 동기화

## 프로젝트 구조

```
├── src/                    # React 프론트엔드
│   ├── components/         # 공통 컴포넌트
│   ├── pages/              # 페이지 (Home, Laptop, Monitor, Desktop, Admin)
│   ├── sections/           # 섹션 (Navbar, Footer, Newsletter)
│   ├── hooks/              # 커스텀 훅 (useProducts, useAffiliateLink 등)
│   ├── data/               # 정적 상품 데이터 (API 실패 시 fallback)
│   ├── types/              # TypeScript 타입 정의
│   └── utils/              # 유틸리티 (tracking 등)
├── server/                 # Express 백엔드
│   ├── routes/             # API 라우트 (naver, coupang, 11st, ...)
│   ├── services/           # 비즈니스 로직 (productSync)
│   ├── config/             # 설정 파일 (affiliate-links.json)
│   ├── data/               # 자동 수집 카탈로그 + 가격 히스토리
│   └── utils/              # 서버 유틸리티
├── index.html              # HTML 템플릿 + SEO 메타태그
├── .env.example            # 환경변수 템플릿
└── package.json
```

## 라이선스

Private
