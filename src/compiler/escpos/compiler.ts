// src/compiler/escpos/compiler.ts
import type { Node } from '../../document/types';
import type { PrinterOptions } from '../../types';
import { CMD, LF, feedLines, qrCmd, barcodeCmd, setCharSize, selectCodePage } from './commands';
import { resolveCodePage } from './encoding';
import { createContext } from '../types';

const QR_ERROR_MAP: Record<string, number> = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 };
const BARCODE_FORMAT_MAP: Record<string, number> = {
  UPC_A: 65, UPC_E: 66, EAN13: 67, EAN8: 68,
  CODE39: 69, ITF: 70, CODABAR: 71, CODE93: 72, CODE128: 73,
};
const HRI_MAP: Record<string, number> = { none: 0, above: 1, below: 2, both: 3 };

export function compileDocument(nodes: Node[], options: Partial<PrinterOptions> = {}): number[] {
  const ctx = createContext(options.paperWidthMm ?? 58);
  const bytes: number[] = [];

  // Initialize printer
  bytes.push(...CMD.INIT);
  bytes.push(...CMD.FONT_A);

  // Set code page if specified
  const codePageId = resolveCodePage(options.codePage);
  if (codePageId !== undefined) {
    bytes.push(...selectCodePage(codePageId));
  }

  for (const node of nodes) {
    compileNode(node, bytes, ctx);
  }

  return bytes;
}

function compileNode(node: Node, bytes: number[], ctx: ReturnType<typeof createContext>): void {
  switch (node.type) {
    case 'text': return compileText(node, bytes, ctx);
    case 'line': return compileLine(node, bytes, ctx);
    case 'qr': return compileQR(node, bytes);
    case 'barcode': return compileBarcode(node, bytes);
    case 'feed': return compileFeed(node, bytes);
    case 'cut': return compileCut(node, bytes);
    case 'raw': return compileRaw(node, bytes);
    case 'columns': return compileColumns(node, bytes, ctx);
    case 'table': return compileTable(node, bytes, ctx);
    case 'spacer': return compileSpacer(node, bytes);
    case 'image': return; // Images are handled natively, not compiled in JS
  }
}

function compileText(
  node: Extract<Node, { type: 'text' }>,
  bytes: number[],
  ctx: ReturnType<typeof createContext>
): void {
  const style = node.style;

  // Apply style
  if (style?.align === 'center') bytes.push(...CMD.ALIGN_CENTER);
  else if (style?.align === 'right') bytes.push(...CMD.ALIGN_RIGHT);

  if (style?.bold) bytes.push(...CMD.BOLD_ON);
  if (style?.underline === true || style?.underline === 'single') bytes.push(...CMD.UNDERLINE_1);
  else if (style?.underline === 'double') bytes.push(...CMD.UNDERLINE_2);
  if (style?.doubleStrike) bytes.push(...CMD.DOUBLE_STRIKE_ON);
  if (style?.reverse) bytes.push(...CMD.REVERSE_ON);

  if (style?.font === 'B') bytes.push(...CMD.FONT_B);

  const w = style?.widthScale ?? style?.size ?? 1;
  const h = style?.heightScale ?? style?.size ?? 1;
  if (w > 1 || h > 1) bytes.push(...setCharSize(w, h));

  // Text content
  const textBytes = Array.from(new TextEncoder().encode(node.content));
  bytes.push(...textBytes, LF);

  // Reset style
  if (w > 1 || h > 1) bytes.push(...setCharSize(1, 1));
  if (style?.font === 'B') bytes.push(...CMD.FONT_A);
  if (style?.reverse) bytes.push(...CMD.REVERSE_OFF);
  if (style?.doubleStrike) bytes.push(...CMD.DOUBLE_STRIKE_OFF);
  if (style?.underline) bytes.push(...CMD.UNDERLINE_OFF);
  if (style?.bold) bytes.push(...CMD.BOLD_OFF);
  if (style?.align) bytes.push(...CMD.ALIGN_LEFT);
}

function compileLine(
  node: Extract<Node, { type: 'line' }>,
  bytes: number[],
  ctx: ReturnType<typeof createContext>
): void {
  const char = node.character ?? (node.style === 'dashed' ? '- ' : '-');
  const repeated = char.repeat(Math.ceil(ctx.charsPerLine / char.length)).slice(0, ctx.charsPerLine);
  bytes.push(...Array.from(new TextEncoder().encode(repeated)), LF);
}

function compileQR(node: Extract<Node, { type: 'qr' }>, bytes: number[]): void {
  const size = node.size ?? 5;
  const errLevel = QR_ERROR_MAP[node.errorLevel ?? 'M'] ?? QR_ERROR_MAP['M'];
  bytes.push(...qrCmd(node.content, size, errLevel));
  bytes.push(LF);
}

function compileBarcode(node: Extract<Node, { type: 'barcode' }>, bytes: number[]): void {
  const format = BARCODE_FORMAT_MAP[node.format] ?? BARCODE_FORMAT_MAP['CODE128']!;
  const height = node.height ?? 80;
  const width = node.width ?? 2;
  const hri = HRI_MAP[node.hri ?? 'below'] ?? HRI_MAP['below']!;

  bytes.push(...barcodeCmd(node.content, format, height, width, hri));
  bytes.push(LF);
}

function compileFeed(node: Extract<Node, { type: 'feed' }>, bytes: number[]): void {
  bytes.push(...feedLines(node.lines));
}

function compileCut(node: Extract<Node, { type: 'cut' }>, bytes: number[]): void {
  bytes.push(...(node.partial ? CMD.CUT_PARTIAL : CMD.CUT_FULL));
}

function compileRaw(node: Extract<Node, { type: 'raw' }>, bytes: number[]): void {
  bytes.push(...node.data);
}

function compileSpacer(node: Extract<Node, { type: 'spacer' }>, bytes: number[]): void {
  const lines = node.lines ?? 1;
  for (let i = 0; i < lines; i++) bytes.push(LF);
}

function compileColumns(
  node: Extract<Node, { type: 'columns' }>,
  bytes: number[],
  ctx: ReturnType<typeof createContext>
): void {
  const totalChars = ctx.charsPerLine;
  const cols = node.columns;

  let row = '';
  for (const col of cols) {
    const colWidth = Math.floor(col.width * totalChars);
    const content = col.content.slice(0, colWidth);
    const padding = colWidth - content.length;

    if (col.align === 'right') {
      row += ' '.repeat(padding) + content;
    } else if (col.align === 'center') {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      row += ' '.repeat(left) + content + ' '.repeat(right);
    } else {
      row += content + ' '.repeat(padding);
    }
  }

  bytes.push(...Array.from(new TextEncoder().encode(row)), LF);
}

function compileTable(
  node: Extract<Node, { type: 'table' }>,
  bytes: number[],
  ctx: ReturnType<typeof createContext>
): void {
  const { table: def } = node;
  const numCols = def.headers?.length ?? def.rows[0]?.length ?? 0;
  if (numCols === 0) return;

  const colWidths = def.columnWidths ?? Array(numCols).fill(1 / numCols);
  const charWidths = colWidths.map((w: number) => Math.floor(w * ctx.charsPerLine));

  const formatRow = (cells: string[]): string => {
    return cells.map((cell, i) => {
      const w = charWidths[i] ?? 10;
      return cell.slice(0, w).padEnd(w);
    }).join('');
  };

  // Headers
  if (def.headers) {
    if (def.headerStyle?.bold) bytes.push(...CMD.BOLD_ON);
    bytes.push(...Array.from(new TextEncoder().encode(formatRow(def.headers))), LF);
    if (def.headerStyle?.bold) bytes.push(...CMD.BOLD_OFF);

    // Separator
    if (def.border === 'single') {
      bytes.push(...Array.from(new TextEncoder().encode('-'.repeat(ctx.charsPerLine))), LF);
    } else if (def.border === 'double') {
      bytes.push(...Array.from(new TextEncoder().encode('='.repeat(ctx.charsPerLine))), LF);
    }
  }

  // Rows
  for (const row of def.rows) {
    bytes.push(...Array.from(new TextEncoder().encode(formatRow(row))), LF);
  }
}
