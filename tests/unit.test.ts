import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, solve } from '../scripts/arithmetic.ts';
import { normalize, project } from '../scripts/schema.ts';
const sheet = (task: string, items: unknown[], more = {}) => ({ version: 1, title: '测试练习', sections: [{ task, items, ...more }] });
test('exact arithmetic handles decimals, fractions, parentheses and precedence', () => {
  const cases = [['0.1 + 0.2', '0.3'], ['1/3 + 1/6', '0.5'], ['1/3', '1/3'], ['248 × 36', '8928'], ['936 ÷ 24', '39'], ['（125+75）×8-360', '1240'], ['-2^2', '-4'], ['(-2)^2', '4'], ['2^-3', '0.125'], ['1÷(-3)', '-1/3']];
  for (const [expression, expected] of cases) assert.equal(solve(expression), expected);
});
test('arithmetic rejects unsafe or malformed input', () => {
  for (const s of ['process.exit()', '1/0', '2(3)', '3 +', '(2+3', '2^100', '1e3', '']) assert.throws(() => calculate(s));
});
test('student projection removes private answers and source text', () => {
  const normalized = normalize(sheet('zh-en', [{ id: 'e1', english: 'SECRET_ANSWER', chinese: '苹果', source: 'PRIVATE_SOURCE', answer: 'PRIVATE' }]));
  const student = JSON.stringify(project(normalized, 'student'));
  assert.ok(!student.includes('SECRET_ANSWER')); assert.ok(!student.includes('PRIVATE'));
  assert.ok(JSON.stringify(project(normalized, 'answers')).includes('SECRET_ANSWER'));
});
test('pinyin student sheet has exact blank cell counts and no hidden word', () => {
  const normalized = normalize(sheet('pinyin', [{ word: '银行', pinyin: 'yín háng' }]));
  const pub = project(normalized, 'student'); assert.equal(pub.sections[0].items[0].cells, 2);
  assert.ok(!JSON.stringify(pub).includes('银行')); assert.ok(JSON.stringify(project(normalized, 'answers')).includes('银行'));
});
test('math calculates and independently checks supplied answers', () => {
  assert.throws(() => normalize(sheet('oral', [{ expression: '0.1+0.2', answer: '0.4' }])), /不一致/);
  const norm = normalize(sheet('oral', [{ expression: '1/2+1/4', answer: '3/4' }]));
  assert.equal(norm.sections[0].items[0].answer, '0.75');
});
test('unverified word problem answer is not silently published', () => {
  const norm = normalize(sheet('word-problem', [{ prompt: '买了多少？', answer: '3' }]));
  assert.doesNotThrow(() => project(norm, 'student')); assert.throws(() => project(norm, 'answers'), /已核对/);
});
test('input validation rejects ambiguous source, bad pinyin, mismatched subject and tiny font', () => {
  assert.throws(() => normalize(sheet('oral', [{ expression: '1+2', review: 'pending' }])), /待确认/);
  assert.throws(() => normalize(sheet('pinyin', [{ word: '春天', pinyin: 'chūn' }])), /音节/);
  assert.throws(() => normalize(sheet('copy', [{ word: '春天' }], { subject: 'math' })), /不一致/);
  assert.throws(() => normalize({ ...sheet('oral', [{ expression: '1+2' }]), layout: { fontPt: 6 } }), /12/);
  assert.throws(() => normalize(sheet('oral', [{ id: 'same', expression: '1+2' }, { id: 'same', expression: '3+4' }])), /重复/);
});
