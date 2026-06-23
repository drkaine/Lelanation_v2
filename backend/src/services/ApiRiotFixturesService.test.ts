import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameVersionMatchesPatch } from './ApiRiotFixturesService.js';

test('gameVersionMatchesPatch accepts exact and dotted versions', () => {
  assert.equal(gameVersionMatchesPatch('16.4.744.1234', '16.4'), true);
  assert.equal(gameVersionMatchesPatch('16.4', '16.4'), true);
  assert.equal(gameVersionMatchesPatch('16.3.744.1234', '16.4'), false);
  assert.equal(gameVersionMatchesPatch('', '16.4'), false);
});
