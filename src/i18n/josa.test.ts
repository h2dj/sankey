import { describe, expect, it } from 'vitest';
import { josa, quoted } from './josa';

describe('josa', () => {
  it.each([
    ['출발 노드', '을/를', '출발 노드를'],
    ['값', '을/를', '값을'],
    ['교육', '은/는', '교육은'],
    ['홍보', '이/가', '홍보가'],
    ['예산', '이/가', '예산이'],
    ['교육', '으로/로', '교육으로'],
    ['홍보', '으로/로', '홍보로'],
    ['발전', '으로/로', '발전으로'],
    ['서울', '으로/로', '서울로'], // ㄹ 받침은 '로'
    ['40', '은/는', '40은'],
    ['12', '은/는', '12는'],
    ['7', '으로/로', '7로'],
    ['Power', '으로/로', 'Power로'],
    ['Gas', '은/는', 'Gas는'],
    ['Coal', '으로/로', 'Coal로'],
    ['Home', '이/가', 'Home가'],
    ['"스물"', '은/는', '"스물"은(는)'],
  ] as const)('%s + %s → %s', (word, pair, expected) => {
    expect(josa(word, pair)).toBe(expected);
  });
});

describe('quoted', () => {
  it('따옴표 안 글자로 조사를 고른다', () => {
    expect(quoted('스물', '은/는')).toBe('"스물"은');
    expect(quoted('홍보', '으로/로')).toBe('"홍보"로');
    expect(quoted('1.234,5', '은/는')).toBe('"1.234,5"는');
    expect(quoted('A&B!', '이/가')).toBe('"A&B!"이(가)');
  });
});
