// ─── 제품 타입 공통 ───
export type ProductType = 'laptop' | 'monitor' | 'desktop';

// ─── 공유 인터페이스 ───
export interface StorePrice {
  store: string;
  storeLogo: string;
  price: number;
  rawPrice?: number;
  verifiedPrice?: number;
  verifiedAt?: string | null;
  verificationStatus?: 'verified' | 'failed' | 'stale';
  verificationMethod?: 'api' | 'browser' | 'fallback';
  shipping: number;
  deliveryDays: string;
  updatedAt: string;
  url: string;
  sourceUrl?: string;
  offerId?: string;
  isActive?: boolean;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  isLowest: boolean;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  helpful: number;
}

export interface PriceHistory {
  date: string;
  price: number;
  store: string;
}

// ─── 노트북 ───
export interface Laptop {
  id: string;
  productType: 'laptop';
  brand: string;
  name: string;
  model: string;
  category: 'gaming' | 'ultrabook' | 'business' | 'creator' | 'budget' | 'apple';
  specs: {
    cpu: string;
    cpuType: 'intel' | 'amd' | 'apple';
    gpu: string;
    ram: number;
    ramType: string;
    storage: number;
    storageType: string;
    display: string;
    displaySize: number;
    weight: number;
    battery: string;
  };
  prices: {
    original: number;
    current: number;
    lowest: number;
    average: number;
  };
  discount: {
    percent: number;
    amount: number;
  };
  priceIndex: number;
  stores: StorePrice[];
  rating: {
    score: number;
    count: number;
  };
  reviews: Review[];
  stock: 'in' | 'low' | 'out';
  isNew: boolean;
  isHot: boolean;
  releaseDate: string;
  images: string[];
  tags: string[];
  // 에디터 추천 관련 필드
  editorScore?: number;
  editorPick?: string;
  editorComment?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
}

// ─── 모니터 ───
export interface Monitor {
  id: string;
  productType: 'monitor';
  brand: string;
  name: string;
  model: string;
  category: 'gaming' | 'professional' | 'ultrawide' | 'general' | 'portable';
  specs: {
    panelType: 'IPS' | 'VA' | 'OLED' | 'TN' | 'Mini LED' | 'QD-OLED' | 'IPS Black';
    resolution: string;
    resolutionLabel: string;
    refreshRate: number;
    responseTime: string;
    screenSize: number;
    aspectRatio: string;
    hdr: string;
    colorGamut: string;
    ports: string[];
    speakers: boolean;
    heightAdjust: boolean;
    pivot: boolean;
    vesa: boolean;
    curved: boolean;
    curvature?: string;
  };
  prices: {
    original: number;
    current: number;
    lowest: number;
    average: number;
  };
  discount: {
    percent: number;
    amount: number;
  };
  priceIndex: number;
  stores: StorePrice[];
  rating: {
    score: number;
    count: number;
  };
  reviews: Review[];
  stock: 'in' | 'low' | 'out';
  isNew: boolean;
  isHot: boolean;
  releaseDate: string;
  images: string[];
  tags: string[];
  editorScore?: number;
  editorPick?: string;
  editorComment?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
}

// ─── 데스크탑 ───
export interface Desktop {
  id: string;
  productType: 'desktop';
  brand: string;
  name: string;
  model: string;
  category: 'gaming' | 'workstation' | 'minipc' | 'allinone' | 'office' | 'mac' | 'creator';
  specs: {
    cpu: string;
    cpuType: 'intel' | 'amd' | 'apple';
    gpu: string;
    ram: number;
    ramType: string;
    storage: number;
    storageType: string;
    formFactor: string;
    psu: string;
    os: string;
    includedMonitor?: string;
    expansion: string[];
  };
  prices: {
    original: number;
    current: number;
    lowest: number;
    average: number;
  };
  discount: {
    percent: number;
    amount: number;
  };
  priceIndex: number;
  stores: StorePrice[];
  rating: {
    score: number;
    count: number;
  };
  reviews: Review[];
  stock: 'in' | 'low' | 'out';
  isNew: boolean;
  isHot: boolean;
  releaseDate: string;
  images: string[];
  tags: string[];
  editorScore?: number;
  editorPick?: string;
  editorComment?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
}

// ─── 통합 제품 타입 ───
export type Product = Laptop | Monitor | Desktop;

// ─── 필터 ───
export interface FilterState {
  category: string[];
  brand: string[];
  priceRange: [number, number];
  cpu: string[];
  ram: string[];
  storage: string[];
  displaySize: string[];
  weight: string[];
  discount: string[];
  stock: string[];
  sort: string;
}

export interface MonitorFilterState {
  category: string[];
  brand: string[];
  priceRange: [number, number];
  panelType: string[];
  resolution: string[];
  refreshRate: string[];
  screenSize: string[];
  hdr: string[];
  curved: string[];
  sort: string;
}

export interface DesktopFilterState {
  category: string[];
  brand: string[];
  priceRange: [number, number];
  cpu: string[];
  gpu: string[];
  ram: string[];
  storage: string[];
  formFactor: string[];
  sort: string;
}

// ─── 기타 ───
export interface CompareItem {
  laptop: Laptop;
  addedAt: string;
}

export interface WishlistItem {
  laptopId: string;
  addedAt: string;
  targetPrice?: number;
}

export interface PriceAlert {
  id: string;
  laptopId: string;
  targetPrice: number;
  email: string;
  createdAt: string;
  isActive: boolean;
}

export interface Stats {
  todayLowest: number;
  totalProducts: number;
  averageDiscount: number;
  todayUpdates: number;
  priceDrops: number;
  newArrivals: number;
}
