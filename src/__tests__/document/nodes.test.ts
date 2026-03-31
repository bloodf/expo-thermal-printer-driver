// src/__tests__/document/nodes.test.ts
import {
  text,
  qr,
  barcode,
  image,
  columns,
  table,
  feed,
  cut,
  raw,
  line,
  spacer,
} from '../../document/nodes';

describe('Node factories', () => {
  it('text creates a text node with style', () => {
    const node = text('Hello', { bold: true, align: 'center' });
    expect(node).toEqual({
      type: 'text',
      content: 'Hello',
      style: { bold: true, align: 'center' },
    });
  });

  it('text creates a text node without style', () => {
    const node = text('Plain');
    expect(node).toEqual({ type: 'text', content: 'Plain', style: undefined });
  });

  it('qr creates a QR node with options', () => {
    const node = qr('https://example.com', { size: 6, errorLevel: 'H' });
    expect(node).toEqual({
      type: 'qr',
      content: 'https://example.com',
      size: 6,
      errorLevel: 'H',
    });
  });

  it('barcode creates a barcode node', () => {
    const node = barcode('12345', { format: 'CODE128', height: 80 });
    expect(node).toEqual({
      type: 'barcode',
      content: '12345',
      format: 'CODE128',
      height: 80,
    });
  });

  it('image creates an image node from uri', () => {
    const node = image({ uri: '/path/to/file.png', width: 384 });
    expect(node).toEqual({
      type: 'image',
      source: { uri: '/path/to/file.png', width: 384 },
    });
  });

  it('image creates an image node from base64', () => {
    const node = image({ base64: 'iVBOR...', width: 384 });
    expect(node).toEqual({
      type: 'image',
      source: { base64: 'iVBOR...', width: 384 },
    });
  });

  it('image creates an image node from url', () => {
    const node = image({ url: 'https://example.com/logo.png' });
    expect(node).toEqual({
      type: 'image',
      source: { url: 'https://example.com/logo.png' },
    });
  });

  it('columns creates a columns node', () => {
    const node = columns([
      { content: 'Item', width: 0.7 },
      { content: '$5', width: 0.3, align: 'right' },
    ]);
    expect(node.type).toBe('columns');
    expect((node as any).columns).toHaveLength(2);
  });

  it('table creates a table node', () => {
    const node = table({
      headers: ['A', 'B'],
      rows: [['1', '2']],
      border: 'single',
    });
    expect(node.type).toBe('table');
    expect((node as any).table.headers).toEqual(['A', 'B']);
  });

  it('feed creates a feed node', () => {
    expect(feed(3)).toEqual({ type: 'feed', lines: 3 });
  });

  it('cut creates a cut node', () => {
    expect(cut()).toEqual({ type: 'cut', partial: undefined });
    expect(cut({ partial: true })).toEqual({ type: 'cut', partial: true });
  });

  it('raw creates a raw node', () => {
    expect(raw([0x1b, 0x40])).toEqual({ type: 'raw', data: [0x1b, 0x40] });
  });

  it('line creates a line node', () => {
    expect(line()).toEqual({ type: 'line' });
    expect(line({ style: 'dashed' })).toEqual({
      type: 'line',
      style: 'dashed',
    });
  });

  it('spacer creates a spacer node', () => {
    expect(spacer(2)).toEqual({ type: 'spacer', lines: 2 });
  });
});
