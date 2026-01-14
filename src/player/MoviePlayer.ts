/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Stage } from '../render/Stage.js';
import { Compositor } from '../render/Compositor.js';
import { WasmBridge, FrameInfo, initWasmBridge } from '../bridge/index.js';

/**
 * Playback state
 */
export enum PlaybackState {
    Stopped = 'stopped',
    Playing = 'playing',
    Paused = 'paused'
}

/**
 * Player event types
 */
export interface PlayerEvents {
    load: () => void;
    play: () => void;
    pause: () => void;
    stop: () => void;
    frame: (frameNum: number) => void;
    error: (error: Error) => void;
}

/**
 * MoviePlayer - High-level Director movie player
 *
 * Usage:
 * ```typescript
 * const player = new MoviePlayer();
 * await player.init(document.getElementById('stage'));
 * await player.loadFile(movieBuffer);
 * player.play();
 * ```
 */
export class MoviePlayer {
    private bridge: WasmBridge | null = null;
    private stage: Stage | null = null;
    private compositor: Compositor | null = null;

    // Playback state
    private _state: PlaybackState = PlaybackState.Stopped;
    private _currentFrame: number = 1;
    private _frameRate: number = 15;

    // Animation
    private animationId: number = 0;
    private lastFrameTime: number = 0;

    // Event listeners
    private listeners: Partial<PlayerEvents> = {};

    /**
     * Initialize the player
     * @param container HTML element to render into
     * @param wasmPath Optional path to WASM file
     */
    async init(container: HTMLElement, wasmPath?: string): Promise<void> {
        // Initialize WASM bridge
        this.bridge = await initWasmBridge(wasmPath);

        // Create stage
        this.stage = new Stage({
            container,
            scale: 'fit'
        });

        // Create compositor
        this.compositor = new Compositor(this.stage);

        console.log('MoviePlayer initialized');
    }

    /**
     * Load a Director movie file
     * @param data Raw bytes of the movie file
     */
    async loadFile(data: Uint8Array): Promise<boolean> {
        if (!this.bridge) {
            throw new Error('Player not initialized');
        }

        // Stop any current playback
        this.stop();

        // Load through bridge
        const success = await this.bridge.loadMovie(data);

        if (success) {
            // Get movie config
            const config = this.bridge.getConfig();

            // Update stage size
            if (this.stage) {
                this.stage.setSize(config.stageWidth, config.stageHeight);
            }

            this._frameRate = config.frameRate || 15;
            this._currentFrame = 1;

            // Render first frame
            this.gotoFrame(1);

            // Emit load event
            this.emit('load');

            console.log(`Movie loaded: ${config.stageWidth}x${config.stageHeight}, ${config.frameCount} frames @ ${config.frameRate} fps`);
        }

        return success;
    }

    /**
     * Load from a File object
     */
    async loadFromFile(file: File): Promise<boolean> {
        const buffer = await file.arrayBuffer();
        return this.loadFile(new Uint8Array(buffer));
    }

    /**
     * Load from URL
     */
    async loadFromURL(url: string): Promise<boolean> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return this.loadFile(new Uint8Array(buffer));
    }

    /**
     * Start playback
     */
    play(): void {
        if (this._state === PlaybackState.Playing) return;

        this._state = PlaybackState.Playing;
        this.lastFrameTime = performance.now();
        this.scheduleNextFrame();

        this.emit('play');
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (this._state !== PlaybackState.Playing) return;

        this._state = PlaybackState.Paused;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }

        this.emit('pause');
    }

    /**
     * Stop playback and reset to frame 1
     */
    stop(): void {
        this._state = PlaybackState.Stopped;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }

        this._currentFrame = 1;
        this.emit('stop');
    }

    /**
     * Go to a specific frame
     */
    gotoFrame(frameNum: number): void {
        if (!this.bridge || !this.stage || !this.compositor) return;

        const frameCount = this.bridge.getFrameCount();
        if (frameNum < 1) frameNum = 1;
        if (frameCount > 0 && frameNum > frameCount) frameNum = frameCount;

        this._currentFrame = frameNum;

        // Get frame data
        const frame = this.bridge.getFrame(frameNum);
        if (frame) {
            // Render the frame
            this.compositor.renderFrame(frame, (castLib, castMember) => {
                // TODO: Get actual bitmap from WASM
                // For now, return null to use placeholders
                return null;
            });
        } else {
            // No frame data, just clear
            this.stage.clear();
        }

        this.emit('frame', frameNum);
    }

    /**
     * Go to next frame
     */
    nextFrame(): void {
        this.gotoFrame(this._currentFrame + 1);
    }

    /**
     * Go to previous frame
     */
    prevFrame(): void {
        this.gotoFrame(this._currentFrame - 1);
    }

    /**
     * Get current frame number
     */
    get currentFrame(): number {
        return this._currentFrame;
    }

    /**
     * Get playback state
     */
    get state(): PlaybackState {
        return this._state;
    }

    /**
     * Get frame rate
     */
    get frameRate(): number {
        return this._frameRate;
    }

    /**
     * Set frame rate
     */
    set frameRate(rate: number) {
        this._frameRate = Math.max(1, Math.min(120, rate));
    }

    /**
     * Get total frame count
     */
    get frameCount(): number {
        return this.bridge?.getFrameCount() ?? 0;
    }

    /**
     * Is movie loaded?
     */
    get isLoaded(): boolean {
        return this.bridge?.isLoaded() ?? false;
    }

    /**
     * Add event listener
     */
    on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
        this.listeners[event] = callback;
    }

    /**
     * Remove event listener
     */
    off<K extends keyof PlayerEvents>(event: K): void {
        delete this.listeners[event];
    }

    /**
     * Emit event
     */
    private emit<K extends keyof PlayerEvents>(event: K, ...args: any[]): void {
        const callback = this.listeners[event];
        if (callback) {
            (callback as (...args: any[]) => void)(...args);
        }
    }

    /**
     * Schedule next frame render
     */
    private scheduleNextFrame(): void {
        this.animationId = requestAnimationFrame(this.tick.bind(this));
    }

    /**
     * Animation tick
     */
    private tick(timestamp: number): void {
        if (this._state !== PlaybackState.Playing) return;

        const frameInterval = 1000 / this._frameRate;
        const elapsed = timestamp - this.lastFrameTime;

        if (elapsed >= frameInterval) {
            this.lastFrameTime = timestamp - (elapsed % frameInterval);

            // Advance frame
            this.nextFrame();

            // Loop back to beginning if at end
            const frameCount = this.frameCount;
            if (frameCount > 0 && this._currentFrame >= frameCount) {
                this._currentFrame = 1;
                this.gotoFrame(1);
            }
        }

        this.scheduleNextFrame();
    }

    /**
     * Get the stage
     */
    getStage(): Stage | null {
        return this.stage;
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.stop();

        if (this.stage) {
            this.stage.detach();
        }

        if (this.bridge) {
            this.bridge.unload();
        }

        this.stage = null;
        this.compositor = null;
        this.bridge = null;
    }
}
