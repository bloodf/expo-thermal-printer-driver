// src/compiler/escpos/commands.ts
/* eslint-disable no-bitwise -- ESC/POS command composition requires bitwise byte packing. */

// Constants
export const DOTS_PER_MM = 8; // 203 DPI standard
export const FONT_A_WIDTH = 12; // dots per char
export const FONT_B_WIDTH = 9;
export const FONT_A_CHARS_58MM = 32;
export const FONT_A_CHARS_80MM = 48;
export const FONT_B_CHARS_58MM = 42;
export const FONT_B_CHARS_80MM = 64;

// Byte commands
export const LF = 0x0a;
export const ESC = 0x1b;
export const GS = 0x1d;

export const CMD = {
  INIT: [ESC, 0x40], // ESC @ — reset
  ALIGN_LEFT: [ESC, 0x61, 0x00], // ESC a 0
  ALIGN_CENTER: [ESC, 0x61, 0x01], // ESC a 1
  ALIGN_RIGHT: [ESC, 0x61, 0x02], // ESC a 2
  BOLD_ON: [ESC, 0x45, 0x01], // ESC E 1
  BOLD_OFF: [ESC, 0x45, 0x00], // ESC E 0
  UNDERLINE_OFF: [ESC, 0x2d, 0x00], // ESC - 0
  UNDERLINE_1: [ESC, 0x2d, 0x01], // ESC - 1
  UNDERLINE_2: [ESC, 0x2d, 0x02], // ESC - 2
  DOUBLE_STRIKE_ON: [ESC, 0x47, 0x01], // ESC G 1
  DOUBLE_STRIKE_OFF: [ESC, 0x47, 0x00], // ESC G 0
  REVERSE_ON: [GS, 0x42, 0x01], // GS B 1
  REVERSE_OFF: [GS, 0x42, 0x00], // GS B 0
  FONT_A: [ESC, 0x4d, 0x00], // ESC M 0
  FONT_B: [ESC, 0x4d, 0x01], // ESC M 1
  CUT_FULL: [GS, 0x56, 0x00], // GS V 0
  CUT_PARTIAL: [GS, 0x56, 0x01], // GS V 1
  FEED_CUT: [GS, 0x56, 0x42, 0x00], // GS V B 0
  CASH_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xfa], // ESC p 0 25 250
} as const;

/** ESC t n — select code page */
export function selectCodePage(page: number): number[] {
  return [ESC, 0x74, page & 0xff];
}

/** GS ! n — set character size (width 1-8, height 1-8) */
export function setCharSize(width: number, height: number): number[] {
  const w = (Math.min(Math.max(width, 1), 8) - 1) & 0x07;
  const h = (Math.min(Math.max(height, 1), 8) - 1) & 0x07;
  return [GS, 0x21, (w << 4) | h];
}

/** ESC 3 n — set line spacing (n/180 inch) */
export function setLineSpacing(n: number): number[] {
  return [ESC, 0x33, n & 0xff];
}

/** GS W nL nH — set print area width in dots */
export function setPrintAreaWidth(dots: number): number[] {
  return [GS, 0x57, dots & 0xff, (dots >> 8) & 0xff];
}

/** GS L nL nH — set left margin in dots */
export function setLeftMargin(dots: number): number[] {
  return [GS, 0x4c, dots & 0xff, (dots >> 8) & 0xff];
}

/** ESC d n — feed n lines */
export function feedLines(n: number): number[] {
  return [ESC, 0x64, n & 0xff];
}

/** GS k — barcode (CODE128 etc.) */
export function barcodeCmd(
  data: string,
  format: number,
  height: number,
  width: number,
  hriPosition: number
): number[] {
  const dataBytes = Array.from(new TextEncoder().encode(data));
  return [
    GS,
    0x68,
    height & 0xff, // Set barcode height
    GS,
    0x77,
    width & 0xff, // Set barcode width
    GS,
    0x48,
    hriPosition & 0xff, // Set HRI position
    GS,
    0x6b,
    format,
    dataBytes.length,
    ...dataBytes, // Print barcode
  ];
}

/** GS ( k — QR code (model 2) */
export function qrCmd(
  data: string,
  size: number,
  errorLevel: number
): number[] {
  const dataBytes = Array.from(new TextEncoder().encode(data));
  const storeLen = dataBytes.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;

  return [
    // Select model 2
    GS,
    0x28,
    0x6b,
    0x04,
    0x00,
    0x31,
    0x41,
    0x32,
    0x00,
    // Set size
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x43,
    size & 0xff,
    // Set error correction
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x45,
    errorLevel & 0xff,
    // Store data
    GS,
    0x28,
    0x6b,
    pL,
    pH,
    0x31,
    0x50,
    0x30,
    ...dataBytes,
    // Print
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x51,
    0x30,
  ];
}

/** GS v 0 — raster image header */
export function rasterImageHeader(
  widthBytes: number,
  heightLines: number
): number[] {
  return [
    GS,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    heightLines & 0xff,
    (heightLines >> 8) & 0xff,
  ];
}
