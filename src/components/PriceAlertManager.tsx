import { Bell, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { PriceAlert, Product } from '@/types';

interface PriceAlertManagerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  products: Product[];
  onToggleAlert: (alertId: string) => void;
  onDeleteAlert: (alertId: string) => void;
}

export default function PriceAlertManager({
  isOpen,
  onClose,
  alerts,
  products,
  onToggleAlert,
  onDeleteAlert,
}: PriceAlertManagerProps) {
  const getProduct = (productId: string) => products.find((p) => p.id === productId);

  const getProgress = (currentPrice: number, originalPrice: number, targetPrice: number) => {
    if (currentPrice <= targetPrice) return 100;
    const totalDrop = originalPrice - targetPrice;
    const currentDrop = originalPrice - currentPrice;
    if (totalDrop <= 0) return 0;
    return Math.min(Math.round((currentDrop / totalDrop) * 100), 100);
  };

  const getExpiryDate = (createdAt: string) => {
    const date = new Date(createdAt);
    date.setDate(date.getDate() + 30);
    return date;
  };

  const isExpired = (createdAt: string) => {
    return new Date() > getExpiryDate(createdAt);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            가격 알림 관리
          </SheetTitle>
          <SheetDescription>
            설정된 가격 알림 {alerts.length}개
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {alerts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">설정된 가격 알림이 없습니다.</p>
              <p className="text-xs mt-1">상품 카드에서 🔔 버튼으로 알림을 설정하세요.</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const product = getProduct(alert.laptopId);
              if (!product) return null;

              const isReached = product.prices.current <= alert.targetPrice;
              const expired = isExpired(alert.createdAt);
              const progress = getProgress(
                product.prices.current,
                product.prices.original,
                alert.targetPrice
              );

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isReached
                      ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                      : expired
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  {/* 헤더 */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">{product.brand}</p>
                      <p className="text-sm font-semibold truncate">{product.name}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {isReached && (
                        <Badge className="bg-emerald-500 text-white text-[10px]">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" />
                          목표 달성!
                        </Badge>
                      )}
                      {expired && !isReached && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          <Clock className="w-3 h-3 mr-0.5" />
                          만료됨
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-500">
                      현재가: <span className="font-semibold text-slate-900 dark:text-white">{product.prices.current.toLocaleString()}원</span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      목표가: <span className="font-bold">{alert.targetPrice.toLocaleString()}원</span>
                    </span>
                  </div>

                  {/* 진행률 */}
                  <div className="mb-3">
                    <Progress value={progress} className="h-2" />
                    <p className="text-[10px] text-slate-400 mt-1 text-right">{progress}% 진행</p>
                  </div>

                  {/* 메타 정보 */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-3">
                    <span>📧 {alert.email}</span>
                    <span>
                      만료: {getExpiryDate(alert.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.isActive}
                        onCheckedChange={() => onToggleAlert(alert.id)}
                      />
                      <span className="text-xs text-slate-500">
                        {alert.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => onDeleteAlert(alert.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      삭제
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
