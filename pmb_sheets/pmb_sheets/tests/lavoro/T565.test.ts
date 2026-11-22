// T565: BLAKE2b e Argon2id (comune/src/protezione/argon2.ts) con i vettori di prova delle specifiche RFC 7693 (appendice A) e RFC 9106 (5.3).
import { describe, expect, test } from 'vitest';
import { argon2id, blake2b } from '@comune/protezione/argon2';

const esa = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('T565: BLAKE2b e Argon2id', () => {
  test('BLAKE2b-512("abc") come RFC 7693', () => {
    expect(esa(blake2b(new TextEncoder().encode('abc')))).toBe('ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923');
  });
  test('BLAKE2b-512 della stringa vuota e di 200 byte (più blocchi)', () => {
    expect(esa(blake2b(new Uint8Array(0)))).toBe('786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce');
    expect(blake2b(new Uint8Array(200), 32).length).toBe(32);
  });
  test('Argon2id come RFC 9106 5.3', () => {
    const tag = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), { giri: 3, memoriaKiB: 32, corsie: 4, lunghezza: 32, segreto: new Uint8Array(8).fill(3), associati: new Uint8Array(12).fill(4) });
    expect(esa(tag)).toBe('0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659');
  });
});
