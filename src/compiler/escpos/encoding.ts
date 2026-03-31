// src/compiler/escpos/encoding.ts

/** Map named code pages to ESC/POS code page IDs (ESC t n) */
export const CODE_PAGE_MAP: Record<string, number> = {
  cp437: 0,
  cp850: 2,
  cp858: 13,
  cp860: 3,
  cp1252: 16,
  cp866: 17,
  iso8859_15: 40,
};

export function resolveCodePage(
  codePage: string | number | undefined
): number | undefined {
  if (codePage === undefined) return undefined;
  if (typeof codePage === 'number') return codePage;
  return CODE_PAGE_MAP[codePage];
}
