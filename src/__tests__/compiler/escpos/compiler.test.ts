// src/__tests__/compiler/escpos/compiler.test.ts
import { compileDocument } from '../../../compiler/escpos/compiler';
import {
  text,
  qr,
  feed,
  cut,
  line,
  raw,
  columns,
} from '../../../document/nodes';
import { CMD, ESC, GS } from '../../../compiler/escpos/commands';

describe('ESCPOSCompiler', () => {
  it('compiles an empty document to init bytes only', () => {
    const bytes = compileDocument([], { paperWidthMm: 58 });
    expect(bytes.slice(0, 2)).toEqual([...CMD.INIT]);
  });

  it('compiles a text node', () => {
    const bytes = compileDocument([text('Hello')], { paperWidthMm: 58 });
    expect(bytes).toContain(0x48); // 'H'
    expect(bytes).toContain(0x0a); // LF at end
  });

  it('compiles bold text', () => {
    const bytes = compileDocument([text('Bold', { bold: true })], {
      paperWidthMm: 58,
    });
    // Should contain BOLD_ON before text, BOLD_OFF after
    const boldOnIdx = findSubarray(bytes, CMD.BOLD_ON);
    const boldOffIdx = findSubarray(bytes, CMD.BOLD_OFF);
    expect(boldOnIdx).toBeGreaterThanOrEqual(0);
    expect(boldOffIdx).toBeGreaterThan(boldOnIdx);
  });

  it('compiles centered text', () => {
    const bytes = compileDocument([text('Center', { align: 'center' })], {
      paperWidthMm: 58,
    });
    const alignIdx = findSubarray(bytes, CMD.ALIGN_CENTER);
    expect(alignIdx).toBeGreaterThanOrEqual(0);
  });

  it('compiles QR code', () => {
    const bytes = compileDocument([qr('https://test.com', { size: 5 })], {
      paperWidthMm: 58,
    });
    // QR model select: GS ( k 04 00 31 41 32 00
    const qrIdx = findSubarray(bytes, [GS, 0x28, 0x6b]);
    expect(qrIdx).toBeGreaterThanOrEqual(0);
  });

  it('compiles feed node', () => {
    const bytes = compileDocument([feed(3)], { paperWidthMm: 58 });
    const feedIdx = findSubarray(bytes, [ESC, 0x64, 0x03]);
    expect(feedIdx).toBeGreaterThanOrEqual(0);
  });

  it('compiles cut node', () => {
    const bytes = compileDocument([cut()], { paperWidthMm: 58 });
    const cutIdx = findSubarray(bytes, CMD.CUT_FULL);
    expect(cutIdx).toBeGreaterThanOrEqual(0);
  });

  it('compiles partial cut', () => {
    const bytes = compileDocument([cut({ partial: true })], {
      paperWidthMm: 58,
    });
    const cutIdx = findSubarray(bytes, CMD.CUT_PARTIAL);
    expect(cutIdx).toBeGreaterThanOrEqual(0);
  });

  it('compiles raw bytes passthrough', () => {
    const bytes = compileDocument([raw([0xaa, 0xbb])], { paperWidthMm: 58 });
    const idx = findSubarray(bytes, [0xaa, 0xbb]);
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it('compiles line separator', () => {
    const bytes = compileDocument([line()], { paperWidthMm: 58 });
    // Default separator is 32 '-' chars for 58mm
    const dashBytes = Array.from(new TextEncoder().encode('-'.repeat(32)));
    const idx = findSubarray(bytes, dashBytes);
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it('compiles columns node', () => {
    const bytes = compileDocument(
      [
        columns([
          { content: 'Item', width: 0.7 },
          { content: '$5', width: 0.3, align: 'right' },
        ]),
      ],
      { paperWidthMm: 58 }
    );
    // Should contain 'Item' and '$5'
    expect(bytes).toContain(0x49); // 'I'
    expect(bytes).toContain(0x24); // '$'
  });

  it('resets formatting after styled text', () => {
    const bytes = compileDocument(
      [text('Bold', { bold: true }), text('Normal')],
      { paperWidthMm: 58 }
    );
    // BOLD_OFF should appear between the two texts
    const boldOffIdx = findSubarray(bytes, CMD.BOLD_OFF);
    expect(boldOffIdx).toBeGreaterThanOrEqual(0);
  });

  it('uses 48 chars per line for 80mm paper', () => {
    const bytes = compileDocument([line()], { paperWidthMm: 80 });
    const dashBytes = Array.from(new TextEncoder().encode('-'.repeat(48)));
    const idx = findSubarray(bytes, dashBytes);
    expect(idx).toBeGreaterThanOrEqual(0);
  });
});

// Helper: find subarray in array
function findSubarray(haystack: number[], needle: readonly number[]): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
