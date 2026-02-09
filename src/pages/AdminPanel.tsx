import { useState, useEffect, useCallback } from 'react';
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
  weekClicks: number;
  period: string;
  byPlatform: Record<string, number>;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
  topProducts: { product: string; clicks: number }[];
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<'links' | 'stats' | 'sync'>('links');
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
        // 편집 상태 초기화
        const links: Record<string, string> = {};
        if (data.naver) {
          Object.entries(data.naver).forEach(([key, val]) => {
            if (!key.startsWith('_')) {
              links[key] = val as string;
            }
          });
        }
        setEditingLinks(links);
      }
    } catch {
      // 서버 연결 실패 시 로컬 데이터 사용
      const links: Record<string, string> = {};
      allProducts.forEach((p: Product) => {
        links[p.name] = '';
      });
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

  // 전체 저장
  const handleSaveAll = async () => {
    for (const [productKey, url] of Object.entries(editingLinks)) {
      if (url) {
        await handleSaveLink(productKey, url);
      }
    }
    setSaveMessage('모든 링크가 저장되었습니다.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // JSON 내보내기
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

  // 네이버 브랜드커넥트 열기
  const handleFindOnBrandConnect = (productName: string) => {
    window.open('https://brandconnect.naver.com', '_blank');
    setSaveMessage(`브랜드커넥트에서 "${productName}" 검색 후 제휴 링크를 복사하세요.`);
    setTimeout(() => setSaveMessage(''), 5000);
  };

  // 로그아웃
  const handleLogout = () => {
    setIsAuthenticated(false);
    setToken('');
    window.location.hash = '';
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">LapPrice 관리자</h1>
          <p className="text-slate-500 mb-6">관리자 비밀번호를 입력하세요.</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {authError && (
              <p className="text-rose-500 text-sm mb-4">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              로그인
            </button>
          </form>
          <button
            onClick={() => { window.location.hash = ''; window.location.reload(); }}
            className="mt-4 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            메인 사이트로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">LapPrice 관리자 패널</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { window.location.hash = ''; window.location.reload(); }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              사이트 보기
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex">
          <button
            onClick={() => setActiveTab('links')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'links'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            어필리에이트 링크
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            클릭 통계
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sync'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            상품 자동 동기화
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Save Message */}
        {saveMessage && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
            {saveMessage}
          </div>
        )}

        {activeTab === 'links' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                네이버 브랜드커넥트 링크 관리 ({allProducts.length}개 상품)
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveAll}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  전체 저장
                </button>
                <button
                  onClick={handleExportJson}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  JSON 내보내기
                </button>
              </div>
            </div>

            {/* 제품 타입 필터 */}
            <div className="flex gap-2 mb-4">
              {([['all', '전체'], ['laptop', '노트북'], ['monitor', '모니터'], ['desktop', '데스크탑']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setProductTypeFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    productTypeFilter === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">분류</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">상품명</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">네이버 브랜드커넥트 링크</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">상태</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {allProducts
                    .filter(p => productTypeFilter === 'all' || p.productType === productTypeFilter)
                    .map((product: Product) => {
                    const currentUrl = editingLinks[product.name] || '';
                    const isRegistered = !!currentUrl;
                    const typeLabels: Record<string, string> = { laptop: '노트북', monitor: '모니터', desktop: '데스크탑' };

                    return (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                            product.productType === 'laptop' ? 'bg-blue-100 text-blue-700'
                            : product.productType === 'monitor' ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {typeLabels[product.productType] || product.productType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-sm text-slate-900">{product.brand} {product.name}</p>
                            <p className="text-xs text-slate-400">{product.prices.current.toLocaleString()}원</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="url"
                            value={currentUrl}
                            onChange={(e) => setEditingLinks((prev) => ({ ...prev, [product.name]: e.target.value }))}
                            placeholder="https://brandconnect.naver.com/..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-medium ${
                            isRegistered
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isRegistered ? '등록' : '미등록'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleFindOnBrandConnect(product.name)}
                              className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              찾기
                            </button>
                            {currentUrl && (
                              <button
                                onClick={() => handleSaveLink(product.name, currentUrl)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
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

            {/* 안내 */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h3 className="font-semibold text-amber-800 text-sm mb-2">사용 방법</h3>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li>&ldquo;찾기&rdquo; 버튼을 클릭하면 네이버 브랜드커넥트 페이지가 새 탭으로 열립니다.</li>
                <li>브랜드커넥트에서 해당 상품을 찾아 쇼핑커넥트 제휴 링크를 복사합니다.</li>
                <li>관리자 패널로 돌아와 URL 필드에 붙여넣기합니다.</li>
                <li>&ldquo;저장&rdquo; 또는 &ldquo;전체 저장&rdquo;을 클릭합니다.</li>
              </ol>
              <p className="text-xs text-amber-600 mt-2">
                * 쿠팡은 Deeplink API로 자동 변환되므로 별도 등록이 필요 없습니다.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Stats Period Selector */}
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-semibold text-slate-900">클릭 통계</h2>
              <div className="flex gap-2 ml-auto">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setStatsDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statsDays === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {d}일
                  </button>
                ))}
              </div>
            </div>

            {stats ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <p className="text-sm text-slate-500 mb-1">오늘 클릭</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.todayClicks}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <p className="text-sm text-slate-500 mb-1">7일 클릭</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.weekClicks}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <p className="text-sm text-slate-500 mb-1">전체 ({stats.period})</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.totalClicks}</p>
                  </div>
                </div>

                {/* Platform Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">플랫폼별 클릭</h3>
                  {Object.entries(stats.byPlatform).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(stats.byPlatform)
                        .sort(([, a], [, b]) => b - a)
                        .map(([platform, clicks]) => {
                          const percentage = stats.totalClicks > 0 ? (clicks / stats.totalClicks) * 100 : 0;
                          return (
                            <div key={platform} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-slate-700 w-20">{platform}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-500 w-20 text-right">{clicks}회 ({Math.round(percentage)}%)</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">아직 클릭 데이터가 없습니다.</p>
                  )}
                </div>

                {/* Source Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">소스별 클릭</h3>
                  {Object.entries(stats.bySource).length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(stats.bySource)
                        .sort(([, a], [, b]) => b - a)
                        .map(([source, clicks]) => (
                          <div key={source} className="bg-slate-50 rounded-lg px-4 py-2">
                            <p className="text-xs text-slate-500">{source}</p>
                            <p className="text-lg font-bold text-slate-900">{clicks}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">아직 클릭 데이터가 없습니다.</p>
                  )}
                </div>

                {/* Top Products */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">인기 상품 TOP 10</h3>
                  {stats.topProducts.length > 0 ? (
                    <div className="space-y-2">
                      {stats.topProducts.map((item, i) => (
                        <div key={item.product} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                          <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-sm text-slate-700">{item.product}</span>
                          <span className="text-sm font-bold text-slate-900">{item.clicks}회</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">아직 클릭 데이터가 없습니다.</p>
                  )}
                </div>

                {/* Daily Chart (simple text view) */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">일별 클릭 추이</h3>
                  {Object.entries(stats.byDay).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(stats.byDay)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([day, clicks]) => {
                          const maxClicks = Math.max(...Object.values(stats.byDay));
                          const width = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0;
                          return (
                            <div key={day} className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 w-24 shrink-0">{day}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-12 text-right">{clicks}</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">아직 클릭 데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <p className="text-slate-400">통계 데이터를 불러오는 중이거나, 아직 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sync' && (
          <SyncPanel token={token} />
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
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">상품 자동 동기화 관리</h2>
        <p className="text-sm text-slate-500 mb-6">
          네이버 쇼핑 API에서 카테고리별 인기 상품을 자동 수집합니다. 서버 시작 시 자동 동기화되며, 이후 6시간마다 갱신됩니다.
        </p>

        {/* 수동 동기화 */}
        <div className="flex items-end gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">동기화 대상</label>
            <select
              value={syncType}
              onChange={e => setSyncType(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
            syncResult.includes('완료') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {syncResult}
          </div>
        )}
      </div>

      {/* 카탈로그 통계 */}
      {syncStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['laptop', 'monitor', 'desktop'].map(type => {
            const s = (syncStats as Record<string, Record<string, unknown>>)[type];
            if (!s) return null;
            const labels: Record<string, string> = { laptop: '노트북', monitor: '모니터', desktop: '데스크탑' };
            const colors: Record<string, string> = { laptop: 'emerald', monitor: 'purple', desktop: 'blue' };
            const color = colors[type] || 'slate';
            return (
              <div key={type} className={`bg-white rounded-xl border border-slate-200 p-6`}>
                <h3 className={`text-lg font-semibold text-${color}-600 mb-3`}>{labels[type]}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">전체 상품</span>
                    <span className="font-semibold text-slate-900">{String(s.total || 0)}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">자동 수집</span>
                    <span className="font-medium text-blue-600">{String(s.autoGenerated || 0)}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">수동 큐레이션</span>
                    <span className="font-medium text-emerald-600">{String(s.manual || 0)}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">동기화 횟수</span>
                    <span className="text-slate-700">{String(s.syncCount || 0)}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">마지막 동기화</span>
                    <span className="text-slate-700 text-xs">
                      {s.lastSync ? new Date(s.lastSync as string).toLocaleString('ko-KR') : '없음'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 동기화 설명 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-3">자동 동기화 동작 방식</h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2"><span className="shrink-0">1.</span> 서버 시작 30초 후 첫 동기화 자동 실행</li>
          <li className="flex gap-2"><span className="shrink-0">2.</span> 이후 6시간마다 자동 갱신 (노트북, 모니터, 데스크탑)</li>
          <li className="flex gap-2"><span className="shrink-0">3.</span> 네이버 쇼핑 API에서 카테고리별 인기 검색어로 상품 수집</li>
          <li className="flex gap-2"><span className="shrink-0">4.</span> 기존 상품: 가격 자동 업데이트 & 가격 히스토리 기록</li>
          <li className="flex gap-2"><span className="shrink-0">5.</span> 신규 상품: 자동 추가 (브랜드/카테고리 자동 분류)</li>
          <li className="flex gap-2"><span className="shrink-0">6.</span> 부품/악세서리 자동 필터링 (가격 범위 + 키워드)</li>
          <li className="flex gap-2"><span className="shrink-0">7.</span> 프론트엔드는 API 우선, 실패 시 정적 데이터 자동 fallback</li>
        </ul>
        <div className="mt-4 text-xs text-slate-400">
          환경변수: AUTO_SYNC_ENABLED=true/false, SYNC_INTERVAL_HOURS=6
        </div>
      </div>
    </div>
  );
}
