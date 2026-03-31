import { text, line, feed, cut, qr, barcode, raw } from '../index';

const listenerSpies: Array<{
  eventName: string;
  callback: (...args: unknown[]) => void;
}> = [];

const mockSubscription = { remove: jest.fn() };

jest.mock('../NativeThermalPrinterDriver', () => ({
  __esModule: true,
  default: {
    scanDevices: jest.fn(),
    stopScan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    testConnection: jest.fn(),
    printRaw: jest.fn(),
    printImage: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: (
      eventName: string,
      callback: (...args: unknown[]) => void
    ) => {
      listenerSpies.push({ eventName, callback });
      return mockSubscription;
    },
  })),
}));

let ThermalPrinter: typeof import('../index').default;
let ThermalPrinterModule: typeof import('../index');

beforeAll(() => {
  ThermalPrinterModule = require('../index');
  ThermalPrinter = ThermalPrinterModule.default;
});

beforeEach(() => {
  listenerSpies.length = 0;
  mockSubscription.remove.mockClear();
});

describe('ThermalPrinter event subscriptions', () => {
  it('onDeviceFound returns a Subscription with remove', () => {
    const sub = ThermalPrinter.onDeviceFound(jest.fn());
    expect(typeof sub.remove).toBe('function');
  });

  it('onDeviceFound registers listener with correct event name', () => {
    ThermalPrinter.onDeviceFound(jest.fn());
    expect(listenerSpies.some((s) => s.eventName === 'onDeviceFound')).toBe(
      true
    );
  });

  it('onScanCompleted returns a Subscription with remove', () => {
    const sub = ThermalPrinter.onScanCompleted(jest.fn());
    expect(typeof sub.remove).toBe('function');
  });

  it('onScanCompleted registers listener with correct event name', () => {
    ThermalPrinter.onScanCompleted(jest.fn());
    expect(listenerSpies.some((s) => s.eventName === 'onScanCompleted')).toBe(
      true
    );
  });

  it('onConnectionChanged returns a Subscription with remove', () => {
    const sub = ThermalPrinter.onConnectionChanged(jest.fn());
    expect(typeof sub.remove).toBe('function');
  });

  it('onConnectionChanged registers listener with correct event name', () => {
    ThermalPrinter.onConnectionChanged(jest.fn());
    expect(
      listenerSpies.some((s) => s.eventName === 'onConnectionChanged')
    ).toBe(true);
  });

  it('remove() calls the underlying subscription.remove()', () => {
    const sub = ThermalPrinter.onDeviceFound(jest.fn());
    sub.remove();
    expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
  });
});

describe('compileDocument integration via ThermalPrinter', () => {
  it('compiles a text node', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([text('Hello')], { paperWidthMm: 58 });
    expect(bytes).toContain(0x48);
    expect(bytes[bytes.length - 1]).toBe(0x0a);
  });

  it('compiles a qr node', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([qr('https://example.com')], {
      paperWidthMm: 58,
    });
    expect(bytes).toContain(0x1d);
  });

  it('compiles a barcode node', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([barcode('12345', { format: 'CODE128' })], {
      paperWidthMm: 58,
    });
    expect(bytes).toContain(0x1d);
    expect(bytes).toContain(0x6b);
  });

  it('compiles a feed node', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([feed(3)], { paperWidthMm: 58 });
    expect(bytes).toContain(0x1b);
    expect(bytes).toContain(0x64);
    expect(bytes).toContain(0x03);
  });

  it('compiles a cut node', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([cut()], { paperWidthMm: 58 });
    expect(bytes.indexOf(0x1d)).toBeGreaterThanOrEqual(0);
  });

  it('compiles a raw node', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([raw([0xaa, 0xbb])], { paperWidthMm: 58 });
    expect(bytes).toContain(0xaa);
    expect(bytes).toContain(0xbb);
  });

  it('compiles mixed text and line nodes', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument(
      [text('Title', { bold: true }), line(), text('Body')],
      { paperWidthMm: 58 }
    );
    expect(bytes.length).toBeGreaterThan(10);
  });

  it('uses 48-char line for 80mm paper', () => {
    const { compileDocument } = ThermalPrinterModule;
    const bytes = compileDocument([line()], { paperWidthMm: 80 });
    const dashCount = bytes.filter((b) => b === 0x2d).length;
    expect(dashCount).toBe(48);
  });
});
