const express = require('express');

const { withTimeout } = require('../utils/helpers');
const {
  enqueueOfferVerification,
  verifyOfferById,
  isClickTimeVerifyEnabled,
  isStrictPriceGuardEnabled,
  isDegradedRedirectAllowed,
  getClickVerifyTimeoutMs,
  verifyPriceToken,
  createConfirmToken,
  verifyConfirmToken,
} = require('../services/offerVerification');

const router = express.Router();

function wantsHtml(req) {
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html');
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const parsed = parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function sendPayload(req, res, payload) {
  if (!wantsHtml(req)) {
    return res.status(200).json(payload);
  }

  if (payload.action === 'PRICE_CHANGED') {
    const oldPrice = toNumber(payload.oldPrice);
    const newPrice = toNumber(payload.newPrice);
    const confirmToken = encodeURIComponent(String(payload.confirmToken || ''));
    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>가격 변경 안내</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { max-width: 520px; width: 100%; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 6px; color: #475569; line-height: 1.5; }
      .price { margin: 14px 0; font-weight: 700; color: #0f172a; }
      .btn { margin-top: 14px; display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 10px; border: 0; cursor: pointer; font-size: 14px; }
      .btn-primary { background: #0f172a; color: #fff; }
      .btn-secondary { background: #e2e8f0; color: #0f172a; margin-left: 8px; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>가격이 변경되었습니다</h1>
        <p>목록에서 본 가격과 현재 가격이 달라졌습니다.</p>
        <p class="price">목록가 ${oldPrice.toLocaleString()}원 → 최신가 ${newPrice.toLocaleString()}원</p>
        <form method="post" action="/r/${payload.offerId}/confirm">
          <input type="hidden" name="confirmToken" value="${confirmToken}" />
          <button class="btn btn-primary" type="submit">최신가로 이동</button>
          <a class="btn btn-secondary" href="/">취소</a>
        </form>
      </div>
    </div>
  </body>
</html>`;
    return res.status(200).type('html').send(html);
  }

  const message = payload.error || '현재 가격을 확인할 수 없어 이동할 수 없습니다.';
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>가격 확인 실패</title>
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
        <h1>가격 확인 실패</h1>
        <p>${String(message)}</p>
        <p class="id">offerId: ${payload.offerId}</p>
        <a class="btn" href="/">메인으로 이동</a>
      </div>
    </div>
  </body>
</html>`;
  return res.status(200).type('html').send(html);
}

function extractConfirmToken(req) {
  const bodyToken = req.body?.confirmToken;
  if (bodyToken) return String(bodyToken);
  const queryToken = req.query?.confirmToken;
  if (queryToken) return String(queryToken);
  return '';
}

async function runOfferGuard(offerId, options) {
  if (isClickTimeVerifyEnabled()) {
    return enqueueOfferVerification(offerId, options);
  }
  return verifyOfferById(offerId, options);
}

/**
 * GET /r/:offerId
 * 클릭 직전 재검증
 */
router.get('/:offerId', async (req, res) => {
  const { offerId } = req.params;
  if (!offerId) {
    return res.status(400).json({ error: 'offerId 필요' });
  }

  const strictGuard = isStrictPriceGuardEnabled();
  const allowDegraded = isDegradedRedirectAllowed();
  const timeoutMs = getClickVerifyTimeoutMs() + 500;
  const priceToken = String(req.query.priceToken || '').trim();
  const tokenResult = priceToken ? verifyPriceToken(priceToken, offerId) : { ok: false, code: 'TOKEN_MISSING' };
  const listedPrice = tokenResult.ok ? toNumber(tokenResult.payload.listedPrice) : toNumber(req.query.listedPrice);
  const listedVerifiedAt = tokenResult.ok ? tokenResult.payload.verifiedAt : null;

  try {
    const result = await withTimeout(
      runOfferGuard(offerId, {
        trigger: 'click',
        force: true,
        strictGuard,
        allowUnverifiedRedirect: !strictGuard || allowDegraded,
        listedPrice,
        listedVerifiedAt,
      }),
      timeoutMs,
    );

    if (!result?.redirectUrl) {
      return sendPayload(req, res, {
        action: 'VERIFY_FAILED',
        offerId,
        code: result?.code || 'VERIFY_FAILED',
        error: result?.message || '현재 가격 검증 실패, 잠시 후 재시도해주세요.',
      });
    }

    if (strictGuard && result.priceChanged && toNumber(result.oldPrice) > 0 && toNumber(result.newPrice) > 0) {
      const confirmToken = createConfirmToken({
        offerId,
        oldPrice: result.oldPrice,
        newPrice: result.newPrice,
      });

      if (!confirmToken) {
        return sendPayload(req, res, {
          action: 'VERIFY_FAILED',
          offerId,
          code: 'CONFIRM_TOKEN_CREATE_FAILED',
          error: '가격 변경 확인 토큰 생성 실패',
        });
      }

      return sendPayload(req, res, {
        action: 'PRICE_CHANGED',
        offerId,
        oldPrice: result.oldPrice,
        newPrice: result.newPrice,
        verifiedAt: result.verifiedAt || null,
        confirmToken,
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, result.redirectUrl);
  } catch (err) {
    return sendPayload(req, res, {
      action: 'VERIFY_FAILED',
      offerId,
      code: 'VERIFY_TIMEOUT',
      error: err.message || '현재 가격 검증 실패, 잠시 후 재시도해주세요.',
    });
  }
});

/**
 * POST /r/:offerId/confirm
 * 가격 변경 안내 확인 후 최종 이동
 */
router.post('/:offerId/confirm', async (req, res) => {
  const { offerId } = req.params;
  if (!offerId) {
    return res.status(400).json({ error: 'offerId 필요' });
  }

  const confirmToken = extractConfirmToken(req);
  const verifiedToken = verifyConfirmToken(confirmToken, offerId);
  if (!verifiedToken.ok) {
    return sendPayload(req, res, {
      action: 'VERIFY_FAILED',
      offerId,
      code: verifiedToken.code || 'CONFIRM_TOKEN_INVALID',
      error: '확인 토큰이 유효하지 않습니다. 다시 시도해주세요.',
    });
  }

  const timeoutMs = getClickVerifyTimeoutMs() + 500;
  const strictGuard = isStrictPriceGuardEnabled();

  try {
    const result = await withTimeout(
      runOfferGuard(offerId, {
        trigger: 'confirm',
        force: true,
        strictGuard,
        allowUnverifiedRedirect: false,
        listedPrice: toNumber(verifiedToken.payload.newPrice),
      }),
      timeoutMs,
    );

    if (!result?.redirectUrl) {
      return sendPayload(req, res, {
        action: 'VERIFY_FAILED',
        offerId,
        code: result?.code || 'VERIFY_FAILED',
        error: result?.message || '최신 가격 확인 실패',
      });
    }

    if (strictGuard && result.priceChanged && toNumber(result.newPrice) > 0) {
      const nextConfirmToken = createConfirmToken({
        offerId,
        oldPrice: toNumber(verifiedToken.payload.newPrice),
        newPrice: result.newPrice,
      });
      return sendPayload(req, res, {
        action: 'PRICE_CHANGED',
        offerId,
        oldPrice: toNumber(verifiedToken.payload.newPrice),
        newPrice: result.newPrice,
        verifiedAt: result.verifiedAt || null,
        confirmToken: nextConfirmToken,
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, result.redirectUrl);
  } catch (err) {
    return sendPayload(req, res, {
      action: 'VERIFY_FAILED',
      offerId,
      code: 'VERIFY_TIMEOUT',
      error: err.message || '최신 가격 확인 실패',
    });
  }
});

module.exports = router;
