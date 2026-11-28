import { describe, expect, it } from 'vitest';
import { odometerCells } from './odometer';

describe('odometerCells', () => {
  it('marks digits as rolling and everything else as fixed', () => {
    const cells = odometerCells('€ 1.234,56');
    expect(cells.map(c => c.digit)).toEqual([null, null, 1, null, 2, 3, 4, null, 5, 6]);
    expect(cells.map(c => c.char).join('')).toBe('€ 1.234,56');
  });

  it('keys cells from the right so columns keep their identity as the number grows', () => {
    const before = odometerCells('999');
    const after = odometerCells('1.000');
    const unitsBefore = before[before.length - 1];
    const unitsAfter = after[after.length - 1];
    expect(unitsAfter.key).toBe(unitsBefore.key);
    expect(new Set(after.map(c => c.key)).size).toBe(after.length);
  });

  it('handles a sign and an empty string', () => {
    expect(odometerCells('-5')[0]).toMatchObject({ char: '-', digit: null });
    expect(odometerCells('')).toEqual([]);
  });
});
