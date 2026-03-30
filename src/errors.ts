// src/errors.ts

export enum ErrorCode {
  BLUETOOTH_DISABLED = 'BLUETOOTH_DISABLED',
  BLUETOOTH_NOT_SUPPORTED = 'BLUETOOTH_NOT_SUPPORTED',
  BLUETOOTH_PERMISSION_DENIED = 'BLUETOOTH_PERMISSION_DENIED',
  SCAN_FAILED = 'SCAN_FAILED',
  SCAN_TIMEOUT = 'SCAN_TIMEOUT',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  WRITE_FAILED = 'WRITE_FAILED',
  PRINT_TIMEOUT = 'PRINT_TIMEOUT',
  INVALID_DATA = 'INVALID_DATA',
  IMAGE_LOAD_FAILED = 'IMAGE_LOAD_FAILED',
  IMAGE_DECODE_FAILED = 'IMAGE_DECODE_FAILED',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  UNSUPPORTED_TRANSPORT = 'UNSUPPORTED_TRANSPORT',
}

export class ThermalPrinterError extends Error {
  readonly code: ErrorCode;
  readonly address?: string;
  readonly retryable: boolean;
  readonly suggestion?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { address?: string; retryable?: boolean; suggestion?: string }
  ) {
    super(message);
    this.name = 'ThermalPrinterError';
    this.code = code;
    this.address = options?.address;
    this.retryable = options?.retryable ?? false;
    this.suggestion = options?.suggestion;
  }
}
