// src/__tests__/builder/ESCPOSBuilder.test.ts
import { ESCPOSBuilder } from '../../builder/ESCPOSBuilder';
import { CMD, ESC, GS } from '../../compiler/escpos/commands';

describe('ESCPOSBuilder', () => {
  it('init returns ESC @', () => {
    const bytes = new ESCPOSBuilder().init().bytes();
    expect(bytes.slice(0, 2)).toEqual([...CMD.INIT]);
  });

  it('chains multiple commands', () => {
    const bytes = new ESCPOSBuilder()
      .init()
      .bold(true)
      .text('Hello')
      .bold(false)
      .bytes();
    expect(bytes.length).toBeGreaterThan(10);
  });

  it('align sets alignment', () => {
    const bytes = new ESCPOSBuilder().align('center').bytes();
    expect(findSubarray(bytes, CMD.ALIGN_CENTER)).toBeGreaterThanOrEqual(0);
  });

  it('size sets character size', () => {
    const bytes = new ESCPOSBuilder().size(2).bytes();
    // GS ! with width=1, height=1 (0-indexed) = 0x11
    expect(findSubarray(bytes, [GS, 0x21, 0x11])).toBeGreaterThanOrEqual(0);
  });

  it('qr generates QR commands', () => {
    const bytes = new ESCPOSBuilder().qr('test', { size: 4 }).bytes();
    expect(findSubarray(bytes, [GS, 0x28, 0x6B])).toBeGreaterThanOrEqual(0);
  });

  it('cut generates cut command', () => {
    const bytes = new ESCPOSBuilder().cut().bytes();
    expect(findSubarray(bytes, CMD.CUT_FULL)).toBeGreaterThanOrEqual(0);
  });

  it('feed generates feed command', () => {
    const bytes = new ESCPOSBuilder().feed(3).bytes();
    expect(findSubarray(bytes, [ESC, 0x64, 0x03])).toBeGreaterThanOrEqual(0);
  });

  it('cashDrawer generates kick command', () => {
    const bytes = new ESCPOSBuilder().cashDrawer().bytes();
    expect(findSubarray(bytes, [...CMD.CASH_DRAWER])).toBeGreaterThanOrEqual(0);
  });

  it('underline toggles underline', () => {
    const bytes = new ESCPOSBuilder().underline(true).text('U').underline(false).bytes();
    expect(findSubarray(bytes, CMD.UNDERLINE_1)).toBeGreaterThanOrEqual(0);
    expect(findSubarray(bytes, CMD.UNDERLINE_OFF)).toBeGreaterThanOrEqual(0);
  });

  it('font switches between A and B', () => {
    const bytes = new ESCPOSBuilder().font('B').text('Small').font('A').bytes();
    expect(findSubarray(bytes, CMD.FONT_B)).toBeGreaterThanOrEqual(0);
    expect(findSubarray(bytes, CMD.FONT_A)).toBeGreaterThanOrEqual(0);
  });

  it('reverse toggles reverse video', () => {
    const bytes = new ESCPOSBuilder().reverse(true).text('R').reverse(false).bytes();
    expect(findSubarray(bytes, CMD.REVERSE_ON)).toBeGreaterThanOrEqual(0);
    expect(findSubarray(bytes, CMD.REVERSE_OFF)).toBeGreaterThanOrEqual(0);
  });

  it('codePage sets code page', () => {
    const bytes = new ESCPOSBuilder().codePage('cp860').bytes();
    expect(findSubarray(bytes, [ESC, 0x74, 0x03])).toBeGreaterThanOrEqual(0); // cp860 = 3
  });

  it('bytes returns a copy', () => {
    const builder = new ESCPOSBuilder().init();
    const a = builder.bytes();
    const b = builder.bytes();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

function findSubarray(haystack: number[], needle: readonly number[]): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
