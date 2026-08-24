import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../../src/summarizer.js';

const source = [
  '働き方を見直す案として、在宅勤務を増やす提案がある。',
  '通勤時間は減るが、連絡が増えて仕事が長引く場合もある。',
  '勤務時間を決め、連絡窓口を限定し、休憩を取る仕組みが必要だ。',
].join('');

test('repeated runs are deterministic and require no warm model state', async () => {
  const first = await summarize({ text: source, style: 'gist' });
  const second = await summarize({ text: source, style: 'gist' });
  assert.deepEqual(first.items, second.items);
  assert.equal(first.preparationState, 'not-required');
  assert.equal(second.preparationState, 'not-required');
});

test('concurrent style requests are independent and preserve the same source', async () => {
  const [gist, easy, faithful] = await Promise.all([
    summarize({ text: source, style: 'gist' }),
    summarize({ text: source, style: 'easy' }),
    summarize({ text: source, style: 'faithful' }),
  ]);
  for (const result of [gist, easy, faithful]) {
    assert.equal(result.items.length, 3);
    assert.equal(result.engine, 'deterministic-semantic-composer');
  }
});
