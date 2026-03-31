// src/NativeThermalPrinterDriver.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Discovery
  scanDevices(): Promise<Object>;
  stopScan(): Promise<boolean>;

  // Connection
  connect(address: string, timeout: number): Promise<Object>;
  disconnect(address: string | null): Promise<void>;
  testConnection(address: string): Promise<Object>;

  // Printing
  printRaw(
    address: string,
    data: number[],
    keepAlive: boolean,
    timeout: number
  ): Promise<Object>;
  printImage(
    address: string,
    source: string,
    sourceType: string,
    widthPx: number,
    align: number,
    keepAlive: boolean,
    timeout: number
  ): Promise<Object>;

  // Events (required boilerplate for NativeEventEmitter)
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ThermalPrinterDriver');
