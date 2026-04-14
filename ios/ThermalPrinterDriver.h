#pragma once
#import <RNThermalPrinterDriverSpec/RNThermalPrinterDriverSpec.h>
#import <React/RCTEventEmitter.h>

NS_ASSUME_NONNULL_BEGIN

/// ObjC++ bridge: extends RCTEventEmitter and conforms to the codegen spec.
/// All method bodies delegate to ThermalPrinterDriverImpl (Swift).
@interface ThermalPrinterDriver : RCTEventEmitter <NativeThermalPrinterDriverSpec>

@end

NS_ASSUME_NONNULL_END
