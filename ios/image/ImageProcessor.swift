// ImageProcessor.swift — Decode, resize, Floyd-Steinberg dither → ESC/POS raster bytes
import Foundation
import CoreGraphics
import UIKit

enum ImageProcessorError: Error, LocalizedError {
    case invalidSource
    case decodeFailed
    case resizeFailed
    case renderFailed

    var errorDescription: String? {
        switch self {
        case .invalidSource: return "Unrecognised image source type"
        case .decodeFailed: return "Could not decode image"
        case .resizeFailed: return "Could not resize image"
        case .renderFailed: return "Could not render image to bitmap"
        }
    }
}

final class ImageProcessor {

    // MARK: - Entry point

    /// Decode → resize → dither → ESC/POS raster bytes.
    func process(source: String,
                 sourceType: String,
                 widthPx: Int,
                 align: Int) throws -> Data {
        let image  = try decode(source: source, sourceType: sourceType)
        let resized = try resize(image: image, targetWidth: widthPx)
        let bits    = try floydSteinberg(image: resized, width: widthPx)
        return escposRaster(bits: bits, width: widthPx, height: resized.height, align: align)
    }

    // MARK: - Decode

    private func decode(source: String, sourceType: String) throws -> CGImage {
        switch sourceType.lowercased() {
        case "file", "path":
            return try decodeFromFile(source)
        case "base64":
            return try decodeFromBase64(source)
        case "url":
            return try decodeFromURL(source)
        default:
            // Auto-detect
            if let img = try? decodeFromFile(source) { return img }
            if let img = try? decodeFromBase64(source) { return img }
            throw ImageProcessorError.invalidSource
        }
    }

    private func decodeFromFile(_ path: String) throws -> CGImage {
        guard let ui = UIImage(contentsOfFile: path), let cg = ui.cgImage else {
            throw ImageProcessorError.decodeFailed
        }
        return cg
    }

    private func decodeFromBase64(_ b64: String) throws -> CGImage {
        let clean = b64.replacingOccurrences(
            of: "data:image/[^;]+;base64,", with: "", options: .regularExpression)
        guard let data = Data(base64Encoded: clean, options: .ignoreUnknownCharacters),
              let ui = UIImage(data: data),
              let cg = ui.cgImage else {
            throw ImageProcessorError.decodeFailed
        }
        return cg
    }

    private func decodeFromURL(_ urlString: String) throws -> CGImage {
        guard let url = URL(string: urlString),
              let data = try? Data(contentsOf: url),
              let ui = UIImage(data: data),
              let cg = ui.cgImage else {
            throw ImageProcessorError.decodeFailed
        }
        return cg
    }

    // MARK: - Resize (greyscale, targetWidth × proportional height)

    private func resize(image: CGImage, targetWidth: Int) throws -> CGImage {
        guard image.width > 0, image.height > 0 else { throw ImageProcessorError.resizeFailed }

        let scale = Double(targetWidth) / Double(image.width)
        let targetHeight = max(1, Int((Double(image.height) * scale).rounded()))
        let colorSpace = CGColorSpaceCreateDeviceGray()

        guard let ctx = CGContext(
            data: nil,
            width: targetWidth,
            height: targetHeight,
            bitsPerComponent: 8,
            bytesPerRow: targetWidth,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { throw ImageProcessorError.resizeFailed }

        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))

        guard let result = ctx.makeImage() else { throw ImageProcessorError.resizeFailed }
        return result
    }

    // MARK: - Floyd-Steinberg dithering → 1-bit array (1 = black, 0 = white)

    private func floydSteinberg(image: CGImage, width: Int) throws -> [UInt8] {
        let h = image.height
        let colorSpace = CGColorSpaceCreateDeviceGray()
        var pixels = [UInt8](repeating: 255, count: width * h)

        guard let ctx = CGContext(
            data: &pixels,
            width: width,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: width,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { throw ImageProcessorError.renderFailed }

        ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: h))

        var gray = pixels.map { Float($0) }
        var result = [UInt8](repeating: 0, count: width * h)

        for y in 0..<h {
            for x in 0..<width {
                let i = y * width + x
                let old = gray[i]
                let quantised: Float = old < 128 ? 0 : 255
                result[i] = quantised < 128 ? 1 : 0   // 1 = black dot
                let err = old - quantised

                // Distribute error — Floyd-Steinberg coefficients
                if x + 1 < width {
                    gray[i + 1]              += err * (7.0 / 16.0)
                }
                if y + 1 < h {
                    if x > 0 {
                        gray[(y + 1) * width + (x - 1)] += err * (3.0 / 16.0)
                    }
                    gray[(y + 1) * width + x]           += err * (5.0 / 16.0)
                    if x + 1 < width {
                        gray[(y + 1) * width + (x + 1)] += err * (1.0 / 16.0)
                    }
                }
            }
        }

        return result
    }

    // MARK: - ESC/POS GS v 0 raster image

    private func escposRaster(bits: [UInt8], width: Int, height: Int, align: Int) -> Data {
        let bytesPerRow = (width + 7) / 8
        var data = Data()

        // Alignment: ESC a n  (0=left, 1=center, 2=right)
        let alignByte = UInt8(min(max(align, 0), 2))
        data.append(contentsOf: [0x1B, 0x61, alignByte])

        // GS v 0 m xL xH yL yH <data>
        let xL = UInt8(bytesPerRow & 0xFF)
        let xH = UInt8((bytesPerRow >> 8) & 0xFF)
        let yL = UInt8(height & 0xFF)
        let yH = UInt8((height >> 8) & 0xFF)
        data.append(contentsOf: [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH])

        for y in 0..<height {
            for col in 0..<bytesPerRow {
                var byte: UInt8 = 0
                for bit in 0..<8 {
                    let x = col * 8 + bit
                    if x < width && bits[y * width + x] == 1 {
                        byte |= UInt8(0x80 >> bit)
                    }
                }
                data.append(byte)
            }
        }

        return data
    }
}
