const CryptoJS = require('crypto-js');

/**
 * 쿠팡 API signed-date 포맷: YYMMDDTHHMMSSZ
 * 예) 260210T123456Z
 */
function getCoupangSignedDate(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .slice(2);
}

/**
 * 쿠팡 파트너스 API Authorization 헤더 생성
 */
function buildCoupangAuthorization({ method, apiPath, query }) {
  const accessKey = (process.env.COUPANG_ACCESS_KEY || '').trim();
  const secretKey = (process.env.COUPANG_SECRET_KEY || '').trim();
  if (!accessKey || !secretKey) return null;

  const normalizedMethod = String(method || 'GET').toUpperCase();
  const normalizedQuery = query ? String(query).replace(/^\?/, '') : '';
  const signedDate = getCoupangSignedDate();
  const message = normalizedQuery
    ? `${signedDate}${normalizedMethod}${apiPath}${normalizedQuery}`
    : `${signedDate}${normalizedMethod}${apiPath}`;
  const signature = CryptoJS.HmacSHA256(message, secretKey).toString(CryptoJS.enc.Hex);

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

module.exports = {
  getCoupangSignedDate,
  buildCoupangAuthorization,
};
