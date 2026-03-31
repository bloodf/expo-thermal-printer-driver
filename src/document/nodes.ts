// src/document/nodes.ts
import type { TextStyle } from '../types';
import type {
  Node,
  ImageSource,
  BarcodeFormat,
  ColumnDef,
  TableDef,
} from './types';

export function text(content: string, style?: TextStyle): Node {
  return { type: 'text', content, style };
}

export function line(options?: {
  style?: 'solid' | 'dashed';
  character?: string;
}): Node {
  return { type: 'line', ...options };
}

export function qr(
  content: string,
  options?: { size?: number; errorLevel?: 'L' | 'M' | 'Q' | 'H' }
): Node {
  return { type: 'qr', content, ...options };
}

export function barcode(
  content: string,
  options: {
    format: BarcodeFormat;
    height?: number;
    width?: number;
    hri?: 'none' | 'above' | 'below' | 'both';
  }
): Node {
  return { type: 'barcode', content, ...options };
}

export function image(source: ImageSource): Node {
  return { type: 'image', source };
}

export function columns(defs: ColumnDef[]): Node {
  return { type: 'columns', columns: defs };
}

export function table(def: TableDef): Node {
  return { type: 'table', table: def };
}

export function feed(lines: number): Node {
  return { type: 'feed', lines };
}

export function cut(options?: { partial?: boolean }): Node {
  return { type: 'cut', partial: options?.partial };
}

export function raw(data: number[]): Node {
  return { type: 'raw', data };
}

export function spacer(lines?: number): Node {
  return { type: 'spacer', lines };
}
