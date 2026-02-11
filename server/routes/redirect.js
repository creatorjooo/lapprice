const express = require('express');

const { withTimeout } = require('../utils/helpers');
const {
  enqueueOfferVerification,
  verifyOfferById,
  isClickTimeVerifyEnabled,
  getVerificationTimeoutMs,
} = require('../services/offerVerification');

const router = express.Router();

function wantsHtml(req) {
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html');
}

function renderVerificationFailHtml(message, offerId) {
  const safeMessage = String(message || '현재 가격 검증 실패, 잠시 후 재시도해주세요.');
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>가격 검증 실패</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { max-width: 480px; width: 100%; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; color: #475569; line-height: 1.5; }
      .id { margin-top: 12px; color: #94a3b8; font-size: 12px; }
      .btn { margin-top: 16px; display: inline-block; padding: 10px 14px; border-radius: 10px; background: #0f172a; color: #fff; text-decoration: none; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>가격 검증 실패</h1>
        <p>${safeMessage}</p>
        <p class="id">offerId: ${offerId}</p>
        <a class="btn" href="/">메인으로 이동</a>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * GET /r/:offerId
 * 클릭 직전 재검증 후 성공 시 리다이렉트
 */
router.get('/:offerId', async (req, res) => {
  const { offerId } = req.params;
  if (!offerId) {
    return res.status(400).json({ error: 'offerId 필요' });
  }

  const timeoutMs = getVerificationTimeoutMs() + 1000;

  try {
    const result = isClickTimeVerifyEnabled()
      ? await withTimeout(
          enqueueOfferVerification(offerId, { trigger: 'click', force: true, allowUnverifiedRedirect: true }),
          timeoutMs,
        )
      : await withTimeout(
          verifyOfferById(offerId, { trigger: 'click', force: false, allowUnverifiedRedirect: true }),
          timeoutMs,
        );

    if (!result?.redirectUrl) {
      const message = '현재 가격 검증 실패, 잠시 후 재시도해주세요.';
      if (wantsHtml(req)) {
        return res.status(409).type('html').send(renderVerificationFailHtml(message, offerId));
      }
      return res.status(409).json({
        error: message,
        code: result?.code || 'VERIFY_FAILED',
        offerId,
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, result.redirectUrl);
  } catch (err) {
    const message = '현재 가격 검증 실패, 잠시 후 재시도해주세요.';
    if (wantsHtml(req)) {
      return res.status(409).type('html').send(renderVerificationFailHtml(message, offerId));
    }
    return res.status(409).json({
      error: message,
      code: 'VERIFY_TIMEOUT',
      offerId,
      message: err.message,
    });
  }
});

module.exports = router;
