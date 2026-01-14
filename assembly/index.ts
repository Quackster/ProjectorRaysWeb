/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Director Web Player - AssemblyScript WASM Module
// Main exports for browser consumption

// Re-export parser module
export * from "./parser";

// Re-export module version constants
export { SCORE_MODULE_VERSION } from "./score";
export { LINGO_MODULE_VERSION } from "./lingo";
export { ASSETS_MODULE_VERSION } from "./assets";

// Version info
const VERSION_MAJOR: i32 = 0;
const VERSION_MINOR: i32 = 1;
const VERSION_PATCH: i32 = 0;

export function getVersion(): i32 {
    return (VERSION_MAJOR << 16) | (VERSION_MINOR << 8) | VERSION_PATCH;
}

export function getVersionString(): string {
    return VERSION_MAJOR.toString() + "." + VERSION_MINOR.toString() + "." + VERSION_PATCH.toString();
}

// Simple test function to verify WASM is working
export function add(a: i32, b: i32): i32 {
    return a + b;
}

// Test stream reading
export function testStreamRead(data: Uint8Array): i32 {
    const stream = new ReadStream(data, Endianness.BigEndian);
    if (stream.size < 4) return -1;
    return stream.readInt32();
}

// Import for local use
import { ReadStream } from "./parser/Stream";
import { Endianness } from "./parser/Enums";
