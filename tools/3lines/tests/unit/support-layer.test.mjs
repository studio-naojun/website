import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildSupportLayer } from '../../src/support.js';

const fixturePath = fileURLToPath(new URL('../fixtures/jun-legaltech-72-20260824.txt', import.meta.url));

test('support layer restores conditional supplements and a longer source-grounded summary', async () => {
  const text = await readFile(fixturePath, 'utf8');
  const items = [
    '法務省がAI法務支援サービスと弁護士法72条の線引きを整理した内容。',
    '紛争性のある法律案件へ踏み込まない設計と実際の使われ方が重要。',
    '通常業務ではAIを活用し、紛争案件では弁護士へ切り替える。',
  ];
  const support = buildSupportLayer(text, items);

  assert.ok(Array.isArray(support.notes));
  assert.ok(support.notes.length >= 1 && support.notes.length <= 3, `notes=${JSON.stringify(support.notes)}`);
  assert.ok(support.notes.join('').length <= 300);
  assert.ok(support.notes.every((note) => [...note].length >= 25 && [...note].length <= 100));
  assert.ok(support.notes.every((note) => /[。！？!?]$/u.test(note) && !note.includes('…')), `notes=${JSON.stringify(support.notes)}`);
  assert.ok(support.notes.every((note) => !/(?:前述|上記|下記|以下|(?:しかも|また|なお)\s*[0-9０-９]+(?:は|と|、|について))/u.test(note)), `notes=${JSON.stringify(support.notes)}`);
  assert.ok(typeof support.detail === 'string' && support.detail.length >= 180, `detail=${support.detail}`);
  assert.match(support.detail, /弁護士|AI|法律/u);
});

test('support notes are optional when the source has no material qualifier', () => {
  const text = '青葉市は新しい図書館を開館した。閲覧席は120席ある。開館時間は午前9時から午後8時までである。利用登録は窓口で行う。';
  const items = ['青葉市が新しい図書館を開館した。', '閲覧席は120席ある。', '午前9時から午後8時まで利用できる。'];
  const support = buildSupportLayer(text, items);

  assert.deepEqual(support.notes, []);
  assert.ok(support.detail.length > 0);
});
