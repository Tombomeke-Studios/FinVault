// Odometer cells for a rolling number (#127).
//
// A formatted amount ("€ 1.234,56") is split into cells: digits roll, every
// other character (currency sign, separators, spaces, minus) stays put. Cells
// are keyed from the RIGHT, so when the number grows ("999" → "1.000") the
// units stay the units and only new columns appear on the left. That keeps
// each digit column rolling smoothly instead of jumping to a new position.

export interface OdometerCell {
  key: string;
  char: string;
  /** 0–9 for a digit, null for a fixed character. */
  digit: number | null;
}

export function odometerCells(text: string): OdometerCell[] {
  const chars = Array.from(text);
  return chars.map((char, i) => {
    const fromRight = chars.length - 1 - i;
    const isDigit = char >= '0' && char <= '9';
    return {
      key: `${isDigit ? 'd' : 'c'}${fromRight}`,
      char,
      digit: isDigit ? char.charCodeAt(0) - 48 : null,
    };
  });
}
