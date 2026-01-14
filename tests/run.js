/*
 * Director Web Player - WASM Test Runner
 * Run with: node --experimental-wasm-modules tests/run.js
 */

import loader from "@assemblyscript/loader";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
    console.log("Director Web Player - WASM Test Suite\n");
    console.log("=".repeat(50));

    // Load WASM module
    const wasmPath = join(__dirname, "..", "build", "director.wasm");
    let wasmBuffer;

    try {
        wasmBuffer = readFileSync(wasmPath);
    } catch (e) {
        console.error(`\nError: Could not load ${wasmPath}`);
        console.error("Make sure to run 'npm run dev' first to build the WASM module.\n");
        process.exit(1);
    }

    console.log(`\nLoaded WASM: ${wasmBuffer.length} bytes`);

    const module = await loader.instantiate(wasmBuffer);
    const { exports } = module;

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  [PASS] ${name}`);
            passed++;
        } catch (e) {
            console.log(`  [FAIL] ${name}`);
            console.log(`         ${e.message}`);
            failed++;
        }
    }

    function assertEqual(actual, expected, msg = "") {
        if (actual !== expected) {
            throw new Error(`Expected ${expected}, got ${actual}. ${msg}`);
        }
    }

    // Test 1: Version
    console.log("\n--- Version Tests ---");
    test("getVersion returns valid version", () => {
        const version = exports.getVersion();
        assertEqual(typeof version, "number");
        assertEqual(version >= 0, true, "Version should be non-negative");
    });

    test("getVersionString returns string", () => {
        const versionStr = exports.__getString(exports.getVersionString());
        assertEqual(typeof versionStr, "string");
        assertEqual(versionStr.includes("."), true, "Version string should contain dots");
        console.log(`         Version: ${versionStr}`);
    });

    // Test 2: Basic math (sanity check)
    console.log("\n--- Basic Tests ---");
    test("add function works", () => {
        assertEqual(exports.add(2, 3), 5);
        assertEqual(exports.add(-1, 1), 0);
        assertEqual(exports.add(100, 200), 300);
    });

    // Test 3: Stream reading
    console.log("\n--- Stream Tests ---");
    test("testStreamRead parses big-endian i32", () => {
        // Create test data: 0x00000042 = 66 in big-endian
        const testData = new Uint8Array([0x00, 0x00, 0x00, 0x42]);
        const ptr = exports.__pin(exports.__newArray(exports.Uint8Array_ID, testData));
        const result = exports.testStreamRead(ptr);
        exports.__unpin(ptr);
        assertEqual(result, 66);
    });

    test("testStreamRead handles larger values", () => {
        // 0x01020304 = 16909060 in big-endian
        const testData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
        const ptr = exports.__pin(exports.__newArray(exports.Uint8Array_ID, testData));
        const result = exports.testStreamRead(ptr);
        exports.__unpin(ptr);
        assertEqual(result, 16909060);
    });

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log(`\nResults: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }

    console.log("\nAll tests passed!\n");
}

runTests().catch(err => {
    console.error("Test runner error:", err);
    process.exit(1);
});
