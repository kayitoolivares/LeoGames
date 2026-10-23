// Súper Bolitas: cada nivel se puede pasar saltando y no hay bloques encima de hoyos (ver tools/plat-check.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('súper bolitas: los niveles se pueden pasar y no hay bloques sobre hoyos', () => {
  const tool = fileURLToPath(new URL('../../tools/plat-check.mjs', import.meta.url));
  let output = '';
  try {
    output = execFileSync(process.execPath, [tool], { encoding: 'utf8' });
  } catch (error) {
    assert.fail(error.stdout || error.message);
  }
  assert.match(output, /Todo bien/);
});
