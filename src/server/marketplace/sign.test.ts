import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sameSig, shopeeSign, tiktokSign } from "./sign";

const h = (k: string, m: string) => createHmac("sha256", k).update(m).digest("hex");

test("shopeeSign: base string partner_id+path+ts+token+shop", () => {
  assert.equal(shopeeSign("key", "123", "/api/v2/order/get_order_list", 1700000000, "tok", "99"), h("key", "123/api/v2/order/get_order_list1700000000tok99"));
  assert.equal(shopeeSign("key", "123", "/api/v2/shop/auth_partner", 1700000000), h("key", "123/api/v2/shop/auth_partner1700000000"));
});

test("tiktokSign: param urut, buang sign & access_token, dibungkus secret", () => {
  const q = { timestamp: "1700000000", app_key: "ak", shop_cipher: "c", sign: "x", access_token: "t" };
  assert.equal(tiktokSign("s", "/order/202309/orders/search", q, '{"a":1}'), h("s", 's/order/202309/orders/searchapp_keyakshop_cipherctimestamp1700000000{"a":1}s'));
});

test("sameSig", () => {
  assert.equal(sameSig("abc", "abc"), true);
  assert.equal(sameSig("abc", "abd"), false);
  assert.equal(sameSig("", "a"), false);
});
