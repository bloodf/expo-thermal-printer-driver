// src/compiler/types.ts

export interface CompileContext {
  paperWidthMm: number;
  charsPerLine: number;
  currentFont: 'A' | 'B';
  codePageId?: number;
}

export function createContext(
  paperWidthMm: number = 58,
  font: 'A' | 'B' = 'A'
): CompileContext {
  const charsPerLine =
    paperWidthMm >= 80 ? (font === 'A' ? 48 : 64) : font === 'A' ? 32 : 42;

  return { paperWidthMm, charsPerLine, currentFont: font };
}
