import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSessionCookie,
  decryptSecret,
  encryptSecret,
  hashSecret,
  sessionCookie,
  signStudentToken,
  teacherSessionCookieName,
  verifySecret,
  verifyStudentToken
} from './security';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  SERVER_ENCRYPTION_KEY: process.env.SERVER_ENCRYPTION_KEY
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  restoreEnv();
});

describe('api security helpers', () => {
  it('hashes teacher secrets without storing the original value', () => {
    const encoded = hashSecret('1234', '00112233445566778899aabbccddeeff');

    expect(encoded).not.toContain('1234');
    expect(verifySecret('1234', encoded)).toBe(true);
    expect(verifySecret('0000', encoded)).toBe(false);
  });

  it('sets HttpOnly SameSite teacher session cookies', () => {
    const cookie = sessionCookie('session-token', new Date('2030-01-01T00:00:00Z'));

    expect(cookie).toContain(`${teacherSessionCookieName}=session-token`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(clearSessionCookie()).toContain('Max-Age=0');
  });

  it('signs student context tokens and rejects tampering', () => {
    const token = signStudentToken(
      { schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' },
      60,
      'test-secret'
    );

    expect(verifyStudentToken(token, 'test-secret')).toMatchObject({
      schoolId: 'school-1',
      classId: 'class-1',
      studentId: 'student-1'
    });
    expect(verifyStudentToken(`${token.slice(0, -1)}x`, 'test-secret')).toBeNull();
  });

  it('fails before issuing student tokens when production SESSION_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;

    expect(() => signStudentToken({ schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' })).toThrow(
      'SESSION_SECRET is required'
    );
  });

  it('rejects known default SESSION_SECRET values', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'local-development-session-secret';

    expect(() => signStudentToken({ schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' })).toThrow(
      'SESSION_SECRET cannot use a known local default'
    );
  });

  it('keeps explicit test secret signing and verification behavior unchanged', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;

    const token = signStudentToken(
      { schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' },
      60,
      'explicit-test-session-secret'
    );

    expect(verifyStudentToken(token, 'explicit-test-session-secret')).toMatchObject({
      schoolId: 'school-1',
      classId: 'class-1',
      studentId: 'student-1'
    });
    expect(verifyStudentToken(token, 'different-test-session-secret')).toBeNull();
  });

  it('fails token verification when runtime SESSION_SECRET is missing', () => {
    const token = signStudentToken(
      { schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' },
      60,
      'explicit-test-session-secret'
    );
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;

    expect(() => verifyStudentToken(token)).toThrow('SESSION_SECRET is required');
  });

  it('encrypts provider keys for storage', () => {
    const encrypted = encryptSecret('sk-local-test', 'server-key');

    expect(encrypted).not.toContain('sk-local-test');
    expect(decryptSecret(encrypted, 'server-key')).toBe('sk-local-test');
  });

  it('rejects missing SERVER_ENCRYPTION_KEY before provider key encryption', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SERVER_ENCRYPTION_KEY;

    expect(() => encryptSecret('sk-local-test')).toThrow('SERVER_ENCRYPTION_KEY is required');
  });

  it('rejects known default SERVER_ENCRYPTION_KEY values', () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVER_ENCRYPTION_KEY = 'replace-with-random-secret';

    expect(() => encryptSecret('sk-local-test')).toThrow('SERVER_ENCRYPTION_KEY cannot use a known local default');
  });
});
