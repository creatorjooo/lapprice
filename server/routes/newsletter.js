const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

// 데이터 디렉터리 생성
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// subscribers.json 초기화
if (!fs.existsSync(SUBSCRIBERS_FILE)) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));
}

function readSubscribers() {
  try {
    const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { subscribers: [] };
  }
}

function writeSubscribers(data) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
}

/**
 * 뉴스레터 구독
 * POST /api/newsletter/subscribe
 * Body: { email }
 */
router.post('/subscribe', (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: '유효한 이메일 주소를 입력해주세요.' });
    }

    const data = readSubscribers();

    // 중복 확인
    if (data.subscribers.some((s) => s.email === email)) {
      return res.status(409).json({ error: '이미 구독된 이메일입니다.' });
    }

    data.subscribers.push({
      email,
      subscribedAt: new Date().toISOString(),
      isActive: true,
    });

    writeSubscribers(data);

    res.json({ success: true, message: '구독이 완료되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 구독자 목록 (관리자용)
 * GET /api/newsletter/subscribers
 */
router.get('/subscribers', (req, res) => {
  try {
    const data = readSubscribers();
    res.json({
      total: data.subscribers.length,
      active: data.subscribers.filter((s) => s.isActive).length,
      subscribers: data.subscribers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
