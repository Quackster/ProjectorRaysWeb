/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadStream } from "../parser/Stream";
import { Channel } from "./Channel";

/**
 * Transition types for frame transitions
 */
export const enum TransitionType {
    None = 0,
    WipeRight = 1,
    WipeLeft = 2,
    WipeDown = 3,
    WipeUp = 4,
    CenterOutHorizontal = 5,
    EdgesInHorizontal = 6,
    CenterOutVertical = 7,
    EdgesInVertical = 8,
    CenterOutSquare = 9,
    EdgesInSquare = 10,
    PushLeft = 11,
    PushRight = 12,
    PushDown = 13,
    PushUp = 14,
    RevealUp = 15,
    RevealUpRight = 16,
    RevealRight = 17,
    RevealDownRight = 18,
    RevealDown = 19,
    RevealDownLeft = 20,
    RevealLeft = 21,
    RevealUpLeft = 22,
    DissolvePixelsFast = 23,
    DissolveBoxyRects = 24,
    DissolveBoxySquares = 25,
    DissolvePatterns = 26,
    RandomRows = 27,
    RandomColumns = 28,
    CoverDown = 29,
    CoverDownLeft = 30,
    CoverDownRight = 31,
    CoverLeft = 32,
    CoverRight = 33,
    CoverUp = 34,
    CoverUpLeft = 35,
    CoverUpRight = 36,
    VenetianBlinds = 37,
    Checkerboard = 38,
    StripsBottomBuildLeft = 39,
    StripsBottomBuildRight = 40,
    StripsLeftBuildDown = 41,
    StripsLeftBuildUp = 42,
    StripsRightBuildDown = 43,
    StripsRightBuildUp = 44,
    StripsTopBuildLeft = 45,
    StripsTopBuildRight = 46,
    ZoomOpen = 47,
    ZoomClose = 48,
    VerticalBlinds = 49,
    DissolvePixels = 50,
    DissolvePixelsSlow = 51
}

/**
 * Cast member ID reference
 */
export class CastMemberRef {
    castLib: i16 = 0;
    member: i16 = 0;

    isEmpty(): bool {
        return this.member == 0;
    }

    read(stream: ReadStream, version: i32): void {
        if (version >= 500) {
            this.castLib = stream.readInt16();
            this.member = stream.readInt16();
        } else {
            this.castLib = 0;
            this.member = stream.readInt16();
        }
    }
}

/**
 * Frame - represents one frame in the score timeline
 * Contains all channel states for that moment in time
 */
export class Frame {
    frameNum: i32 = 0;

    // Timing
    tempo: i16 = 0;         // Frame rate (ticks per frame, 0 = movie default)
    tempoMode: u8 = 0;      // 0=normal, 1=wait, 2=waitForCuePoint, etc.

    // Transition effect
    transitionType: u8 = 0;
    transitionDuration: u8 = 0;
    transitionChunkSize: u8 = 0;
    transitionArea: u8 = 0; // 0=stage, 1=changedArea

    // Palette
    paletteId: i16 = -1;
    paletteSpeed: u8 = 0;
    paletteTransition: u8 = 0;
    paletteAutoReverse: bool = false;
    paletteCycles: u8 = 0;

    // Sound channels
    sound1: CastMemberRef = new CastMemberRef();
    sound2: CastMemberRef = new CastMemberRef();

    // Script (frame script / behavior)
    scriptId: i16 = 0;

    // Channels (sprite data)
    channels: Channel[] = [];

    /**
     * Read frame header and channel data
     */
    read(stream: ReadStream, version: i32, numChannels: i32, spriteRecordSize: i32): void {
        if (version >= 600) {
            this.readD6Frame(stream, numChannels, spriteRecordSize);
        } else if (version >= 500) {
            this.readD5Frame(stream, numChannels);
        } else {
            this.readD4Frame(stream, numChannels);
        }
    }

    /**
     * Read D6+ frame format
     */
    private readD6Frame(stream: ReadStream, numChannels: i32, spriteRecordSize: i32): void {
        // Frame header (main channels)
        // These are special system channels before sprite channels

        // Script channel (2 bytes)
        this.scriptId = stream.readInt16();

        // Tempo channel (4 bytes)
        this.tempo = stream.readInt16();
        this.tempoMode = stream.readUint8();
        stream.skip(1); // padding

        // Transition channel (4 bytes)
        this.transitionType = stream.readUint8();
        this.transitionDuration = stream.readUint8();
        this.transitionChunkSize = stream.readUint8();
        this.transitionArea = stream.readUint8();

        // Palette channel (6 bytes)
        this.paletteId = stream.readInt16();
        this.paletteSpeed = stream.readUint8();
        this.paletteTransition = stream.readUint8();
        this.paletteCycles = stream.readUint8();
        const paletteFlags = stream.readUint8();
        this.paletteAutoReverse = (paletteFlags & 0x01) != 0;

        // Sound 1 channel (4 bytes)
        this.sound1.castLib = stream.readInt16();
        this.sound1.member = stream.readInt16();

        // Sound 2 channel (4 bytes)
        this.sound2.castLib = stream.readInt16();
        this.sound2.member = stream.readInt16();

        // Reserved/padding to align sprite data
        stream.skip(6);

        // Read sprite channels
        this.channels = [];
        for (let i: i32 = 0; i < numChannels; i++) {
            const channel = new Channel();
            const startPos = stream.pos;
            channel.readD6(stream);
            // Ensure we read exactly spriteRecordSize bytes per channel
            const bytesRead = stream.pos - startPos;
            if (bytesRead < spriteRecordSize) {
                stream.skip(spriteRecordSize - bytesRead);
            }
            this.channels.push(channel);
        }
    }

    /**
     * Read D5 frame format
     */
    private readD5Frame(stream: ReadStream, numChannels: i32): void {
        // D5 has a simpler header
        this.scriptId = stream.readInt16();
        this.tempo = stream.readInt16();

        this.transitionType = stream.readUint8();
        this.transitionDuration = stream.readUint8();

        this.paletteId = stream.readInt16();

        this.sound1.member = stream.readInt16();
        this.sound2.member = stream.readInt16();

        // D5 sprite records are 20 bytes each
        this.channels = [];
        for (let i: i32 = 0; i < numChannels; i++) {
            const channel = new Channel();
            channel.readD5(stream);
            this.channels.push(channel);
        }
    }

    /**
     * Read D4 frame format
     */
    private readD4Frame(stream: ReadStream, numChannels: i32): void {
        // D4 has minimal header
        this.scriptId = stream.readInt16();
        this.tempo = stream.readInt16();

        this.transitionType = stream.readUint8();
        this.transitionDuration = stream.readUint8();

        this.sound1.member = stream.readInt16();
        this.sound2.member = stream.readInt16();

        // D4 sprite records are 16 bytes each
        this.channels = [];
        for (let i: i32 = 0; i < numChannels; i++) {
            const channel = new Channel();
            channel.readD4(stream);
            this.channels.push(channel);
        }
    }

    /**
     * Get a specific channel (1-indexed like Director)
     */
    getChannel(channelNum: i32): Channel | null {
        const idx = channelNum - 1;
        if (idx >= 0 && idx < this.channels.length) {
            return unchecked(this.channels[idx]);
        }
        return null;
    }

    /**
     * Get number of channels
     */
    getChannelCount(): i32 {
        return this.channels.length;
    }

    /**
     * Check if frame has transition
     */
    hasTransition(): bool {
        return this.transitionType != 0;
    }

    /**
     * Check if frame has script
     */
    hasScript(): bool {
        return this.scriptId != 0;
    }
}
