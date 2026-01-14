/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * WASM Module Exports interface
 * These are the functions exported from our AssemblyScript WASM module
 */
export interface DirectorWasmExports {
    // Memory
    memory: WebAssembly.Memory;

    // Version
    getVersion(): number;
    getVersionString(): number; // Returns pointer to string

    // Basic test
    add(a: number, b: number): number;

    // FOURCC constants
    FOURCC_RIFX: WebAssembly.Global;
    FOURCC_MV93: WebAssembly.Global;
    FOURCC_MC95: WebAssembly.Global;

    // Score constants
    SCORE_MODULE_VERSION: WebAssembly.Global;

    // String helpers from AssemblyScript runtime
    __new(size: number, id: number): number;
    __pin(ptr: number): number;
    __unpin(ptr: number): void;
    __collect(): void;

    // Array helpers
    __newArray(id: number, values: ArrayLike<number>): number;
    __getArrayView(ptr: number): ArrayBufferView;
}

/**
 * AssemblyScript loader utility types
 */
export interface ASUtil {
    exports: DirectorWasmExports;
    memory: WebAssembly.Memory;

    // String helpers
    __getString(ptr: number): string;
    __newString(str: string): number;

    // Array helpers
    __newArray(id: number, values: ArrayLike<number>): number;
    __getArray(ptr: number): number[];
    __getArrayView(ptr: number): ArrayBufferView;
    __getArrayBuffer(ptr: number): ArrayBuffer;

    // Memory management
    __pin(ptr: number): number;
    __unpin(ptr: number): void;
    __collect(): void;
}

/**
 * Load and instantiate the Director WASM module
 */
export class WasmLoader {
    private static instance: ASUtil | null = null;
    private static loadPromise: Promise<ASUtil> | null = null;

    /**
     * Load the WASM module
     * @param wasmPath Path to the .wasm file
     * @returns Promise resolving to the ASUtil interface
     */
    static async load(wasmPath: string = '/build/director.wasm'): Promise<ASUtil> {
        // Return existing instance if already loaded
        if (WasmLoader.instance) {
            return WasmLoader.instance;
        }

        // Return existing promise if load is in progress
        if (WasmLoader.loadPromise) {
            return WasmLoader.loadPromise;
        }

        WasmLoader.loadPromise = WasmLoader.doLoad(wasmPath);
        return WasmLoader.loadPromise;
    }

    private static async doLoad(wasmPath: string): Promise<ASUtil> {
        try {
            // Dynamic import of AssemblyScript loader
            const loader = await import('@assemblyscript/loader');

            // Fetch and instantiate the WASM module
            const response = await fetch(wasmPath);
            const wasmBuffer = await response.arrayBuffer();

            const instance = await loader.instantiate(wasmBuffer, {
                env: {
                    abort: (msg: number, file: number, line: number, col: number) => {
                        console.error(`WASM abort at ${file}:${line}:${col}`);
                    }
                }
            });

            WasmLoader.instance = instance as unknown as ASUtil;
            console.log('Director WASM module loaded successfully');
            console.log('Version:', WasmLoader.instance.exports.getVersion());

            return WasmLoader.instance;
        } catch (error) {
            WasmLoader.loadPromise = null;
            throw new Error(`Failed to load WASM module: ${error}`);
        }
    }

    /**
     * Get the loaded WASM instance
     * @throws Error if not yet loaded
     */
    static getInstance(): ASUtil {
        if (!WasmLoader.instance) {
            throw new Error('WASM module not loaded. Call WasmLoader.load() first.');
        }
        return WasmLoader.instance;
    }

    /**
     * Check if WASM is loaded
     */
    static isLoaded(): boolean {
        return WasmLoader.instance !== null;
    }

    /**
     * Read a string from WASM memory
     */
    static getString(ptr: number): string {
        return WasmLoader.getInstance().__getString(ptr);
    }

    /**
     * Allocate a string in WASM memory
     */
    static newString(str: string): number {
        return WasmLoader.getInstance().__newString(str);
    }

    /**
     * Pin an object in WASM memory (prevent GC)
     */
    static pin(ptr: number): number {
        return WasmLoader.getInstance().__pin(ptr);
    }

    /**
     * Unpin an object (allow GC)
     */
    static unpin(ptr: number): void {
        WasmLoader.getInstance().__unpin(ptr);
    }

    /**
     * Trigger garbage collection
     */
    static collect(): void {
        WasmLoader.getInstance().__collect();
    }

    /**
     * Get a view of WASM memory as Uint8Array
     */
    static getMemoryView(): Uint8Array {
        return new Uint8Array(WasmLoader.getInstance().memory.buffer);
    }

    /**
     * Copy data into WASM memory
     * @param data The data to copy
     * @returns Pointer to the allocated buffer
     */
    static copyToMemory(data: Uint8Array): number {
        const instance = WasmLoader.getInstance();

        // Use __newArray to allocate a Uint8Array in WASM
        // ID 1 is typically Uint8Array in AssemblyScript
        const ptr = instance.__newArray(1, Array.from(data));
        return instance.__pin(ptr);
    }

    /**
     * Read data from WASM memory
     * @param ptr Pointer to the data
     * @param length Number of bytes to read
     */
    static readFromMemory(ptr: number, length: number): Uint8Array {
        const memory = WasmLoader.getMemoryView();
        return memory.slice(ptr, ptr + length);
    }
}
