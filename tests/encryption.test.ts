import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/core/notion/encryption.js';

describe('Encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const originalText = 'my-secret-token-123';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(originalText);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const text = 'test-data';
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(text);
    expect(decrypt(encrypted2)).toBe(text);
  });

  it('should handle special characters', () => {
    const text = 'Test 123 !@#$%^&*() 你好 🎉';
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(text);
  });

  it('should handle long strings', () => {
    const text = 'a'.repeat(10000);
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(text);
  });

  it('should throw on invalid encrypted data format', () => {
    expect(() => decrypt('invalid-format')).toThrow();
    expect(() => decrypt('a:b')).toThrow();
  });

  it('should throw on tampered data', () => {
    const encrypted = encrypt('test');
    const tampered = encrypted.substring(0, encrypted.length - 5) + 'xxxxx';

    expect(() => decrypt(tampered)).toThrow();
  });
});
