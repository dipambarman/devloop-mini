import { jest } from '@jest/globals';
import { fingerprint } from '../../src/utils/fingerprint.js';

describe('fingerprint', () => {
  it('strips UUIDs', () => {
    const res1 = fingerprint('Failed id 123e4567-e89b-12d3-a456-426614174000', 'TypeError', '  at test (foo.js:1:2)');
    const res2 = fingerprint('Failed id 987e6543-e21b-12d3-a456-426614174000', 'TypeError', '  at test (foo.js:1:2)');
    expect(res1).toBe(res2);
    expect(res1).toMatch(/^[0-9a-f]{16}$/);
  });

  it('strips 0x-prefixed hex', () => {
    const res1 = fingerprint('Address 0xabcdef12', 'Error', '  at bar.js');
    const res2 = fingerprint('Address 0x12345678', 'Error', '  at bar.js');
    expect(res1).toBe(res2);
  });

  it('strips 8+ char hex strings containing at least one digit', () => {
    const res1 = fingerprint('Commit abcdef12', 'Error', '  at bar.js');
    const res2 = fingerprint('Commit 12345678', 'Error', '  at bar.js');
    expect(res1).toBe(res2);
  });

  it('does not strip non-hex words', () => {
    // Both 'added' and 'dead' are valid hex words, but since they lack digits,
    // they shouldn't be stripped by the hex run rule. (They would have been stripped
    // if the regex didn't require at least one digit).
    const res1 = fingerprint('User added to dead queue', 'Error', '  at bar.js');
    const res2 = fingerprint('User removed from dead queue', 'Error', '  at bar.js');
    expect(res1).not.toBe(res2);
  });

  it('strips standalone numeric IDs', () => {
    const res1 = fingerprint('User 12345 failed', 'Error', '  at bar.js');
    const res2 = fingerprint('User 67890 failed', 'Error', '  at bar.js');
    expect(res1).toBe(res2);
  });

  it('strips line:col references in message', () => {
    const res1 = fingerprint('Syntax error at 12:34', 'Error', '  at bar.js');
    const res2 = fingerprint('Syntax error at 56:78', 'Error', '  at bar.js');
    expect(res1).toBe(res2);
  });

  it('uses UnknownError when errorType is absent', () => {
    const res1 = fingerprint('Something failed', undefined, '  at bar.js');
    const res2 = fingerprint('Something failed', '', '  at bar.js');
    const res3 = fingerprint('Something failed', 'UnknownError', '  at bar.js');
    expect(res1).toBe(res2);
    expect(res1).toBe(res3);
  });

  it('normalizes stack frame (present with basename-only)', () => {
    // Only the basename 'utils.js' and 'foo' function should matter
    const res1 = fingerprint('Err', 'Error', '  at foo (/var/app/src/utils.js:10:5)');
    const res2 = fingerprint('Err', 'Error', '  at foo (C:\\app\\src\\utils.js:20:10)');
    expect(res1).toBe(res2);
  });

  it('normalizes stack frame (anonymous/absent)', () => {
    const res1 = fingerprint('Err', 'Error', '  at <anonymous>:1:1');
    const res2 = fingerprint('Err', 'Error', '');
    const res3 = fingerprint('Err', 'Error', 'Some weird stack string');
    expect(res1).toBe(res2);
    expect(res1).toBe(res3);
  });

  // False-merge case: Different bugs producing the exact same error message and stack trace structure.
  it('documents false-merge case', () => {
    // Both endpoints throw the same error type and generic message, and originate from the same utility function line.
    // They will be incorrectly merged into the same bug.
    const bug1 = fingerprint('Database connection timeout', 'TimeoutError', '  at connect (db.js:10:5)\n  at login (auth.js)');
    const bug2 = fingerprint('Database connection timeout', 'TimeoutError', '  at connect (db.js:10:5)\n  at signup (auth.js)');
    expect(bug1).toBe(bug2);
  });

  // False-split case: Same bug, but source code is bundled differently or stack traces differ in top frame.
  it('documents false-split case', () => {
    // Same error, but one stack trace has a wrapper function or different file name due to bundling/deployment differences.
    // They will be incorrectly split into different bugs.
    const bug1 = fingerprint('Null pointer', 'TypeError', '  at process (data.js:5:1)');
    const bug2 = fingerprint('Null pointer', 'TypeError', '  at withRetry (utils.js:10:1)\n  at process (data.js:5:1)');
    expect(bug1).not.toBe(bug2);
  });
});
