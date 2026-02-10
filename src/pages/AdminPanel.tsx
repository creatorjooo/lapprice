import { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { allProducts } from '@/data/index';
import type { Product } from '@/types';

const API_BASE = '/api/admin';

interface AffiliateLinks {
  naver: Record<string, string>;
  coupang: Record<string, string>;
}

interface ClickStats {
  totalClicks: number;
  todayClicks: number;
  yesterdayClicks: number;
  weekClicks: number;
  period: string;
  byPlatform: Record<string, number>;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
  byHour: Record<string, number>;
  topProducts: { product: string; clicks: number }[];
  previousPeriod: {
    weekClicks: number;
    weekChange: number;
    todayVsYesterday: number;
  };
  estimatedRevenue: {
    total: number;
    today: number;
    week: number;
  };
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#14b8a6', '#f97316', '#84cc16'];

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'links' | 'analytics' | 'sync'>('dashboard');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'laptop' | 'monitor' | 'desktop'>('all');

  // Affiliate Links State
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLinks>({ naver: {}, coupang: {} });
  const [editingLinks, setEditingLinks] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState('');

  // Stats State
  const [stats, setStats] = useState<ClickStats | null>(null);
  const [statsDays, setStatsDays] = useState(30);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  // 로그인
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToken(data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || '로그인에 실패했습니다.');
      }
    } catch {
      setAuthError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
    }
  };

  // 어필리에이트 링크 로드
  const loadAffiliateLinks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/affiliate-links`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAffiliateLinks(data);
        const links: Record<string, string> = {};
        if (data.naver) {
          Object.entries(data.naver).forEach(([key, val]) => {
            if (!key.startsWith('_')) links[key] = val as string;
          });
        }
        setEditingLinks(links);
      }
    } catch {
      const links: Record<string, string> = {};
      allProducts.forEach((p: Product) => { links[p.name] = ''; });
      setEditingLinks(links);
    }
  }, [authHeaders]);

  // 클릭 통계 로드
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/click-stats?days=${statsDays}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      setStats(null);
    }
  }, [authHeaders, statsDays]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAffiliateLinks();
      loadStats();
    }
  }, [isAuthenticated, loadAffiliateLinks, loadStats]);

  // 링크 저장
  const handleSaveLink = async (productKey: string, url: string) => {
    try {
      const res = await fetch(`${API_BASE}/affiliate-links`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ platform: 'naver', productKey, url }),
      });
      if (res.ok) {
        setSaveMessage(`"${productKey}" 링크가 저장되었습니다.`);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch {
      setSaveMessage('저장에 실패했습니다.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleSaveAll = async () => {
    for (const [productKey, url] of Object.entries(editingLinks)) {
      if (url) await handleSaveLink(productKey, url);
    }
    setSaveMessage('모든 링크가 저장되었습니다.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleExportJson = () => {
    const data = JSON.stringify(affiliateLinks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'affiliate-links.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFindOnBrandConnect = (productName: string) => {
    window.open('https://brandconnect.naver.com', '_blank');
    setSaveMessage(`브랜드커넥트에서 "${productName}" 검색 후 제휴 링크를 복사하세요.`);
    setTimeout(() => setSaveMessage(''), 5000);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setToken('');
    window.location.hash = '';
  };

  // 등록률 계산
  const registeredCount = useMemo(() => {
    return Object.values(editingLinks).filter(v => !!v).length;
  }, [editingLinks]);

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">L</div>
            <div>
              <h1 className="text-xl font-bold text-white">LapPrice Admin</h1>
              <p className="text-slate-400 text-xs">관리자 대시보드</p>
            </div>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              autoFocus
            />
            {authError && <p className="text-rose-400 text-sm mb-4">{authError}</p>}
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
              로그인
            </button>
          </form>
          <button
            onClick={() => { window.location.hash = ''; window.location.reload(); }}
            className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            메인 사이트로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'dashboard' as const, label: '대시보드', icon: '📊' },
    { key: 'links' as const, label: '링크관리', icon: '🔗' },
    { key: 'analytics' as const, label: '분석/통계', icon: '📈' },
    { key: 'sync' as const, label: '동기화', icon: '🔄' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">L</div>
            <h1 className="text-lg font-bold text-white">LapPrice Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => { window.location.hash = ''; window.location.reload(); }} className="text-sm text-slate-400 hover:text-white transition-colors">
              사이트 보기
            </button>
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {saveMessage && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm">
            {saveMessage}
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardTab stats={stats} editingLinks={editingLinks} registeredCount={registeredCount} />}
        {activeTab === 'links' && (
          <LinksTab
            editingLinks={editingLinks}
            setEditingLinks={setEditingLinks}
            registeredCount={registeredCount}
            productTypeFilter={productTypeFilter}
            setProductTypeFilter={setProductTypeFilter}
            handleSaveAll={handleSaveAll}
            handleExportJson={handleExportJson}
            handleSaveLink={handleSaveLink}
            handleFindOnBrandConnect={handleFindOnBrandConnect}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsTab stats={stats} statsDays={statsDays} setStatsDays={setStatsDays} />}
        {activeTab === 'sync' && <SyncPanel token={token} />}
      </div>
    </div>
  );
}

// ─── 대시보드 탭 ───
function DashboardTab({ stats, editingLinks, registeredCount }: {
  stats: ClickStats | null;
  editingLinks: Record<string, string>;
  registeredCount: number;
}) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-slate-400">통계 데이터를 불러오는 중...</p>
          <p className="text-slate-600 text-xs mt-2">서버에서 클릭 데이터가 수집되면 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const totalProducts = allProducts.length;
  const linkRate = totalProducts > 0 ? Math.round((registeredCount / totalProducts) * 100) : 0;

  // 일별 차트 데이터
  const dailyChartData = Object.entries(stats.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, clicks]) => ({
      date: date.slice(5), // "02-09" 형식
      clicks,
    }));

  // 플랫폼 파이 차트 데이터
  const platformPieData = Object.entries(stats.byPlatform)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  // TOP 5 바 차트 데이터
  const topBarData = stats.topProducts.slice(0, 5).map((p) => ({
    name: p.product.length > 12 ? p.product.slice(0, 12) + '...' : p.product,
    clicks: p.clicks,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="오늘 클릭"
          value={stats.todayClicks}
          change={stats.previousPeriod.todayVsYesterday}
          suffix="회"
        />
        <KPICard
          label="7일 클릭"
          value={stats.weekClicks}
          change={stats.previousPeriod.weekChange}
          suffix="회"
        />
        <KPICard
          label="30일 클릭"
          value={stats.totalClicks}
          suffix="회"
        />
        <KPICard
          label="추정 수익 (30일)"
          value={stats.estimatedRevenue.total}
          prefix=""
          suffix="원"
          format="currency"
        />
        <KPICard
          label="링크 등록률"
          value={linkRate}
          suffix="%"
          detail={`${registeredCount}/${totalProducts}`}
          color={linkRate >= 50 ? 'emerald' : linkRate >= 20 ? 'amber' : 'rose'}
        />
        <KPICard
          label="전체 상품"
          value={totalProducts}
          suffix="개"
          detail={`등록 ${Object.keys(editingLinks).length}`}
        />
      </div>

      {/* Daily Clicks Area Chart */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">일별 클릭 추이</h3>
        {dailyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyChartData}>
              <defs>
                <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="clicks" stroke="#3b82f6" fill="url(#clickGradient)" strokeWidth={2} name="클릭수" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 text-sm text-center py-10">아직 클릭 데이터가 없습니다.</p>
        )}
      </div>

      {/* Bottom 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Pie Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">플랫폼별 클릭 비율</h3>
          {platformPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={platformPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {platformPieData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-10">데이터 없음</p>
          )}
        </div>

        {/* Top Products Bar Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">인기 상품 TOP 5</h3>
          {topBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="clicks" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="클릭수" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-10">데이터 없음</p>
          )}
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl border border-blue-500/30 p-6">
        <h3 className="text-sm font-semibold text-blue-300 mb-3">수익 추정 (쿠팡 파트너스 3% 기준)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-blue-400/70">오늘 추정</p>
            <p className="text-xl font-bold text-white">{stats.estimatedRevenue.today.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-xs text-blue-400/70">7일 추정</p>
            <p className="text-xl font-bold text-white">{stats.estimatedRevenue.week.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-xs text-blue-400/70">30일 추정</p>
            <p className="text-xl font-bold text-white">{stats.estimatedRevenue.total.toLocaleString()}원</p>
          </div>
        </div>
        <p className="text-[10px] text-blue-400/50 mt-3">* 추정치: 클릭 x 전환율 3% x 평균단가 150만원 x 커미션 3%. 실제 수익은 쿠팡 파트너스 대시보드에서 확인하세요.</p>
      </div>
    </div>
  );
}

// ─── KPI 카드 ───
function KPICard({ label, value, change, prefix, suffix, format, detail, color }: {
  label: string;
  value: number;
  change?: number;
  prefix?: string;
  suffix?: string;
  format?: 'currency';
  detail?: string;
  color?: 'emerald' | 'amber' | 'rose';
}) {
  const formatted = format === 'currency'
    ? value.toLocaleString()
    : value.toLocaleString();

  const colorMap = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ? colorMap[color] : 'text-white'}`}>
        {prefix}{formatted}{suffix}
      </p>
      {change !== undefined && (
        <p className={`text-[11px] mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change >= 0 ? '+' : ''}{change}% vs 이전
        </p>
      )}
      {detail && <p className="text-[10px] text-slate-600 mt-0.5">{detail}</p>}
    </div>
  );
}

// ─── 링크관리 탭 ───
function LinksTab({ editingLinks, setEditingLinks, registeredCount, productTypeFilter, setProductTypeFilter, handleSaveAll, handleExportJson, handleSaveLink, handleFindOnBrandConnect }: {
  editingLinks: Record<string, string>;
  setEditingLinks: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  registeredCount: number;
  productTypeFilter: 'all' | 'laptop' | 'monitor' | 'desktop';
  setProductTypeFilter: React.Dispatch<React.SetStateAction<'all' | 'laptop' | 'monitor' | 'desktop'>>;
  handleSaveAll: () => void;
  handleExportJson: () => void;
  handleSaveLink: (key: string, url: string) => void;
  handleFindOnBrandConnect: (name: string) => void;
}) {
  const totalProducts = allProducts.length;

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-[11px] text-slate-500">전체 상품</p>
          <p className="text-2xl font-bold text-white">{totalProducts}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-emerald-500/30 p-4">
          <p className="text-[11px] text-emerald-400">등록됨</p>
          <p className="text-2xl font-bold text-emerald-400">{registeredCount}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-rose-500/30 p-4">
          <p className="text-[11px] text-rose-400">미등록</p>
          <p className="text-2xl font-bold text-rose-400">{totalProducts - registeredCount}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {([['all', '전체'], ['laptop', '노트북'], ['monitor', '모니터'], ['desktop', '데스크탑']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setProductTypeFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                productTypeFilter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleSaveAll} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            전체 저장
          </button>
          <button onClick={handleExportJson} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
            JSON 내보내기
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">분류</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">상품명</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">네이버 브랜드커넥트 링크</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">상태</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">액션</th>
            </tr>
          </thead>
          <tbody>
            {allProducts
              .filter((p: Product) => productTypeFilter === 'all' || p.productType === productTypeFilter)
              .map((product: Product) => {
                const currentUrl = editingLinks[product.name] || '';
                const isRegistered = !!currentUrl;
                const typeLabels: Record<string, string> = { laptop: '노트북', monitor: '모니터', desktop: '데스크탑' };
                const typeColors: Record<string, string> = { laptop: 'bg-blue-500/20 text-blue-400', monitor: 'bg-purple-500/20 text-purple-400', desktop: 'bg-emerald-500/20 text-emerald-400' };

                return (
                  <tr key={product.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${typeColors[product.productType] || 'bg-slate-700 text-slate-400'}`}>
                        {typeLabels[product.productType] || product.productType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm text-white">{product.brand} {product.name}</p>
                      <p className="text-xs text-slate-500">{product.prices.current.toLocaleString()}원</p>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="url"
                        value={currentUrl}
                        onChange={(e) => setEditingLinks((prev) => ({ ...prev, [product.name]: e.target.value }))}
                        placeholder="https://brandconnect.naver.com/..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-medium ${
                        isRegistered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
                      }`}>
                        {isRegistered ? '등록' : '미등록'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleFindOnBrandConnect(product.name)}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                        >
                          찾기
                        </button>
                        {currentUrl && (
                          <button
                            onClick={() => handleSaveLink(product.name, currentUrl)}
                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                          >
                            저장
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <h3 className="font-semibold text-amber-400 text-sm mb-2">사용 방법</h3>
        <ol className="text-xs text-amber-300/70 space-y-1 list-decimal list-inside">
          <li>&ldquo;찾기&rdquo; 버튼 클릭 시 네이버 브랜드커넥트 페이지가 새 탭으로 열립니다.</li>
          <li>브랜드커넥트에서 해당 상품을 찾아 쇼핑커넥트 제휴 링크를 복사합니다.</li>
          <li>관리자 패널로 돌아와 URL 필드에 붙여넣기합니다.</li>
          <li>&ldquo;저장&rdquo; 또는 &ldquo;전체 저장&rdquo;을 클릭합니다.</li>
        </ol>
        <p className="text-xs text-amber-400/50 mt-2">* 쿠팡은 Deeplink API로 자동 변환되므로 별도 등록이 필요 없습니다.</p>
      </div>
    </div>
  );
}

// ─── 분석/통계 탭 ───
function AnalyticsTab({ stats, statsDays, setStatsDays }: {
  stats: ClickStats | null;
  statsDays: number;
  setStatsDays: (d: number) => void;
}) {
  if (!stats) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
        <p className="text-slate-400">통계 데이터를 불러오는 중이거나, 아직 데이터가 없습니다.</p>
      </div>
    );
  }

  // 플랫폼 바 차트 데이터
  const platformBarData = Object.entries(stats.byPlatform)
    .sort(([, a], [, b]) => b - a)
    .map(([platform, clicks]) => ({ platform, clicks }));

  // 일별 라인 차트 데이터
  const dailyLineData = Object.entries(stats.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, clicks]) => ({ date: date.slice(5), clicks }));

  // 시간대별 히트맵 데이터
  const hourlyData = Object.entries(stats.byHour || {})
    .map(([hour, clicks]) => ({ hour: `${hour}시`, clicks: clicks as number }));

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white">분석/통계</h2>
        <div className="flex gap-2 ml-auto">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setStatsDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statsDays === d ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <p className="text-sm text-slate-500 mb-1">오늘</p>
          <p className="text-3xl font-bold text-white">{stats.todayClicks}</p>
          <p className={`text-xs mt-1 ${stats.previousPeriod.todayVsYesterday >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.previousPeriod.todayVsYesterday >= 0 ? '+' : ''}{stats.previousPeriod.todayVsYesterday}% vs 어제
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <p className="text-sm text-slate-500 mb-1">7일</p>
          <p className="text-3xl font-bold text-white">{stats.weekClicks}</p>
          <p className={`text-xs mt-1 ${stats.previousPeriod.weekChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.previousPeriod.weekChange >= 0 ? '+' : ''}{stats.previousPeriod.weekChange}% vs 전주
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <p className="text-sm text-slate-500 mb-1">기간 합계 ({stats.period})</p>
          <p className="text-3xl font-bold text-white">{stats.totalClicks}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-blue-500/30 p-5">
          <p className="text-sm text-blue-400 mb-1">추정 수익</p>
          <p className="text-3xl font-bold text-blue-300">{stats.estimatedRevenue.total.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">원</p>
        </div>
      </div>

      {/* Platform Bar Chart */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">플랫폼별 클릭</h3>
        {platformBarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={platformBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="platform" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
              <Bar dataKey="clicks" radius={[4, 4, 0, 0]} name="클릭수">
                {platformBarData.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 text-sm text-center py-10">데이터 없음</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Line Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="font-semibold text-slate-300 text-sm mb-4">일별 클릭 추이</h3>
          {dailyLineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="클릭수" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-10">데이터 없음</p>
          )}
        </div>

        {/* Hourly Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="font-semibold text-slate-300 text-sm mb-4">시간대별 클릭</h3>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                <Bar dataKey="clicks" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="클릭수" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-10">데이터 없음</p>
          )}
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">소스별 클릭</h3>
        {Object.entries(stats.bySource).length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.bySource)
              .sort(([, a], [, b]) => b - a)
              .map(([source, clicks]) => {
                const pct = stats.totalClicks > 0 ? Math.round((clicks / stats.totalClicks) * 100) : 0;
                return (
                  <div key={source} className="bg-slate-800 rounded-lg px-4 py-3 min-w-[120px]">
                    <p className="text-xs text-slate-400">{source}</p>
                    <p className="text-xl font-bold text-white">{clicks}</p>
                    <p className="text-[10px] text-slate-500">{pct}%</p>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">아직 클릭 데이터가 없습니다.</p>
        )}
      </div>

      {/* Top Products Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">인기 상품 TOP 20</h3>
        {stats.topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-[11px] text-slate-400">#</th>
                  <th className="text-left px-3 py-2 text-[11px] text-slate-400">상품</th>
                  <th className="text-right px-3 py-2 text-[11px] text-slate-400">클릭</th>
                  <th className="text-right px-3 py-2 text-[11px] text-slate-400">추정 전환</th>
                  <th className="text-right px-3 py-2 text-[11px] text-slate-400">추정 수익</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((item, i) => {
                  const estConversions = Math.round(item.clicks * 0.03 * 10) / 10;
                  const estRevenue = Math.round(item.clicks * 0.03 * 1500000 * 0.03);
                  return (
                    <tr key={item.product} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-3 py-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i < 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-300">{item.product}</td>
                      <td className="px-3 py-2.5 text-sm text-white font-semibold text-right">{item.clicks}</td>
                      <td className="px-3 py-2.5 text-sm text-emerald-400 text-right">{estConversions}</td>
                      <td className="px-3 py-2.5 text-sm text-blue-400 text-right">{estRevenue.toLocaleString()}원</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">아직 클릭 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// ─── 상품 자동 동기화 관리 패널 ───
function SyncPanel({ token }: { token: string }) {
  const [syncStats, setSyncStats] = useState<Record<string, unknown> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');
  const [syncType, setSyncType] = useState<string>('all');

  const API_PRODUCTS_BASE = '/api/products';

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_PRODUCTS_BASE}/stats`);
      if (res.ok) {
        const data = await res.json();
        setSyncStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult('');
    try {
      const body: Record<string, string> = {};
      if (syncType !== 'all') body.type = syncType;

      const res = await fetch(`${API_PRODUCTS_BASE}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`동기화 완료! ${JSON.stringify(data.results)}`);
        fetchStats();
      } else {
        setSyncResult(`오류: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      setSyncResult(`동기화 실패: ${(err as Error).message}`);
    }
    setIsSyncing(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">상품 자동 동기화 관리</h2>
        <p className="text-sm text-slate-400 mb-6">
          네이버 쇼핑 API에서 카테고리별 인기 상품을 자동 수집합니다. 서버 시작 시 자동 동기화되며, 이후 6시간마다 갱신됩니다.
        </p>

        <div className="flex items-end gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">동기화 대상</label>
            <select
              value={syncType}
              onChange={e => setSyncType(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm"
            >
              <option value="all">전체 (노트북+모니터+데스크탑)</option>
              <option value="laptop">노트북만</option>
              <option value="monitor">모니터만</option>
              <option value="desktop">데스크탑만</option>
            </select>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? '동기화 중...' : '지금 동기화'}
          </button>
        </div>

        {syncResult && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${
            syncResult.includes('완료') ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {syncResult}
          </div>
        )}
      </div>

      {syncStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['laptop', 'monitor', 'desktop'].map(type => {
            const s = (syncStats as Record<string, Record<string, unknown>>)[type];
            if (!s) return null;
            const labels: Record<string, string> = { laptop: '노트북', monitor: '모니터', desktop: '데스크탑' };
            const colors: Record<string, string> = { laptop: 'blue', monitor: 'purple', desktop: 'emerald' };
            const color = colors[type] || 'slate';
            const borderColor: Record<string, string> = { blue: 'border-blue-500/30', purple: 'border-purple-500/30', emerald: 'border-emerald-500/30' };
            const textColor: Record<string, string> = { blue: 'text-blue-400', purple: 'text-purple-400', emerald: 'text-emerald-400' };
            return (
              <div key={type} className={`bg-slate-900 rounded-xl border ${borderColor[color] || 'border-slate-800'} p-6`}>
                <h3 className={`text-lg font-semibold ${textColor[color] || 'text-white'} mb-3`}>{labels[type]}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">전체 상품</span><span className="font-semibold text-white">{String(s.total || 0)}개</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">자동 수집</span><span className="font-medium text-blue-400">{String(s.autoGenerated || 0)}개</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">수동 큐레이션</span><span className="font-medium text-emerald-400">{String(s.manual || 0)}개</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">동기화 횟수</span><span className="text-slate-300">{String(s.syncCount || 0)}회</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">마지막 동기화</span><span className="text-slate-400 text-xs">{s.lastSync ? new Date(s.lastSync as string).toLocaleString('ko-KR') : '없음'}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="font-semibold text-white mb-3">자동 동기화 동작 방식</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">1.</span> 서버 시작 30초 후 첫 동기화 자동 실행</li>
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">2.</span> 이후 6시간마다 자동 갱신 (노트북, 모니터, 데스크탑)</li>
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">3.</span> 네이버 쇼핑 API에서 카테고리별 인기 검색어로 상품 수집</li>
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">4.</span> 기존 상품: 가격 자동 업데이트 & 가격 히스토리 기록</li>
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">5.</span> 신규 상품: 자동 추가 (브랜드/카테고리 자동 분류)</li>
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">6.</span> 부품/악세서리 자동 필터링 (가격 범위 + 키워드)</li>
          <li className="flex gap-2"><span className="shrink-0 text-slate-500">7.</span> 프론트엔드는 API 우선, 실패 시 정적 데이터 자동 fallback</li>
        </ul>
        <div className="mt-4 text-xs text-slate-600">환경변수: AUTO_SYNC_ENABLED=true/false, SYNC_INTERVAL_HOURS=6</div>
      </div>
    </div>
  );
}
