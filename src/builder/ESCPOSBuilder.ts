// src/builder/ESCPOSBuilder.ts
import { CMD, LF, feedLines, qrCmd, setCharSize, selectCodePage } from '../compiler/escpos/commands';
import { resolveCodePage } from '../compiler/escpos/encoding';
import type { CodePage } from '../types';

const QR_ERROR_MAP: Record<string, number> = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 };

export class ESCPOSBuilder {
  private _bytes: number[] = [];

  init(): this {
    this._bytes.push(...CMD.INIT);
    return this;
  }

  text(content: string): this {
    this._bytes.push(...Array.from(new TextEncoder().encode(content)), LF);
    return this;
  }

  align(alignment: 'left' | 'center' | 'right'): this {
    if (alignment === 'center') this._bytes.push(...CMD.ALIGN_CENTER);
    else if (alignment === 'right') this._bytes.push(...CMD.ALIGN_RIGHT);
    else this._bytes.push(...CMD.ALIGN_LEFT);
    return this;
  }

  bold(on: boolean): this {
    this._bytes.push(...(on ? CMD.BOLD_ON : CMD.BOLD_OFF));
    return this;
  }

  underline(on: boolean): this {
    this._bytes.push(...(on ? CMD.UNDERLINE_1 : CMD.UNDERLINE_OFF));
    return this;
  }

  doubleStrike(on: boolean): this {
    this._bytes.push(...(on ? CMD.DOUBLE_STRIKE_ON : CMD.DOUBLE_STRIKE_OFF));
    return this;
  }

  reverse(on: boolean): this {
    this._bytes.push(...(on ? CMD.REVERSE_ON : CMD.REVERSE_OFF));
    return this;
  }

  font(f: 'A' | 'B'): this {
    this._bytes.push(...(f === 'B' ? CMD.FONT_B : CMD.FONT_A));
    return this;
  }

  size(n: number): this {
    this._bytes.push(...setCharSize(n, n));
    return this;
  }

  widthHeight(w: number, h: number): this {
    this._bytes.push(...setCharSize(w, h));
    return this;
  }

  codePage(page: CodePage): this {
    const id = typeof page === 'number' ? page : resolveCodePage(page);
    if (id !== undefined) this._bytes.push(...selectCodePage(id));
    return this;
  }

  feed(lines: number): this {
    this._bytes.push(...feedLines(lines));
    return this;
  }

  qr(data: string, options?: { size?: number; errorLevel?: 'L' | 'M' | 'Q' | 'H' }): this {
    const size = options?.size ?? 5;
    const errLevel = QR_ERROR_MAP[options?.errorLevel ?? 'M'] ?? QR_ERROR_MAP['M']!;
    this._bytes.push(...qrCmd(data, size, errLevel), LF);
    return this;
  }

  cut(partial?: boolean): this {
    this._bytes.push(...(partial ? CMD.CUT_PARTIAL : CMD.CUT_FULL));
    return this;
  }

  cashDrawer(): this {
    this._bytes.push(...CMD.CASH_DRAWER);
    return this;
  }

  rawBytes(data: number[]): this {
    this._bytes.push(...data);
    return this;
  }

  bytes(): number[] {
    return [...this._bytes];
  }
}
