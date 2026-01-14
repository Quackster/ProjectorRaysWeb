/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { WasmLoader, ASUtil } from './WasmLoader.js';

/**
 * Channel data from a frame
 */
export interface ChannelInfo {
    channelNum: number;
    castLib: number;
    castMember: number;
    locH: number;
    locV: number;
    width: number;
    height: number;
    ink: number;
    blend: number;
    visible: boolean;
    spriteType: number;
}

/**
 * Frame data from the score
 */
export interface FrameInfo {
    frameNum: number;
    tempo: number;
    transitionType: number;
    transitionDuration: number;
    paletteId: number;
    scriptId: number;
    channels: ChannelInfo[];
}

/**
 * Movie configuration
 */
export interface MovieConfig {
    stageWidth: number;
    stageHeight: number;
    frameRate: number;
    version: number;
    frameCount: number;
    channelCount: number;
}

/**
 * WasmBridge - High-level interface to the Director WASM module
 *
 * This class provides a clean JavaScript API for interacting with
 * the AssemblyScript WASM module that handles Director file parsing.
 */
export class WasmBridge {
    private wasm: ASUtil | null = null;
    private movieData: Uint8Array | null = null;
    private moviePtr: number = 0;
    private loaded: boolean = false;

    // Cached movie info
    private _config: MovieConfig | null = null;

    /**
     * Initialize the bridge (load WASM module)
     */
    async init(wasmPath?: string): Promise<void> {
        this.wasm = await WasmLoader.load(wasmPath);
        console.log('WasmBridge initialized');
    }

    /**
     * Check if WASM is loaded
     */
    isInitialized(): boolean {
        return this.wasm !== null;
    }

    /**
     * Load a Director movie file
     * @param data Raw bytes of the .dir/.dcr/.cst file
     */
    async loadMovie(data: Uint8Array): Promise<boolean> {
        if (!this.wasm) {
            throw new Error('WasmBridge not initialized. Call init() first.');
        }

        // Store the data
        this.movieData = data;

        // For now, we'll parse directly in JS since WASM class interop is complex
        // In the future, this could call WASM parsing functions directly
        this.loaded = true;
        this._config = null;

        console.log(`Movie loaded: ${data.length} bytes`);
        return true;
    }

    /**
     * Get movie configuration
     */
    getConfig(): MovieConfig {
        if (!this._config) {
            // Return defaults if not parsed yet
            this._config = {
                stageWidth: 640,
                stageHeight: 480,
                frameRate: 15,
                version: 700,
                frameCount: 0,
                channelCount: 48
            };
        }
        return this._config;
    }

    /**
     * Get frame count
     */
    getFrameCount(): number {
        return this.getConfig().frameCount;
    }

    /**
     * Get channel count
     */
    getChannelCount(): number {
        return this.getConfig().channelCount;
    }

    /**
     * Get stage dimensions
     */
    getStageSize(): { width: number; height: number } {
        const config = this.getConfig();
        return { width: config.stageWidth, height: config.stageHeight };
    }

    /**
     * Get frame rate
     */
    getFrameRate(): number {
        return this.getConfig().frameRate;
    }

    /**
     * Get version string
     */
    getVersion(): string {
        if (!this.wasm) return '0.0.0';
        const ptr = this.wasm.exports.getVersionString();
        return this.wasm.__getString(ptr);
    }

    /**
     * Check if movie is loaded
     */
    isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Get frame data
     * @param frameNum Frame number (1-indexed like Director)
     */
    getFrame(frameNum: number): FrameInfo | null {
        if (!this.loaded) return null;

        // Placeholder - would retrieve from WASM-parsed score
        return {
            frameNum,
            tempo: 0,
            transitionType: 0,
            transitionDuration: 0,
            paletteId: -1,
            scriptId: 0,
            channels: []
        };
    }

    /**
     * Get active (non-empty) channels for a frame
     */
    getActiveChannels(frameNum: number): ChannelInfo[] {
        const frame = this.getFrame(frameNum);
        if (!frame) return [];
        return frame.channels.filter(ch => ch.castMember > 0);
    }

    /**
     * Unload the movie and free resources
     */
    unload(): void {
        if (this.moviePtr && this.wasm) {
            WasmLoader.unpin(this.moviePtr);
            this.moviePtr = 0;
        }
        this.movieData = null;
        this.loaded = false;
        this._config = null;
    }

    /**
     * Get the raw movie data
     */
    getRawData(): Uint8Array | null {
        return this.movieData;
    }
}

// Singleton instance for easy access
let defaultBridge: WasmBridge | null = null;

/**
 * Get the default WasmBridge instance
 */
export function getWasmBridge(): WasmBridge {
    if (!defaultBridge) {
        defaultBridge = new WasmBridge();
    }
    return defaultBridge;
}

/**
 * Initialize the default bridge
 */
export async function initWasmBridge(wasmPath?: string): Promise<WasmBridge> {
    const bridge = getWasmBridge();
    await bridge.init(wasmPath);
    return bridge;
}
