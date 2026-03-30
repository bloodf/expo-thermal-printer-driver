// src/document/types.ts
import type { TextStyle } from '../types';

export type ImageSource =
  | { uri: string; width?: number }
  | { base64: string; width?: number }
  | { url: string; width?: number };

export type BarcodeFormat =
  | 'UPC_A' | 'UPC_E' | 'EAN13' | 'EAN8'
  | 'CODE39' | 'ITF' | 'CODABAR' | 'CODE93' | 'CODE128';

export interface ColumnDef {
  content: string;
  width: number; // fraction 0-1
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
}

export interface TableDef {
  headers?: string[];
  rows: string[][];
  columnWidths?: number[]; // fractions
  border?: 'none' | 'single' | 'double';
  headerStyle?: TextStyle;
}

export type Node =
  | { type: 'text'; content: string; style?: TextStyle }
  | { type: 'line'; style?: 'solid' | 'dashed'; character?: string }
  | { type: 'qr'; content: string; size?: number; errorLevel?: 'L' | 'M' | 'Q' | 'H' }
  | { type: 'barcode'; content: string; format: BarcodeFormat; height?: number; width?: number; hri?: 'none' | 'above' | 'below' | 'both' }
  | { type: 'image'; source: ImageSource }
  | { type: 'columns'; columns: ColumnDef[] }
  | { type: 'table'; table: TableDef }
  | { type: 'feed'; lines: number }
  | { type: 'cut'; partial?: boolean }
  | { type: 'raw'; data: number[] }
  | { type: 'spacer'; lines?: number };
