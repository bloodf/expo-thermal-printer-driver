// src/types.ts

export interface Device {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
  rssi?: number;
}

export interface ScanResult {
  paired: Device[];
  found: Device[];
}

export interface TestResult {
  success: boolean;
  deviceName?: string;
  error?: ErrorInfo;
}

export interface PrintResult {
  success: boolean;
  bytesWritten?: number;
  error?: ErrorInfo;
}

export interface ErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
  suggestion?: string;
}

export interface PrinterOptions {
  paperWidthMm?: 58 | 80;
  codePage?: CodePage;
  keepAlive?: boolean;
  timeout?: number;
  copies?: number;
  disableCutPaper?: boolean;
}

export type CodePage =
  | 'cp437'
  | 'cp850'
  | 'cp858'
  | 'cp860'
  | 'cp1252'
  | 'cp866'
  | 'iso8859_15'
  | number;

export interface TextStyle {
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean | 'single' | 'double';
  doubleStrike?: boolean;
  reverse?: boolean;
  size?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  widthScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  heightScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  font?: 'A' | 'B';
}

export type Subscription = { remove: () => void };
