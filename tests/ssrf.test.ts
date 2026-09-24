import { describe, expect, it } from 'vitest';
import { validateTargetUrl } from '../server/security/ssrf.js';

describe('SSRF protection', () => {
  it('blocks localhost', async () => {
    const result = await validateTargetUrl('http://127.0.0.1/');
    expect(result.isValid).toBe(false);
  });

  it('blocks metadata IP', async () => {
    const result = await validateTargetUrl('http://169.254.169.254/latest/meta-data/');
    expect(result.isValid).toBe(false);
  });
});
