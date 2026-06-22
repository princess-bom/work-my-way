import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

export const teacherSessionCookieName = 'kkumideun_teacher_session';
const studentTokenPrefix = 'student-v1';
const secretHashPrefix = 'scrypt';
const encryptionPrefix = 'enc';
const weakSecretValues = new Set([
  'local-development-session-secret',
  'replace-with-random-secret',
  'change-me',
  'changeme',
  'secret',
  'password'
]);

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function fromBase64UrlJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function requiredRuntimeSecret(envName: 'SESSION_SECRET' | 'SERVER_ENCRYPTION_KEY', explicit?: string) {
  if (explicit !== undefined) {
    if (!explicit.trim()) throw new Error(`${envName} explicit test secret cannot be empty`);
    return explicit;
  }

  const source = process.env[envName]?.trim();
  if (!source) throw new Error(`${envName} is required`);
  if (weakSecretValues.has(source.toLowerCase())) throw new Error(`${envName} cannot use a known local default`);
  return source;
}

function serverSecret(explicit?: string) {
  return requiredRuntimeSecret('SESSION_SECRET', explicit);
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string, salt = randomBytes(16).toString('hex')) {
  const n = 16_384;
  const r = 8;
  const p = 1;
  const hash = scryptSync(secret, salt, 32, { N: n, r, p }).toString('hex');
  return `${secretHashPrefix}$${n}$${r}$${p}$${salt}$${hash}`;
}

export function verifySecret(secret: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== secretHashPrefix) return false;
  const [, nRaw, rRaw, pRaw, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(secret, salt, expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw)
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function parseCookies(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies.set(key, decodeURIComponent(value));
  }
  return cookies;
}

export function sessionCookie(token: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${teacherSessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${teacherSessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export type StudentTokenPayload = {
  schoolId: string;
  classId: string;
  studentId: string;
  exp: number;
};

export function signStudentToken(payload: Omit<StudentTokenPayload, 'exp'>, ttlSeconds = 8 * 60 * 60, explicitSecret?: string) {
  const fullPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encodedPayload = base64UrlJson(fullPayload);
  const signature = createHmac('sha256', serverSecret(explicitSecret)).update(`${studentTokenPrefix}.${encodedPayload}`).digest('base64url');
  return `${studentTokenPrefix}.${encodedPayload}.${signature}`;
}

export function verifyStudentToken(token: string | undefined, explicitSecret?: string): StudentTokenPayload | null {
  if (!token) return null;
  const [prefix, encodedPayload, signature] = token.split('.');
  if (prefix !== studentTokenPrefix || !encodedPayload || !signature) return null;
  const expected = createHmac('sha256', serverSecret(explicitSecret)).update(`${prefix}.${encodedPayload}`).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;
  const payload = fromBase64UrlJson<StudentTokenPayload>(encodedPayload);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function readBearerStudentToken(req: Request) {
  const headerToken = req.header('x-student-context');
  if (headerToken) return headerToken;
  const authorization = req.header('authorization');
  if (authorization?.startsWith('Student ')) return authorization.slice('Student '.length);
  const body = req.body as { studentToken?: unknown } | undefined;
  return typeof body?.studentToken === 'string' ? body.studentToken : undefined;
}

export function encryptionKey(explicit?: string) {
  const source = requiredRuntimeSecret('SERVER_ENCRYPTION_KEY', explicit);
  return createHash('sha256').update(source).digest();
}

export function encryptSecret(secret: string, explicitKey?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(explicitKey), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptionPrefix}$v1$${iv.toString('base64url')}$${tag.toString('base64url')}$${ciphertext.toString('base64url')}`;
}

export function decryptSecret(encrypted: string, explicitKey?: string) {
  const parts = encrypted.split('$');
  if (parts.length !== 5 || parts[0] !== encryptionPrefix || parts[1] !== 'v1') throw new Error('unsupported_encrypted_secret');
  const [, , ivRaw, tagRaw, ciphertextRaw] = parts;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(explicitKey), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function setJson(res: Response, status: number, body: unknown) {
  res.status(status).type('application/json; charset=utf-8').send(JSON.stringify(body));
}
