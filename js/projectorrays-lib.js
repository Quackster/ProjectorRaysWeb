/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * ProjectorRays Library - Core functions for Director file processing
 */

import { FOURCC } from './lingodec/enums.js';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert various buffer types to Uint8Array
 */
export function toUint8Array(data) {
    if (data instanceof Uint8Array) {
        return data;
    }
    if (data.buffer && data.byteOffset !== undefined) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    return new Uint8Array(data.buffer || data);
}

// ============================================================================
// Palette Handling - Following ScummVM's Director engine
// ============================================================================

/**
 * Built-in palette type IDs (matching ScummVM's PaletteType enum)
 */
export const PaletteType = {
    kClutSystemMac: -1,
    kClutRainbow: -2,
    kClutGrayscale: -3,
    kClutPastels: -4,
    kClutVivid: -5,
    kClutNTSC: -6,
    kClutMetallic: -7,
    kClutWeb216: -8,
    kClutSystemWin: -101,
    kClutSystemWinD5: -102
};

/**
 * Generate Mac System palette (256 colors)
 * Classic Macintosh system palette used by Director
 */
export function generateSystemMacPalette() {
    const palette = new Array(256);

    // 6x6x6 color cube for indices 0-215
    // index 0 = white, lower indices are brighter
    for (let i = 0; i < 215; i++) {
        const r = 5 - Math.floor(i / 36);
        const g = 5 - Math.floor((i % 36) / 6);
        const b = 5 - (i % 6);
        palette[i] = [r * 51, g * 51, b * 51];
    }

    // Indices 215-254: Grayscale ramp (bright to dark)
    for (let i = 215; i < 255; i++) {
        const gray = Math.round(255 - ((i - 215) * 255 / 39));
        palette[i] = [gray, gray, gray];
    }

    palette[255] = [0, 0, 0];    // Black
    palette[0] = [255, 255, 255]; // White

    return palette;
}

/**
 * Generate Grayscale palette (256 levels)
 */
export function generateGrayscalePalette() {
    const palette = new Array(256);
    for (let i = 0; i < 256; i++) {
        const gray = 255 - i;
        palette[i] = [gray, gray, gray];
    }
    return palette;
}

/**
 * Generate Rainbow palette
 */
export function generateRainbowPalette() {
    const palette = new Array(256);
    for (let i = 0; i < 256; i++) {
        const h = (i / 255) * 360;
        const s = 1.0;
        const v = 1.0;
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        palette[i] = [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
    }
    return palette;
}

// Cache of built-in palettes
const builtInPalettes = {};

/**
 * Get a built-in palette by its ID
 */
export function getBuiltInPalette(paletteId) {
    if (builtInPalettes[paletteId]) {
        return builtInPalettes[paletteId];
    }

    let palette;
    switch (paletteId) {
        case PaletteType.kClutSystemMac:
        case PaletteType.kClutSystemWin:
        case PaletteType.kClutSystemWinD5:
            palette = generateSystemMacPalette();
            break;
        case PaletteType.kClutGrayscale:
            palette = generateGrayscalePalette();
            break;
        case PaletteType.kClutRainbow:
            palette = generateRainbowPalette();
            break;
        case PaletteType.kClutPastels:
        case PaletteType.kClutVivid:
        case PaletteType.kClutNTSC:
        case PaletteType.kClutMetallic:
        case PaletteType.kClutWeb216:
            palette = generateSystemMacPalette();
            break;
        default:
            palette = generateSystemMacPalette();
            break;
    }

    builtInPalettes[paletteId] = palette;
    return palette;
}

/**
 * Parse a CLUT chunk into a palette array
 */
export function parseCLUTChunk(clutData) {
    const bytes = toUint8Array(clutData);
    const numColors = Math.min(256, Math.floor(bytes.length / 6));
    const palette = [];
    for (let i = 0; i < numColors; i++) {
        const offset = i * 6;
        palette.push([
            bytes[offset] || 0,
            bytes[offset + 2] || 0,
            bytes[offset + 4] || 0
        ]);
    }
    while (palette.length < 256) {
        palette.push([0, 0, 0]);
    }
    return palette;
}

/**
 * Parse the palette ID from bitmap member specificData
 * Following ScummVM's BitmapCastMember parsing
 */
export function parseBitmapPaletteId(specificData, version) {
    if (!specificData || specificData.length < 24) {
        return { paletteId: PaletteType.kClutSystemMac, castLib: -1 };
    }

    const bytes = toUint8Array(specificData);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const bytesFlag = view.getUint16(0, false);
    const hasExtendedData = (bytesFlag & 0x8000) !== 0;

    if (!hasExtendedData) {
        return { paletteId: PaletteType.kClutSystemMac, castLib: -1 };
    }

    let paletteId = PaletteType.kClutSystemMac;
    let castLib = -1;

    try {
        if (version >= 500) {
            if (bytes.length >= 28) {
                castLib = view.getInt16(24, false);
                paletteId = view.getInt16(26, false);
            }
        } else if (version >= 400) {
            if (bytes.length >= 26) {
                paletteId = view.getInt16(24, false);
            }
        } else {
            if (bytes.length >= 24) {
                paletteId = view.getInt16(22, false);
            }
        }

        if (paletteId <= 0) {
            paletteId = paletteId - 1;
            castLib = -1;
        }
    } catch (e) {
        console.warn('Error parsing palette ID:', e);
    }

    paletteId = 0;
    return { paletteId, castLib };
}

/**
 * Get the palette for a bitmap by looking up its palette reference
 * @param {Object} bitmapMember - The bitmap cast member
 * @param {Object} dirFile - The DirectorFile instance
 * @param {number} version - Director version
 */
export function getPaletteForBitmap(bitmapMember, dirFile, version) {
    const { paletteId, castLib } = parseBitmapPaletteId(bitmapMember.specificData, version);

    // Built-in palette (negative ID)
    if (paletteId < 0) {
        return {
            palette: getBuiltInPalette(paletteId),
            name: getPaletteName(paletteId),
            id: paletteId
        };
    }

    // Cast member palette (positive ID)
    if (paletteId > 0 && dirFile) {
        try {
            const keyTable = dirFile.keyTable;
            if (keyTable) {
                const clutFourCC = FOURCC('C', 'L', 'U', 'T');
                for (const entry of keyTable.entries) {
                    if (entry.castID === paletteId && entry.fourCC === clutFourCC) {
                        const clutData = dirFile.getChunkData(clutFourCC, entry.sectionID);
                        if (clutData) {
                            return {
                                palette: parseCLUTChunk(clutData),
                                name: `Cast Member #${paletteId}`,
                                id: paletteId
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Error looking up CLUT palette:', e);
        }
    }

    // Default fallback
    return {
        palette: getBuiltInPalette(PaletteType.kClutSystemMac),
        name: 'System - Mac',
        id: PaletteType.kClutSystemMac
    };
}

/**
 * Get human-readable name for a palette ID
 */
export function getPaletteName(paletteId) {
    switch (paletteId) {
        case PaletteType.kClutSystemMac: return 'System - Mac';
        case PaletteType.kClutRainbow: return 'Rainbow';
        case PaletteType.kClutGrayscale: return 'Grayscale';
        case PaletteType.kClutPastels: return 'Pastels';
        case PaletteType.kClutVivid: return 'Vivid';
        case PaletteType.kClutNTSC: return 'NTSC';
        case PaletteType.kClutMetallic: return 'Metallic';
        case PaletteType.kClutWeb216: return 'Web 216';
        case PaletteType.kClutSystemWin: return 'System - Win';
        case PaletteType.kClutSystemWinD5: return 'System - Win (D5)';
        default:
            if (paletteId > 0) return `Cast Member #${paletteId}`;
            return `Unknown (${paletteId})`;
    }
}

// ============================================================================
// BITD Bitmap Decoder - Following ScummVM's BITDDecoder
// ============================================================================

/**
 * Parse bitmap member specific data
 * Following ScummVM's BitmapCastMember
 */
export function parseBitmapMemberData(specificData, version) {
    if (!specificData || specificData.length < 10) {
        return null;
    }

    const bytes = toUint8Array(specificData);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const flags = view.getUint16(0, false);
    const top = view.getInt16(2, false);
    const left = view.getInt16(4, false);
    const bottom = view.getInt16(6, false);
    const right = view.getInt16(8, false);

    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) {
        return null;
    }

    let pitch = 0;
    let bitsPerPixel = 1;
    let paletteId = PaletteType.kClutSystemMac;

    if (version < 400) {
        pitch = width;
        if (pitch % 16 !== 0) {
            pitch += 16 - (width % 16);
        }

        if ((flags & 0x8000) !== 0 && bytes.length >= 24) {
            bitsPerPixel = view.getUint16(20, false);
            const clutId = view.getInt16(22, false);
            paletteId = clutId <= 0 ? clutId - 1 : clutId;
        }

        pitch = (pitch * bitsPerPixel) >> 3;
    } else {
        pitch = flags & 0x7FFF;

        if (bytes.length >= 24) {
            bitsPerPixel = view.getUint8(23);
            if (bitsPerPixel === 0) bitsPerPixel = 1;
        }

        if (version >= 500 && bytes.length >= 28) {
            paletteId = view.getInt16(26, false);
            if (paletteId <= 0) paletteId = paletteId - 1;
        } else if (bytes.length >= 26) {
            paletteId = view.getInt16(24, false);
            if (paletteId <= 0) paletteId = paletteId - 1;
        }
    }

    if (pitch === 0) {
        pitch = Math.ceil((width * bitsPerPixel) / 8);
        if (pitch % 2 !== 0) pitch++;
    }

    return {
        width,
        height,
        bitsPerPixel,
        pitch,
        paletteId,
        top,
        left
    };
}

/**
 * ScummVM-style RLE decompression for BITD chunks
 */
export function decompressBITD(stream, expectedBytes, version, bitsPerPixel) {
    const streamSize = stream.length;

    if (version < 400 && bitsPerPixel === 32) {
        return stream;
    }

    if (streamSize >= expectedBytes) {
        return stream;
    }

    const output = new Uint8Array(expectedBytes);
    let srcPos = 0;
    let dstPos = 0;

    while (srcPos < streamSize && dstPos < expectedBytes) {
        const code = stream[srcPos++];

        if ((code & 0x80) === 0) {
            const count = code + 1;
            for (let i = 0; i < count && srcPos < streamSize && dstPos < expectedBytes; i++) {
                output[dstPos++] = stream[srcPos++];
            }
        } else {
            const count = (code ^ 0xFF) + 2;
            const value = srcPos < streamSize ? stream[srcPos++] : 0;
            for (let i = 0; i < count && dstPos < expectedBytes; i++) {
                output[dstPos++] = value;
            }
        }
    }

    while (dstPos < expectedBytes) {
        output[dstPos++] = 0;
    }

    return output;
}

/**
 * Decode BITD bitmap data to RGBA pixel array
 * Returns { pixels: Uint8ClampedArray, width, height, isCompressed }
 */
export function decodeBITD(stream, width, height, bitsPerPixel, pitch, palette, version) {
    if (width <= 0 || height <= 0 || width > 4096 || height > 4096) {
        throw new Error('Invalid bitmap dimensions');
    }

    palette = palette || getBuiltInPalette(PaletteType.kClutSystemMac);

    const expectedBytes = pitch * height;
    const isCompressed = stream.length < expectedBytes;

    let data;
    if (isCompressed) {
        data = decompressBITD(stream, expectedBytes, version, bitsPerPixel);
    } else {
        data = stream;
    }

    const pixels = new Uint8ClampedArray(width * height * 4);

    if (bitsPerPixel === 1) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIdx = y * pitch + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8);
                const bit = (data[byteIdx] >> bitIdx) & 1;
                const color = bit ? 0 : 255;
                const dstOffset = (y * width + x) * 4;
                pixels[dstOffset] = color;
                pixels[dstOffset + 1] = color;
                pixels[dstOffset + 2] = color;
                pixels[dstOffset + 3] = 255;
            }
        }
    } else if (bitsPerPixel === 2) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIdx = y * pitch + Math.floor(x / 4);
                const shift = 2 * (3 - (x % 4));
                const colorIdx = (data[byteIdx] >> shift) & 0x03;
                const gray = 255 - (colorIdx * 85);
                const dstOffset = (y * width + x) * 4;
                pixels[dstOffset] = gray;
                pixels[dstOffset + 1] = gray;
                pixels[dstOffset + 2] = gray;
                pixels[dstOffset + 3] = 255;
            }
        }
    } else if (bitsPerPixel === 4) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIdx = y * pitch + Math.floor(x / 2);
                const shift = 4 * (1 - (x % 2));
                const colorIdx = (data[byteIdx] >> shift) & 0x0F;
                const [r, g, b] = palette[colorIdx] || [colorIdx * 17, colorIdx * 17, colorIdx * 17];
                const dstOffset = (y * width + x) * 4;
                pixels[dstOffset] = r;
                pixels[dstOffset + 1] = g;
                pixels[dstOffset + 2] = b;
                pixels[dstOffset + 3] = 255;
            }
        }
    } else if (bitsPerPixel === 8) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIdx = y * pitch + x;
                const colorIdx = data[byteIdx] || 0;
                const [r, g, b] = palette[colorIdx] || [colorIdx, colorIdx, colorIdx];
                const dstOffset = (y * width + x) * 4;
                pixels[dstOffset] = r;
                pixels[dstOffset + 1] = g;
                pixels[dstOffset + 2] = b;
                pixels[dstOffset + 3] = 255;
            }
        }
    } else if (bitsPerPixel === 16) {
        if (isCompressed) {
            for (let y = 0; y < height; y++) {
                const rowStart = y * pitch;
                for (let x = 0; x < width; x++) {
                    const hi = data[rowStart + x];
                    const lo = data[rowStart + width + x];
                    const pixel = (hi << 8) | lo;
                    const r = Math.round(((pixel >> 10) & 0x1F) * 255 / 31);
                    const g = Math.round(((pixel >> 5) & 0x1F) * 255 / 31);
                    const b = Math.round((pixel & 0x1F) * 255 / 31);
                    const dstOffset = (y * width + x) * 4;
                    pixels[dstOffset] = r;
                    pixels[dstOffset + 1] = g;
                    pixels[dstOffset + 2] = b;
                    pixels[dstOffset + 3] = 255;
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * pitch + x * 2;
                    const pixel = (data[offset] << 8) | data[offset + 1];
                    const r = Math.round(((pixel >> 10) & 0x1F) * 255 / 31);
                    const g = Math.round(((pixel >> 5) & 0x1F) * 255 / 31);
                    const b = Math.round((pixel & 0x1F) * 255 / 31);
                    const dstOffset = (y * width + x) * 4;
                    pixels[dstOffset] = r;
                    pixels[dstOffset + 1] = g;
                    pixels[dstOffset + 2] = b;
                    pixels[dstOffset + 3] = 255;
                }
            }
        }
    } else if (bitsPerPixel === 32) {
        if (isCompressed && version >= 400) {
            for (let y = 0; y < height; y++) {
                const rowStart = y * pitch;
                for (let x = 0; x < width; x++) {
                    const a = data[rowStart + x];
                    const r = data[rowStart + width + x];
                    const g = data[rowStart + width * 2 + x];
                    const b = data[rowStart + width * 3 + x];
                    const dstOffset = (y * width + x) * 4;
                    pixels[dstOffset] = r;
                    pixels[dstOffset + 1] = g;
                    pixels[dstOffset + 2] = b;
                    pixels[dstOffset + 3] = a;
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const offset = y * pitch + x * 4;
                    const a = data[offset] || 255;
                    const r = data[offset + 1] || 0;
                    const g = data[offset + 2] || 0;
                    const b = data[offset + 3] || 0;
                    const dstOffset = (y * width + x) * 4;
                    pixels[dstOffset] = r;
                    pixels[dstOffset + 1] = g;
                    pixels[dstOffset + 2] = b;
                    pixels[dstOffset + 3] = a;
                }
            }
        }
    } else {
        throw new Error(`Unsupported bit depth: ${bitsPerPixel}`);
    }

    return { pixels, width, height, isCompressed };
}

// ============================================================================
// Sound Handling
// ============================================================================

/**
 * Detect sound format from header bytes
 */
export function detectSoundFormat(bytes) {
    if (bytes.length < 12) return { format: 'unknown', mimeType: 'application/octet-stream', ext: '.bin' };

    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

    if (magic === 'FORM') {
        const type = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (type === 'AIFF' || type === 'AIFC') {
            return { format: 'aiff', mimeType: 'audio/aiff', ext: '.aiff' };
        }
    }

    if (magic === 'RIFF') {
        const type = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (type === 'WAVE') {
            return { format: 'wav', mimeType: 'audio/wav', ext: '.wav' };
        }
    }

    const sndType = (bytes[0] << 8) | bytes[1];
    if (sndType === 1 || sndType === 2) {
        return { format: 'snd', mimeType: 'audio/basic', ext: '.snd' };
    }

    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
        (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
        return { format: 'mp3', mimeType: 'audio/mpeg', ext: '.mp3' };
    }

    return { format: 'unknown', mimeType: 'application/octet-stream', ext: '.snd' };
}

/**
 * Convert Mac SND resource to WAV format
 */
export function convertSndToWav(sndBytes) {
    try {
        const view = new DataView(sndBytes.buffer, sndBytes.byteOffset, sndBytes.byteLength);
        const sndType = view.getUint16(0, false);

        let sampleRate = 22050;
        let numChannels = 1;
        let bitsPerSample = 8;
        let dataOffset = 0;
        let dataLength = 0;

        if (sndType === 1) {
            const numDataFormats = view.getUint16(2, false);
            let offset = 4;

            for (let i = 0; i < numDataFormats; i++) {
                const dataType = view.getUint16(offset, false);
                offset += 2;
                if (dataType === 5) {
                    offset += 4;
                }
            }

            const numCommands = view.getUint16(offset, false);
            offset += 2;

            for (let i = 0; i < numCommands; i++) {
                const cmd = view.getUint16(offset, false);
                offset += 2;
                const param1 = view.getUint16(offset, false);
                offset += 2;
                const param2 = view.getUint32(offset, false);
                offset += 4;

                if (cmd === 0x8051) {
                    dataOffset = param2;
                }
            }
        } else if (sndType === 2) {
            dataOffset = 4;
        }

        if (dataOffset === 0 || dataOffset >= sndBytes.length) {
            dataOffset = 20;
        }

        if (dataOffset + 22 <= sndBytes.length) {
            const samplePtr = view.getUint32(dataOffset, false);
            const numSamples = view.getUint32(dataOffset + 4, false);
            const sampleRateFixed = view.getUint32(dataOffset + 8, false);
            const loopStart = view.getUint32(dataOffset + 12, false);
            const loopEnd = view.getUint32(dataOffset + 16, false);
            const encoding = view.getUint8(dataOffset + 20);
            const baseFreq = view.getUint8(dataOffset + 21);

            sampleRate = Math.round(sampleRateFixed / 65536);
            if (sampleRate < 1000 || sampleRate > 96000) sampleRate = 22050;

            dataOffset += 22;
            dataLength = numSamples > 0 ? numSamples : sndBytes.length - dataOffset;
        } else {
            dataLength = sndBytes.length - dataOffset;
        }

        const pcmData = sndBytes.slice(dataOffset, dataOffset + dataLength);

        const wavSize = 44 + pcmData.length;
        const wavBuffer = new ArrayBuffer(wavSize);
        const wavView = new DataView(wavBuffer);
        const wavBytes = new Uint8Array(wavBuffer);

        wavBytes.set([0x52, 0x49, 0x46, 0x46], 0);
        wavView.setUint32(4, wavSize - 8, true);
        wavBytes.set([0x57, 0x41, 0x56, 0x45], 8);

        wavBytes.set([0x66, 0x6D, 0x74, 0x20], 12);
        wavView.setUint32(16, 16, true);
        wavView.setUint16(20, 1, true);
        wavView.setUint16(22, numChannels, true);
        wavView.setUint32(24, sampleRate, true);
        wavView.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
        wavView.setUint16(32, numChannels * bitsPerSample / 8, true);
        wavView.setUint16(34, bitsPerSample, true);

        wavBytes.set([0x64, 0x61, 0x74, 0x61], 36);
        wavView.setUint32(40, pcmData.length, true);
        wavBytes.set(pcmData, 44);

        return { data: wavBytes, sampleRate, numChannels, bitsPerSample, numSamples: pcmData.length };
    } catch (e) {
        console.error('Error converting SND to WAV:', e);
        return null;
    }
}

// ============================================================================
// Text Handling
// ============================================================================

/**
 * Mac Roman to Unicode mapping
 */
export const MAC_ROMAN_MAP = {
    0x80: '\u00C4', 0x81: '\u00C5', 0x82: '\u00C7', 0x83: '\u00C9',
    0x84: '\u00D1', 0x85: '\u00D6', 0x86: '\u00DC', 0x87: '\u00E1',
    0x88: '\u00E0', 0x89: '\u00E2', 0x8A: '\u00E4', 0x8B: '\u00E3',
    0x8C: '\u00E5', 0x8D: '\u00E7', 0x8E: '\u00E9', 0x8F: '\u00E8',
    0x90: '\u00EA', 0x91: '\u00EB', 0x92: '\u00ED', 0x93: '\u00EC',
    0x94: '\u00EE', 0x95: '\u00EF', 0x96: '\u00F1', 0x97: '\u00F3',
    0x98: '\u00F2', 0x99: '\u00F4', 0x9A: '\u00F6', 0x9B: '\u00F5',
    0x9C: '\u00FA', 0x9D: '\u00F9', 0x9E: '\u00FB', 0x9F: '\u00FC',
    0xA0: '\u2020', 0xA1: '\u00B0', 0xA2: '\u00A2', 0xA3: '\u00A3',
    0xA4: '\u00A7', 0xA5: '\u2022', 0xA6: '\u00B6', 0xA7: '\u00DF',
    0xA8: '\u00AE', 0xA9: '\u00A9', 0xAA: '\u2122', 0xAB: '\u00B4',
    0xAC: '\u00A8', 0xAD: '\u2260', 0xAE: '\u00C6', 0xAF: '\u00D8',
    0xB0: '\u221E', 0xB1: '\u00B1', 0xB2: '\u2264', 0xB3: '\u2265',
    0xB4: '\u00A5', 0xB5: '\u00B5', 0xB6: '\u2202', 0xB7: '\u2211',
    0xB8: '\u220F', 0xB9: '\u03C0', 0xBA: '\u222B', 0xBB: '\u00AA',
    0xBC: '\u00BA', 0xBD: '\u03A9', 0xBE: '\u00E6', 0xBF: '\u00F8',
    0xC0: '\u00BF', 0xC1: '\u00A1', 0xC2: '\u00AC', 0xC3: '\u221A',
    0xC4: '\u0192', 0xC5: '\u2248', 0xC6: '\u2206', 0xC7: '\u00AB',
    0xC8: '\u00BB', 0xC9: '\u2026', 0xCA: '\u00A0', 0xCB: '\u00C0',
    0xCC: '\u00C3', 0xCD: '\u00D5', 0xCE: '\u0152', 0xCF: '\u0153',
    0xD0: '\u2013', 0xD1: '\u2014', 0xD2: '\u201C', 0xD3: '\u201D',
    0xD4: '\u2018', 0xD5: '\u2019', 0xD6: '\u00F7', 0xD7: '\u25CA',
    0xD8: '\u00FF', 0xD9: '\u0178', 0xDA: '\u2044', 0xDB: '\u20AC',
    0xDC: '\u2039', 0xDD: '\u203A', 0xDE: '\uFB01', 0xDF: '\uFB02',
    0xE0: '\u2021', 0xE1: '\u00B7', 0xE2: '\u201A', 0xE3: '\u201E',
    0xE4: '\u2030', 0xE5: '\u00C2', 0xE6: '\u00CA', 0xE7: '\u00C1',
    0xE8: '\u00CB', 0xE9: '\u00C8', 0xEA: '\u00CD', 0xEB: '\u00CE',
    0xEC: '\u00CF', 0xED: '\u00CC', 0xEE: '\u00D3', 0xEF: '\u00D4',
    0xF0: '\uF8FF', 0xF1: '\u00D2', 0xF2: '\u00DA', 0xF3: '\u00DB',
    0xF4: '\u00D9', 0xF5: '\u0131', 0xF6: '\u02C6', 0xF7: '\u02DC',
    0xF8: '\u00AF', 0xF9: '\u02D8', 0xFA: '\u02D9', 0xFB: '\u02DA',
    0xFC: '\u00B8', 0xFD: '\u02DD', 0xFE: '\u02DB', 0xFF: '\u02C7'
};

/**
 * Convert Mac Roman encoded bytes to UTF-8 string
 */
export function macRomanToUtf8(bytes, start, length) {
    let result = '';
    for (let i = start; i < start + length && i < bytes.length; i++) {
        const byte = bytes[i];
        if (byte === 0) break;
        if (byte < 128) {
            result += String.fromCharCode(byte);
        } else {
            result += MAC_ROMAN_MAP[byte] || String.fromCharCode(byte);
        }
    }
    return result;
}

// ============================================================================
// Lingo Syntax Highlighting
// ============================================================================

export const LINGO_KEYWORDS = new Set([
    'on', 'end', 'if', 'then', 'else', 'repeat', 'while', 'with', 'in', 'to', 'down',
    'case', 'of', 'otherwise', 'tell', 'exit', 'next', 'return', 'do',
    'property', 'global', 'instance', 'method', 'factory',
    'set', 'put', 'into', 'after', 'before', 'new', 'delete', 'play', 'go', 'halt',
    'continue', 'pass', 'nothing', 'me', 'ancestor'
]);

export const LINGO_OPERATORS = new Set([
    'and', 'or', 'not', 'mod', 'contains', 'starts'
]);

export const LINGO_BUILTINS = new Set([
    'the', 'sprite', 'member', 'cast', 'castLib', 'field', 'window', 'menu',
    'void', 'true', 'false', 'VOID', 'TRUE', 'FALSE',
    'EMPTY', 'RETURN', 'ENTER', 'TAB', 'SPACE', 'QUOTE', 'BACKSPACE',
    'PI', 'point', 'rect', 'rgb', 'color', 'list', 'image'
]);

/**
 * Escape HTML for safe rendering in highlighted code
 */
export function escapeHtmlForHighlight(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Apply syntax highlighting to Lingo code
 * Returns HTML string with highlight spans
 */
export function highlightLingo(code) {
    const lines = code.split('\n');
    const highlightedLines = lines.map(line => {
        let result = '';
        let i = 0;

        while (i < line.length) {
            // Comment
            if (line[i] === '-' && line[i + 1] === '-') {
                const comment = escapeHtmlForHighlight(line.slice(i));
                result += `<span class="hl-comment">${comment}</span>`;
                break;
            }

            // String
            if (line[i] === '"') {
                let end = i + 1;
                while (end < line.length && line[end] !== '"') {
                    if (line[end] === '\\') end++;
                    end++;
                }
                if (end < line.length) end++;
                const str = escapeHtmlForHighlight(line.slice(i, end));
                result += `<span class="hl-string">${str}</span>`;
                i = end;
                continue;
            }

            // Symbol
            if (line[i] === '#') {
                let end = i + 1;
                while (end < line.length && /[\w]/.test(line[end])) end++;
                const symbol = escapeHtmlForHighlight(line.slice(i, end));
                result += `<span class="hl-symbol">${symbol}</span>`;
                i = end;
                continue;
            }

            // Number
            if (/\d/.test(line[i]) || (line[i] === '-' && /\d/.test(line[i + 1]))) {
                let end = i;
                if (line[end] === '-') end++;
                while (end < line.length && /[\d.]/.test(line[end])) end++;
                const num = escapeHtmlForHighlight(line.slice(i, end));
                result += `<span class="hl-number">${num}</span>`;
                i = end;
                continue;
            }

            // Identifier/keyword
            if (/[a-zA-Z_]/.test(line[i])) {
                let end = i;
                while (end < line.length && /[\w]/.test(line[end])) end++;
                const word = line.slice(i, end);
                const wordLower = word.toLowerCase();
                const escaped = escapeHtmlForHighlight(word);

                if (LINGO_KEYWORDS.has(wordLower)) {
                    result += `<span class="hl-keyword">${escaped}</span>`;
                } else if (LINGO_OPERATORS.has(wordLower)) {
                    result += `<span class="hl-operator">${escaped}</span>`;
                } else if (LINGO_BUILTINS.has(word) || LINGO_BUILTINS.has(wordLower)) {
                    result += `<span class="hl-builtin">${escaped}</span>`;
                } else {
                    result += escaped;
                }
                i = end;
                continue;
            }

            result += escapeHtmlForHighlight(line[i]);
            i++;
        }

        return result;
    });

    return highlightedLines.join('\n');
}
