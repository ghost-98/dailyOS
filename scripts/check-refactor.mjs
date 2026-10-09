import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const loadedModule = { exports: {} };
  cache.set(absolute, loadedModule);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const run = vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename: absolute });
  run(specifier => specifier.startsWith('@/') ? load('src/' + specifier.slice(2) + '.ts') : require(specifier), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { buildRecordSearchItems } = load('src/features/records/search/recordSearchItems.ts');
const { buildRecordPeopleSummaries, parseCompanions } = load('src/features/records/people/recordPeople.ts');
assert.deepEqual(parseCompanions('민수, 지수 · 은영'), ['민수', '지수', '은영']);
const activity = {
  id: 'activity-1', date: '2026-10-08', title: '저녁 식사', category: '식사', isAllDay: false,
  startTime: '18:30', companions: '민수, 지수', food: '파에야', placeName: '까사델스페인',
  placeAddress: '광주 양림동', memo: '친구들과 식사', expenseAmount: 32000,
};
const log = { id: 'log-1', date: activity.date, content: '맛있었다', linkedTargetType: 'activity', linkedTargetId: activity.id };
const expense = { id: 'expense-1', date: activity.date, title: activity.title, amount: 32000, category: 'food', targetType: 'activity', targetId: activity.id };
const records = buildRecordSearchItems([], [], [activity], [expense], [], [log], [], [], []);
assert.equal(records.length, 3);
const item = records.find(record => record.type === 'activity');
assert.equal(item.title, activity.title);
assert.ok(item.facts.some(fact => fact.kind === 'place' && fact.text.includes('양림동')));
assert.ok(item.facts.some(fact => fact.kind === 'food' && fact.text.includes('파에야')));
assert.ok(item.tags.includes('민수, 지수'));
assert.deepEqual(buildRecordSearchItems([], [], [], [], [], [], [], [], []), []);
const people = buildRecordPeopleSummaries([], [], [activity], [expense], [log], []);
assert.equal(people.length, 2);
assert.equal(people[0].expenseTotal, 32000);
assert.equal(people[0].logs[0].id, log.id);
assert.equal(people[0].items[0].focusId, 'activity-activity-1');

const { RecordConversationPlaceholder } = load('src/features/screens/search/RecordConversationPlaceholder.tsx');
const { renderToStaticMarkup } = require('react-dom/server');
const html = renderToStaticMarkup(require('react').createElement(RecordConversationPlaceholder));
assert.match(html, /현재 사용할 수 없습니다/);
assert.match(html, /<textarea[^>]*disabled/);
assert.match(html, /<button[^>]*disabled/);
assert.doesNotMatch(html, /메모리 동기화|이어 물어보기|답변 근거/);
console.log('PASS: keyword index, linked people records, empty data, inactive conversation UI');
