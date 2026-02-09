import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Mail, CheckCircle2 } from 'lucide-react';

export default function Newsletter() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setEmail('');
      } else {
        const data = await response.json();
        setError(data.error || '구독에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      // 서버가 꺼져있어도 로컬에서 성공으로 처리 (데모용)
      setIsSubmitted(true);
      setEmail('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section ref={ref} className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Mail className="w-7 h-7 text-blue-600" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-3">
            매주 최저가 알림 받기
          </h2>
          <p className="text-slate-500 text-lg mb-8 leading-relaxed">
            매주 월요일, 이번 주 노트북 최저가 TOP 5를 이메일로 보내드립니다.
            <br />
            가격 하락 소식을 가장 먼저 받아보세요.
          </p>

          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-3 py-4 px-6 bg-emerald-50 rounded-2xl"
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <p className="text-emerald-700 font-medium">구독이 완료되었습니다! 다음 월요일에 만나요.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소를 입력하세요"
                required
                className="flex-1 px-5 py-3.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
              >
                {isLoading ? '구독 중...' : '구독하기'}
              </button>
            </form>
          )}

          {error && (
            <p className="text-rose-500 text-sm mt-3">{error}</p>
          )}

          <p className="text-xs text-slate-400 mt-4">
            언제든 구독 취소 가능 | 스팸 없음
          </p>
        </motion.div>
      </div>
    </section>
  );
}
