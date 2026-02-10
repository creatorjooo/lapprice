/**
 * 스토어 가격 갱신 시각 포맷터
 * - ISO 문자열이면 상대시간으로 변환
 * - 기존 데이터(예: "10분 전")는 그대로 반환
 */
export function formatStoreUpdatedAt(value?: string): string {
  if (!value) return '방금 전';
  const raw = String(value).trim();
  if (!raw) return '방금 전';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60 * 1000) return '방금 전';

  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  return parsed.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

