import { useState, useEffect, useCallback } from 'react';

/**
 * useLocalStorage - useState와 동일한 인터페이스로 localStorage 영구 저장
 * 새로고침/브라우저 재시작 후에도 데이터 유지
 * 탭 간 동기화 지원
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // 초기값 로드
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`useLocalStorage: "${key}" 로드 실패`, error);
      return initialValue;
    }
  });

  // 값 설정 (함수형 업데이트 지원)
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const newValue = value instanceof Function ? value(prev) : value;
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          }
          return newValue;
        });
      } catch (error) {
        console.warn(`useLocalStorage: "${key}" 저장 실패`, error);
      }
    },
    [key]
  );

  // 다른 탭에서 변경 시 동기화
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch {
          // 파싱 실패 시 무시
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}
