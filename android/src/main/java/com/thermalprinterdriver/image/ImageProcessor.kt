package com.thermalprinterdriver.image

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URL

/**
 * Decodes images from a file path, base64 string, or URL, scales to target width while
 * maintaining aspect ratio, applies Floyd-Steinberg dithering to produce 1-bit monochrome,
 * and outputs ESC/POS raster format (GS v 0) processed in 64-line bands.
 */
object ImageProcessor {

    private const val TAG = "ImageProcessor"
    private const val BAND_HEIGHT = 64

    /**
     * Process an image into ESC/POS raster byte commands.
     *
     * @param source     File path (absolute or file://), base64-encoded PNG/JPEG, or http(s) URL
     * @param sourceType "file", "base64", or "url"
     * @param widthPx    Target print width in pixels
     * @param align      0 = left, 1 = center, 2 = right
     * @return Raw ESC/POS bytes ready to send to printer
     */
    fun process(source: String, sourceType: String, widthPx: Int, align: Int = 0): ByteArray {
        Log.d(TAG, "[Native:Android] ImageProcessor.process START: type=$sourceType width=$widthPx")

        val bitmap = when (sourceType.lowercase()) {
            "base64" -> decodeBase64(source)
            "url"    -> decodeUrl(source)
            else     -> decodeFile(source)       // "file" or default
        }

        val scaled = scaleBitmap(bitmap, widthPx)
        bitmap.recycle()

        val result = toEscPosRaster(scaled, align)
        scaled.recycle()

        Log.d(TAG, "[Native:Android] ImageProcessor.process SUCCESS: ${result.size} bytes")
        return result
    }

    // ---- Decode helpers ----

    private fun decodeFile(path: String): Bitmap {
        val cleanPath = path.removePrefix("file://").removePrefix("file:")
        val file = File(cleanPath)
        if (!file.exists()) throw IllegalArgumentException("Image file not found: $cleanPath")
        return BitmapFactory.decodeFile(cleanPath, argbOptions())
            ?: throw IllegalArgumentException("Cannot decode image file: $cleanPath")
    }

    private fun decodeBase64(data: String): Bitmap {
        val clean = if (data.contains(",")) data.substringAfter(",") else data
        val bytes = Base64.decode(clean, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, argbOptions())
            ?: throw IllegalArgumentException("Cannot decode base64 image")
    }

    private fun decodeUrl(url: String): Bitmap {
        val bytes = URL(url).openStream().use { it.readBytes() }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, argbOptions())
            ?: throw IllegalArgumentException("Cannot decode image from URL: $url")
    }

    private fun argbOptions() = BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.ARGB_8888
    }

    // ---- Scaling ----

    private fun scaleBitmap(src: Bitmap, targetWidth: Int): Bitmap {
        if (src.width == targetWidth) return src
        val scale = targetWidth.toFloat() / src.width
        val targetHeight = (src.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(src, targetWidth, targetHeight, true)
    }

    // ---- ESC/POS raster generation with Floyd-Steinberg dithering ----

    private fun toEscPosRaster(bitmap: Bitmap, align: Int): ByteArray {
        val width = bitmap.width
        val height = bitmap.height
        val bytesPerRow = (width + 7) / 8

        val out = ByteArrayOutputStream()

        // ESC @ — reset printer
        out.write(byteArrayOf(0x1B, 0x40))

        // ESC a — alignment
        out.write(byteArrayOf(0x1B, 0x61, align.coerceIn(0, 2).toByte()))

        // Convert to grayscale float array for Floyd-Steinberg
        val gray = FloatArray(width * height)
        for (y in 0 until height) {
            for (x in 0 until width) {
                val px = bitmap.getPixel(x, y)
                val r = (px shr 16) and 0xFF
                val g = (px shr 8)  and 0xFF
                val b = px          and 0xFF
                // Luminance-weighted grayscale (ITU-R BT.601)
                gray[y * width + x] = (0.299f * r + 0.587f * g + 0.114f * b) / 255f
            }
        }

        // Floyd-Steinberg dithering in-place
        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                val old = gray[idx]
                val new = if (old < 0.5f) 0f else 1f
                gray[idx] = new
                val err = old - new
                if (x + 1 < width)                         gray[idx + 1]         += err * 7f / 16f
                if (y + 1 < height && x > 0)               gray[(y+1)*width+x-1] += err * 3f / 16f
                if (y + 1 < height)                        gray[(y+1)*width+x]   += err * 5f / 16f
                if (y + 1 < height && x + 1 < width)       gray[(y+1)*width+x+1] += err * 1f / 16f
            }
        }

        // Emit GS v 0 command in 64-line bands
        var y = 0
        while (y < height) {
            val bandH = minOf(BAND_HEIGHT, height - y)

            // GS v 0 — raster bit image
            out.write(byteArrayOf(0x1D, 0x76, 0x30, 0x00))
            out.write(bytesPerRow and 0xFF)
            out.write((bytesPerRow shr 8) and 0xFF)
            out.write(bandH and 0xFF)
            out.write((bandH shr 8) and 0xFF)

            for (row in 0 until bandH) {
                for (byteX in 0 until bytesPerRow) {
                    var byte = 0
                    for (bit in 0..7) {
                        val x = byteX * 8 + bit
                        if (x < width) {
                            val px = gray[(y + row) * width + x]
                            if (px < 0.5f) {
                                byte = byte or (1 shl (7 - bit))
                            }
                        }
                    }
                    out.write(byte)
                }
            }

            y += bandH
        }

        return out.toByteArray()
    }
}
