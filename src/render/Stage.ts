/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Stage configuration options
 */
export interface StageOptions {
    width?: number;
    height?: number;
    backgroundColor?: string;
    container?: HTMLElement;
    scale?: 'none' | 'fit' | 'fill';
}

/**
 * Stage - Canvas management for Director playback
 *
 * Handles:
 * - Canvas creation and sizing
 * - Stage background color
 * - Coordinate system setup
 * - Scale/fit modes
 */
export class Stage {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private container: HTMLElement | null = null;

    // Stage dimensions (Director's coordinate space)
    private _width: number = 640;
    private _height: number = 480;

    // Background color
    private _backgroundColor: string = '#FFFFFF';

    // Scale mode
    private _scaleMode: 'none' | 'fit' | 'fill' = 'fit';

    constructor(options: StageOptions = {}) {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;

        // Apply options
        if (options.width) this._width = options.width;
        if (options.height) this._height = options.height;
        if (options.backgroundColor) this._backgroundColor = options.backgroundColor;
        if (options.scale) this._scaleMode = options.scale;

        // Set initial size
        this.setSize(this._width, this._height);

        // Attach to container if provided
        if (options.container) {
            this.attachTo(options.container);
        }
    }

    /**
     * Get the canvas element
     */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    /**
     * Get the 2D rendering context
     */
    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    /**
     * Set stage dimensions
     */
    setSize(width: number, height: number): void {
        this._width = width;
        this._height = height;

        // Set canvas dimensions
        this.canvas.width = width;
        this.canvas.height = height;

        // Update scaling if attached to container
        if (this.container) {
            this.updateScale();
        }

        // Clear with background color
        this.clear();
    }

    /**
     * Get stage width
     */
    get width(): number {
        return this._width;
    }

    /**
     * Get stage height
     */
    get height(): number {
        return this._height;
    }

    /**
     * Set background color
     */
    setBackgroundColor(color: string): void {
        this._backgroundColor = color;
    }

    /**
     * Get background color
     */
    get backgroundColor(): string {
        return this._backgroundColor;
    }

    /**
     * Clear the stage with background color
     */
    clear(): void {
        this.ctx.fillStyle = this._backgroundColor;
        this.ctx.fillRect(0, 0, this._width, this._height);
    }

    /**
     * Attach the canvas to a container element
     */
    attachTo(container: HTMLElement): void {
        this.container = container;

        // Remove any existing children
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Add canvas
        container.appendChild(this.canvas);

        // Update scaling
        this.updateScale();

        // Listen for resize
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * Detach from container
     */
    detach(): void {
        window.removeEventListener('resize', this.handleResize);

        if (this.container && this.canvas.parentElement === this.container) {
            this.container.removeChild(this.canvas);
        }
        this.container = null;

        // Reset canvas style
        this.canvas.style.width = '';
        this.canvas.style.height = '';
    }

    /**
     * Update scale to fit container
     */
    private updateScale(): void {
        if (!this.container) return;

        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;

        if (this._scaleMode === 'none') {
            // No scaling - use original size
            this.canvas.style.width = `${this._width}px`;
            this.canvas.style.height = `${this._height}px`;
        } else if (this._scaleMode === 'fit') {
            // Fit within container, maintaining aspect ratio
            const scaleX = containerWidth / this._width;
            const scaleY = containerHeight / this._height;
            const scale = Math.min(scaleX, scaleY);

            this.canvas.style.width = `${this._width * scale}px`;
            this.canvas.style.height = `${this._height * scale}px`;
        } else if (this._scaleMode === 'fill') {
            // Fill container, may crop
            const scaleX = containerWidth / this._width;
            const scaleY = containerHeight / this._height;
            const scale = Math.max(scaleX, scaleY);

            this.canvas.style.width = `${this._width * scale}px`;
            this.canvas.style.height = `${this._height * scale}px`;
        }

        // Center in container
        this.canvas.style.margin = 'auto';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '50%';
        this.canvas.style.left = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';
    }

    /**
     * Handle window resize
     */
    private handleResize = (): void => {
        this.updateScale();
    };

    /**
     * Draw an image at position
     */
    drawImage(
        image: CanvasImageSource,
        x: number,
        y: number,
        width?: number,
        height?: number
    ): void {
        if (width !== undefined && height !== undefined) {
            this.ctx.drawImage(image, x, y, width, height);
        } else {
            this.ctx.drawImage(image, x, y);
        }
    }

    /**
     * Draw ImageData at position
     */
    putImageData(imageData: ImageData, x: number, y: number): void {
        this.ctx.putImageData(imageData, x, y);
    }

    /**
     * Get ImageData from stage region
     */
    getImageData(x: number, y: number, width: number, height: number): ImageData {
        return this.ctx.getImageData(x, y, width, height);
    }

    /**
     * Convert stage coordinates to screen coordinates
     */
    stageToScreen(stageX: number, stageY: number): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this._width;
        const scaleY = rect.height / this._height;

        return {
            x: rect.left + stageX * scaleX,
            y: rect.top + stageY * scaleY
        };
    }

    /**
     * Convert screen coordinates to stage coordinates
     */
    screenToStage(screenX: number, screenY: number): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this._width / rect.width;
        const scaleY = this._height / rect.height;

        return {
            x: (screenX - rect.left) * scaleX,
            y: (screenY - rect.top) * scaleY
        };
    }

    /**
     * Set scale mode
     */
    setScaleMode(mode: 'none' | 'fit' | 'fill'): void {
        this._scaleMode = mode;
        this.updateScale();
    }
}
