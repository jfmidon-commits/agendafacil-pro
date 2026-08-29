import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.CANCEL_SIGNING_SECRET;
  if (!value || value.length < 32) {
    throw new Error("CANCEL_SIGNING_SECRET must contain at least 32 characters");
  }
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createCancelToken(appointmentId: string, expiresAtEpochSeconds: number) {
  const payload = `${appointmentId}.${Math.floor(expiresAtEpochSeconds)}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyCancelToken(token: string) {
  const [appointmentId, expText, supplied] = token.split(".");
  if (!appointmentId || !expText || !supplied) return null;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;

  const payload = `${appointmentId}.${expText}`;
  const expected = signature(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { appointmentId, expiresAt: exp };
}
