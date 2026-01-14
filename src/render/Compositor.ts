/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Stage } from './Stage.js';
import { ChannelInfo, FrameInfo } from '../bridge/WasmBridge.js';

/**
 * Ink types for sprite blending
 */
export enum InkType {
    Copy = 0,
    Transparent = 1,
    Reverse = 2,
    Ghost = 3,
    NotCopy = 4,
    NotTransparent = 5,
    NotReverse = 6,
    NotGhost = 7,
    Matte = 8,
    Mask = 9,
    Blend = 32,
    AddPin = 33,
    Add = 34,
    SubPin = 35,
    BackgroundTransparent = 36,
    Light = 37,
    Sub = 38,
    Dark = 39
}

/**
 * Sprite to render
 */
export interface Sprite {
    channel: ChannelInfo;
    bitmap?: ImageData;
    image?: HTMLImageElement | ImageBitmap;
}

/**
 * Compositor - Renders frames to the stage
 *
 * Handles:
 * - Sprite layering (back to front)
 * - Ink mode rendering
 * - Dirty rectangle optimization (future)
 */
export class Compositor {
    private stage: Stage;
    private sprites: Map<number, Sprite> = new Map();

    // Bitmap cache
    private bitmapCache: Map<string, ImageData> = new Map();

    constructor(stage: Stage) {
        this.stage = stage;
    }

    /**
     * Clear the compositor state
     */
    clear(): void {
        this.sprites.clear();
    }

    /**
     * Set a sprite for rendering
     */
    setSprite(channelNum: number, sprite: Sprite): void {
        this.sprites.set(channelNum, sprite);
    }

    /**
     * Remove a sprite
     */
    removeSprite(channelNum: number): void {
        this.sprites.delete(channelNum);
    }

    /**
     * Render all sprites to the stage
     */
    render(): void {
        const ctx = this.stage.getContext();

        // Clear stage
        this.stage.clear();

        // Sort sprites by channel number (lower channels render first = behind)
        const sortedChannels = Array.from(this.sprites.keys()).sort((a, b) => a - b);

        // Render each sprite
        for (const channelNum of sortedChannels) {
            const sprite = this.sprites.get(channelNum);
            if (sprite) {
                this.renderSprite(ctx, sprite);
            }
        }
    }

    /**
     * Render a single sprite
     */
    private renderSprite(ctx: CanvasRenderingContext2D, sprite: Sprite): void {
        const { channel } = sprite;

        // Skip invisible or empty sprites
        if (!channel.visible || channel.castMember <= 0) {
            return;
        }

        const x = channel.locH;
        const y = channel.locV;
        const ink = channel.ink as InkType;

        // If we have ImageData, use appropriate ink mode
        if (sprite.bitmap) {
            this.blitWithInk(ctx, sprite.bitmap, x, y, ink, channel.blend);
        }
        // If we have an Image/ImageBitmap
        else if (sprite.image) {
            // For now, just use basic draw
            ctx.globalAlpha = channel.blend / 100;
            ctx.drawImage(sprite.image, x, y, channel.width, channel.height);
            ctx.globalAlpha = 1;
        }
        // Placeholder - draw a colored rectangle
        else {
            this.drawPlaceholder(ctx, channel);
        }
    }

    /**
     * Draw a placeholder for missing bitmaps
     */
    private drawPlaceholder(ctx: CanvasRenderingContext2D, channel: ChannelInfo): void {
        // Generate a color based on cast member ID
        const hue = (channel.castMember * 47) % 360;
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.5)`;

        ctx.fillRect(
            channel.locH,
            channel.locV,
            channel.width || 50,
            channel.height || 50
        );

        // Draw border
        ctx.strokeStyle = `hsl(${hue}, 70%, 30%)`;
        ctx.strokeRect(
            channel.locH,
            channel.locV,
            channel.width || 50,
            channel.height || 50
        );

        // Draw channel number
        ctx.fillStyle = '#000';
        ctx.font = '10px sans-serif';
        ctx.fillText(
            `CH${channel.channelNum}`,
            channel.locH + 2,
            channel.locV + 12
        );
    }

    /**
     * Blit ImageData with ink mode
     */
    private blitWithInk(
        ctx: CanvasRenderingContext2D,
        src: ImageData,
        dx: number,
        dy: number,
        ink: InkType,
        blend: number
    ): void {
        switch (ink) {
            case InkType.Copy:
                ctx.putImageData(src, dx, dy);
                break;

            case InkType.Transparent:
                this.blitTransparent(ctx, src, dx, dy);
                break;

            case InkType.Matte:
                this.blitMatte(ctx, src, dx, dy);
                break;

            case InkType.Blend:
                this.blitBlend(ctx, src, dx, dy, blend / 100);
                break;

            case InkType.BackgroundTransparent:
                this.blitBackgroundTransparent(ctx, src, dx, dy);
                break;

            default:
                // Fallback to copy for unsupported ink modes
                ctx.putImageData(src, dx, dy);
                break;
        }
    }

    /**
     * Transparent ink - white pixels are transparent
     */
    private blitTransparent(
        ctx: CanvasRenderingContext2D,
        src: ImageData,
        dx: number,
        dy: number
    ): void {
        // Get destination pixels
        const dest = ctx.getImageData(dx, dy, src.width, src.height);

        for (let i = 0; i < src.data.length; i += 4) {
            const r = src.data[i];
            const g = src.data[i + 1];
            const b = src.data[i + 2];

            // Skip white pixels (transparent)
            if (r === 255 && g === 255 && b === 255) {
                continue;
            }

            dest.data[i] = r;
            dest.data[i + 1] = g;
            dest.data[i + 2] = b;
            dest.data[i + 3] = 255;
        }

        ctx.putImageData(dest, dx, dy);
    }

    /**
     * Matte ink - use alpha channel
     */
    private blitMatte(
        ctx: CanvasRenderingContext2D,
        src: ImageData,
        dx: number,
        dy: number
    ): void {
        // Create a temporary canvas for alpha compositing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = src.width;
        tempCanvas.height = src.height;
        const tempCtx = tempCanvas.getContext('2d')!;

        tempCtx.putImageData(src, 0, 0);
        ctx.drawImage(tempCanvas, dx, dy);
    }

    /**
     * Blend ink - alpha blending with blend percentage
     */
    private blitBlend(
        ctx: CanvasRenderingContext2D,
        src: ImageData,
        dx: number,
        dy: number,
        alpha: number
    ): void {
        // Get destination pixels
        const dest = ctx.getImageData(dx, dy, src.width, src.height);

        for (let i = 0; i < src.data.length; i += 4) {
            const srcR = src.data[i];
            const srcG = src.data[i + 1];
            const srcB = src.data[i + 2];
            const srcA = src.data[i + 3] / 255;

            const dstR = dest.data[i];
            const dstG = dest.data[i + 1];
            const dstB = dest.data[i + 2];

            const a = srcA * alpha;

            dest.data[i] = Math.round(srcR * a + dstR * (1 - a));
            dest.data[i + 1] = Math.round(srcG * a + dstG * (1 - a));
            dest.data[i + 2] = Math.round(srcB * a + dstB * (1 - a));
            dest.data[i + 3] = 255;
        }

        ctx.putImageData(dest, dx, dy);
    }

    /**
     * Background transparent - first pixel color is transparent
     */
    private blitBackgroundTransparent(
        ctx: CanvasRenderingContext2D,
        src: ImageData,
        dx: number,
        dy: number
    ): void {
        // Get background color from first pixel
        const bgR = src.data[0];
        const bgG = src.data[1];
        const bgB = src.data[2];

        const dest = ctx.getImageData(dx, dy, src.width, src.height);

        for (let i = 0; i < src.data.length; i += 4) {
            const r = src.data[i];
            const g = src.data[i + 1];
            const b = src.data[i + 2];

            // Skip background color pixels
            if (r === bgR && g === bgG && b === bgB) {
                continue;
            }

            dest.data[i] = r;
            dest.data[i + 1] = g;
            dest.data[i + 2] = b;
            dest.data[i + 3] = 255;
        }

        ctx.putImageData(dest, dx, dy);
    }

    /**
     * Render a frame
     */
    renderFrame(frame: FrameInfo, getBitmap: (castLib: number, castMember: number) => ImageData | null): void {
        this.clear();

        for (const channel of frame.channels) {
            if (channel.castMember > 0 && channel.visible) {
                const bitmap = getBitmap(channel.castLib, channel.castMember);
                this.setSprite(channel.channelNum, {
                    channel,
                    bitmap: bitmap || undefined
                });
            }
        }

        this.render();
    }
}
