#import "ThermalPrinterDriver.h"

// Swift implementation — generated umbrella header name matches the module's
// product name with hyphens replaced by underscores.
#import "ThermalPrinterDriver-Swift.h"

@implementation ThermalPrinterDriver {
    ThermalPrinterDriverImpl *_impl;
}

// MARK: - Lifecycle

- (instancetype)init {
    if (self = [super init]) {
        _impl = [[ThermalPrinterDriverImpl alloc] init];
        __weak ThermalPrinterDriver *weakSelf = self;
        _impl.onEvent = ^(NSString *name, NSDictionary *body) {
            [weakSelf sendEventWithName:name body:body];
        };
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

// MARK: - RCTEventEmitter

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"onDeviceFound",
        @"onScanComplete",
        @"onPrinterStateChanged",
    ];
}

// MARK: - TurboModule registration

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeThermalPrinterDriverSpecJSI>(params);
}

+ (NSString *)moduleName {
    return @"ThermalPrinterDriver";
}

// MARK: - Discovery

- (void)scanDevices:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    [_impl scanDevicesWithResolve:resolve reject:reject];
}

- (void)stopScan:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    [_impl stopScanWithResolve:resolve reject:reject];
}

// MARK: - Connection

- (void)connect:(NSString *)address
        timeout:(double)timeout
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
    [_impl connectWithAddress:address timeout:timeout resolve:resolve reject:reject];
}

- (void)disconnect:(NSString *)address
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    [_impl disconnectWithAddress:address resolve:resolve reject:reject];
}

- (void)testConnection:(NSString *)address
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    [_impl testConnectionWithAddress:address resolve:resolve reject:reject];
}

// MARK: - Printing

- (void)printRaw:(NSString *)address
            data:(NSArray<NSNumber *> *)data
       keepAlive:(BOOL)keepAlive
         timeout:(double)timeout
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
    [_impl printRawWithAddress:address
                          data:data
                     keepAlive:keepAlive
                       timeout:timeout
                       resolve:resolve
                        reject:reject];
}

- (void)printImage:(NSString *)address
            source:(NSString *)source
        sourceType:(NSString *)sourceType
           widthPx:(double)widthPx
             align:(double)align
         keepAlive:(BOOL)keepAlive
           timeout:(double)timeout
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    [_impl printImageWithAddress:address
                          source:source
                      sourceType:sourceType
                         widthPx:(NSInteger)widthPx
                           align:(NSInteger)align
                       keepAlive:keepAlive
                         timeout:timeout
                         resolve:resolve
                          reject:reject];
}

// MARK: - Events boilerplate

- (void)addListener:(NSString *)eventName {
    [super addListener:eventName];
    [_impl addListener:eventName];
}

- (void)removeListeners:(double)count {
    [super removeListeners:count];
    [_impl removeListeners:count];
}

@end
