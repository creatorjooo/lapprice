import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import type { PriceHistory } from '@/types';

interface PriceHistoryChartProps {
  data: PriceHistory[];
  color?: string;
}

function formatPriceTick(value: number) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}천만`;
  if (value >= 10000) return `${Math.round(value / 10000)}만`;
  return value.toLocaleString();
}

function getYAxisDomain(data: PriceHistory[]): [number, number] {
  const prices = data.map((d) => d.price).filter((n) => typeof n === 'number' && n > 0);
  if (prices.length === 0) return [0, 100];

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    const pad = Math.max(10000, Math.round(min * 0.05));
    return [Math.max(0, min - pad), max + pad];
  }

  const span = max - min;
  const pad = Math.max(5000, Math.round(span * 0.12));
  return [Math.max(0, min - pad), max + pad];
}

export default function PriceHistoryChart({ data, color = '#10b981' }: PriceHistoryChartProps) {
  const domain = getYAxisDomain(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 18, left: 18, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" minTickGap={20} />
        <YAxis
          width={84}
          domain={domain}
          tickFormatter={formatPriceTick}
        />
        <RechartsTooltip
          formatter={(value: number) => [`${value.toLocaleString()}원`, '가격']}
          labelFormatter={(label) => `날짜: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
