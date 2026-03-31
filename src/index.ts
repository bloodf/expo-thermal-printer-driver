import { NativeEventEmitter } from 'react-native';
import NativeThermalPrinterDriver from './NativeThermalPrinterDriver';
import { compileDocument } from './compiler/escpos/compiler';
import type { Node } from './document/types';
import type {
  Device,
  ScanResult,
  TestResult,
  PrintResult,
  PrinterOptions,
  Subscription,
} from './types';
import { ThermalPrinterError, ErrorCode } from './errors';

const eventEmitter = new NativeEventEmitter(NativeThermalPrinterDriver);

function parseResult<T>(result: unknown): T {
  return result as T;
}

function addTypedListener<T>(
  eventName: string,
  callback: (event: T) => void
): Subscription {
  const sub = eventEmitter.addListener(
    eventName,
    (...args: readonly unknown[]) => {
      const [event] = args;
      if (event !== undefined) {
        callback(parseResult<T>(event));
      }
    }
  );

  return { remove: () => sub.remove() };
}

const ThermalPrinter = {
  // Discovery
  async scan(): Promise<ScanResult> {
    const result = await NativeThermalPrinterDriver.scanDevices();
    return parseResult<ScanResult>(result);
  },

  async stopScan(): Promise<void> {
    await NativeThermalPrinterDriver.stopScan();
  },

  onDeviceFound(callback: (device: Device) => void): Subscription {
    return addTypedListener('onDeviceFound', callback);
  },

  onScanCompleted(
    callback: (result: { pairedCount: number; foundCount: number }) => void
  ): Subscription {
    return addTypedListener('onScanCompleted', callback);
  },

  onConnectionChanged(
    callback: (event: { address: string; connected: boolean }) => void
  ): Subscription {
    return addTypedListener('onConnectionChanged', callback);
  },

  // Connection
  async connect(
    address: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const result = await NativeThermalPrinterDriver.connect(
      address,
      options?.timeout ?? 10000
    );
    const parsed = parseResult<{ success: boolean; error?: any }>(result);
    if (!parsed.success && parsed.error) {
      throw new ThermalPrinterError(
        (parsed.error.code as ErrorCode) ?? ErrorCode.CONNECTION_FAILED,
        parsed.error.message ?? 'Connection failed',
        {
          address,
          retryable: parsed.error.retryable,
          suggestion: parsed.error.suggestion,
        }
      );
    }
  },

  async disconnect(address?: string): Promise<void> {
    await NativeThermalPrinterDriver.disconnect(address ?? null);
  },

  async isConnected(address: string): Promise<boolean> {
    const result = await NativeThermalPrinterDriver.testConnection(address);
    const parsed = parseResult<TestResult>(result);
    return parsed.success;
  },

  async testConnection(address: string): Promise<TestResult> {
    const result = await NativeThermalPrinterDriver.testConnection(address);
    return parseResult<TestResult>(result);
  },

  // Print (document)
  async print(
    address: string,
    nodes: Node[],
    options?: PrinterOptions
  ): Promise<PrintResult> {
    const copies = options?.copies ?? 1;
    let totalBytes = 0;

    for (let i = 0; i < copies; i++) {
      // Separate image nodes from compilable nodes
      const imageNodes: Array<{
        index: number;
        node: Extract<Node, { type: 'image' }>;
      }> = [];

      nodes.forEach((node, idx) => {
        if (node.type === 'image') {
          imageNodes.push({ index: idx, node });
        }
      });

      // If no images, compile and send in one shot
      if (imageNodes.length === 0) {
        const bytes = compileDocument(nodes, options);
        const result = await NativeThermalPrinterDriver.printRaw(
          address,
          bytes,
          options?.keepAlive ?? false,
          options?.timeout ?? 10000
        );
        const parsed = parseResult<PrintResult>(result);
        if (!parsed.success) return parsed;
        totalBytes += parsed.bytesWritten ?? bytes.length;
      } else {
        // Split around images: compile text segments, call printImage for images
        let currentNodes: Node[] = [];
        for (let idx = 0; idx < nodes.length; idx++) {
          const node = nodes[idx];
          if (!node) {
            continue;
          }

          if (node.type === 'image') {
            // Flush accumulated text nodes
            if (currentNodes.length > 0) {
              const bytes = compileDocument(currentNodes, options);
              await NativeThermalPrinterDriver.printRaw(
                address,
                bytes,
                true,
                options?.timeout ?? 10000
              );
              totalBytes += bytes.length;
              currentNodes = [];
            }
            // Print image natively
            const src = node.source;
            let source: string;
            let sourceType: string;
            if ('uri' in src) {
              source = src.uri;
              sourceType = 'file';
            } else if ('url' in src) {
              source = src.url;
              sourceType = 'url';
            } else {
              source = src.base64;
              sourceType = 'base64';
            }
            const width = ('width' in src ? src.width : undefined) ?? 384;

            await NativeThermalPrinterDriver.printImage(
              address,
              source,
              sourceType,
              width,
              0,
              true,
              options?.timeout ?? 10000
            );
          } else {
            currentNodes.push(node);
          }
        }
        // Flush remaining
        if (currentNodes.length > 0) {
          const bytes = compileDocument(currentNodes, options);
          const isLast = i === copies - 1;
          await NativeThermalPrinterDriver.printRaw(
            address,
            bytes,
            isLast ? options?.keepAlive ?? false : true,
            options?.timeout ?? 10000
          );
          totalBytes += bytes.length;
        }
      }
    }

    return { success: true, bytesWritten: totalBytes };
  },

  // Print (raw)
  async printRaw(
    address: string,
    bytes: number[],
    options?: PrinterOptions
  ): Promise<PrintResult> {
    const result = await NativeThermalPrinterDriver.printRaw(
      address,
      bytes,
      options?.keepAlive ?? false,
      options?.timeout ?? 10000
    );
    return parseResult<PrintResult>(result);
  },
};

export default ThermalPrinter;

// Re-export everything
export { ThermalPrinterError, ErrorCode } from './errors';
export type {
  Device,
  ScanResult,
  TestResult,
  PrintResult,
  PrinterOptions,
  CodePage,
  TextStyle,
  Subscription,
} from './types';
export type {
  Node,
  ImageSource,
  BarcodeFormat,
  ColumnDef,
  TableDef,
} from './document/types';
export {
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
} from './document/nodes';
export { ESCPOSBuilder } from './builder/ESCPOSBuilder';
export { compileDocument } from './compiler/escpos/compiler';
