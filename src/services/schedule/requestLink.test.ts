import { describe, expect, it } from 'vitest';
import { normalizeRequestLink } from './requestLink';

const ID = 'AbCdEfGhIjKlMnOpQrSt12';

describe('normalizeRequestLink', () => {
  it('accepts a genuine SNV2 staff request link (trimming whitespace)', () => {
    expect(normalizeRequestLink(`  https://hussein-zreik.github.io/SNV2/request.html?f=${ID} `)).toBe(
      `https://hussein-zreik.github.io/SNV2/request.html?f=${ID}`,
    );
  });

  it('strips anything except the form id', () => {
    expect(normalizeRequestLink(`https://hussein-zreik.github.io/SNV2/request.html?f=${ID}&utm=x#top`)).toBe(
      `https://hussein-zreik.github.io/SNV2/request.html?f=${ID}`,
    );
  });

  it('rejects other sites, other pages, http, bad ids and junk', () => {
    expect(normalizeRequestLink(`https://evil.example/SNV2/request.html?f=${ID}`)).toBeNull();
    expect(normalizeRequestLink(`https://hussein-zreik.github.io/SNV2/index.html?f=${ID}`)).toBeNull();
    expect(normalizeRequestLink(`http://hussein-zreik.github.io/SNV2/request.html?f=${ID}`)).toBeNull();
    expect(normalizeRequestLink('https://hussein-zreik.github.io/SNV2/request.html?f=short')).toBeNull();
    expect(normalizeRequestLink('https://hussein-zreik.github.io/SNV2/request.html')).toBeNull();
    expect(normalizeRequestLink('not a link')).toBeNull();
  });
});
