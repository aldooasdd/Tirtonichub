import { strict as assert } from "node:assert";
import { hashPassword, verifyPassword } from "./password";

const h = hashPassword("rahasia");
assert.equal(verifyPassword("rahasia", h), true);
assert.equal(verifyPassword("salah", h), false);
assert.equal(verifyPassword("rahasia", null), false);
assert.equal(verifyPassword("rahasia", "bukan-format"), false);

console.log("password ok");
