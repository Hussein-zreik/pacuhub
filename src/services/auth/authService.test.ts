import { describe, expect, it } from 'vitest';
import { isEmailDomainAllowed } from './authService';

describe('isEmailDomainAllowed', () => {
  it('allows everything when no domains are configured', () => {
    expect(isEmailDomainAllowed('a@gmail.com', [])).toBe(true);
  });
  it('matches domains case-insensitively and rejects missing emails', () => {
    expect(isEmailDomainAllowed('Nurse@AUB.edu.lb', ['aub.edu.lb'])).toBe(true);
    expect(isEmailDomainAllowed('nurse@gmail.com', ['aub.edu.lb'])).toBe(false);
    expect(isEmailDomainAllowed(null, ['aub.edu.lb'])).toBe(false);
  });
});
