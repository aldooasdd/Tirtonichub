import { createHmac, timingSafeEqual } from "node:crypto";

const hmac = (key: string, msg: string) => createHmac("sha256", key).update(msg).digest("hex");

/** Shopee Open Platform v2: sign = HMAC-SHA256(partner_key, partner_id + path + timestamp [+ access_token + shop_id]). */
export function shopeeSign(partnerKey: string, partnerId: string, path: string, ts: number, accessToken = "", shopId = ""): string {
  return hmac(partnerKey, `${partnerId}${path}${ts}${accessToken}${shopId}`);
}

/** TikTok Shop (Tokopedia): sign = HMAC-SHA256(secret, secret + path + sorted(k+v tanpa sign/access_token) + body + secret). */
export function tiktokSign(appSecret: string, path: string, query: Record<string, string>, body = ""): string {
  const params = Object.keys(query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort()
    .map((k) => k + query[k])
    .join("");
  return hmac(appSecret, `${appSecret}${path}${params}${body}${appSecret}`);
}

/** Bandingkan signature webhook (hex) tanpa bocor waktu. */
export function sameSig(a: string, b: string): boolean {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Webhook Shopee: Authorization = HMAC-SHA256(partner_key, url + "|" + body). */
export const shopeePushSig = (partnerKey: string, url: string, body: string) => hmac(partnerKey, `${url}|${body}`);

/** Webhook TikTok Shop: Authorization = HMAC-SHA256(app_secret, app_key + body). */
export const tiktokPushSig = (appSecret: string, appKey: string, body: string) => hmac(appSecret, `${appKey}${body}`);
