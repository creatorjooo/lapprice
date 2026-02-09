import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import type { Laptop } from '@/types';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  laptop: Laptop | null;
  onSetAlert: (laptopId: string, targetPrice: number, email: string) => void;
}

export default function PriceAlertModal({
  isOpen,
  onClose,
  laptop,
  onSetAlert,
}: PriceAlertModalProps) {
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!laptop) return null;

  const currentPrice = laptop.prices.current;
  const lowestPrice = laptop.prices.lowest;
  const suggestedPrice = Math.floor(currentPrice * 0.9);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetPrice > 0 && email) {
      onSetAlert(laptop.id, targetPrice, email);
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setEmail('');
        setTargetPrice(0);
        onClose();
      }, 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            가격 알림 설정
          </DialogTitle>
          <DialogDescription>
            목표 가격에 도달하면 이메일로 알려드립니다
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">알림이 설정되었습니다!</h3>
            <p className="text-sm text-slate-500">
              목표 가격에 도달하면 {email}로 알림을 볂내드립니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">{laptop.brand}</p>
              <p className="font-semibold mb-2">{laptop.name}</p>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">현재 {currentPrice.toLocaleString()}원</Badge>
                <Badge variant="outline" className="text-emerald-600">
                  역대최저 {lowestPrice.toLocaleString()}원
                </Badge>
              </div>
            </div>

            {/* Target Price */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>목표 가격</Label>
                <span className="text-lg font-bold text-emerald-600">
                  {targetPrice.toLocaleString()}원
                </span>
              </div>
              <Slider
                value={[targetPrice]}
                onValueChange={(value) => setTargetPrice(value[0])}
                max={currentPrice}
                step={10000}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>0원</span>
                <span>현재가: {currentPrice.toLocaleString()}원</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setTargetPrice(suggestedPrice)}
              >
                {suggestedPrice.toLocaleString()}원 (현재가의 90%) 추천
              </Button>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일 주소</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Info */}
            <div className="text-xs text-slate-500 space-y-1">
              <p>• 목표 가격에 도달하면 즉시 이메일로 알림을 볂냅니다.</p>
              <p>• 알림은 30일간 유효하며, 만료 후 자동으로 해제됩니다.</p>
              <p>• 언제든 알림 설정을 변경하거나 해제할 수 있습니다.</p>
            </div>

            <Button type="submit" className="w-full">
              <Bell className="w-4 h-4 mr-2" />
              알림 설정하기
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
