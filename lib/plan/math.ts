/** Plan math responsibilities; extracted without changing policy or behavior. */

export const round = (n: number, digits = 1) =>
  Math.round(n * 10 ** digits) / 10 ** digits;
