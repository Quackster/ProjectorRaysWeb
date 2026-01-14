/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadStream } from "../parser/Stream";
import { Frame } from "./Frame";
import { Channel } from "./Channel";

/**
 * Label entry - named marker in the score
 */
export class Label {
    name: string = "";
    frameNum: i32 = 0;
}

/**
 * Score - The timeline containing all frames and channels
 *
 * The Score is the heart of Director's playback. It defines:
 * - How many frames in the movie
 * - How many sprite channels
 * - The state of each channel at each frame
 * - Labels for navigation
 *
 * Parsed from VWSC chunk.
 */
export class Score {
    // Score metadata
    version: i32 = 0;
    numChannels: i32 = 48;  // Default D4 channels
    numFrames: i32 = 0;
    spriteRecordSize: i32 = 48;  // Bytes per sprite per frame

    // Frames array
    frames: Frame[] = [];

    // Labels for "go to" navigation
    labels: Label[] = [];

    // Error tracking
    lastError: string = "";

    /**
     * Read the Score from a VWSC chunk
     */
    read(stream: ReadStream, dirVersion: i32): bool {
        this.version = dirVersion;

        if (dirVersion >= 600) {
            return this.readD6Score(stream);
        } else if (dirVersion >= 500) {
            return this.readD5Score(stream);
        } else {
            return this.readD4Score(stream);
        }
    }

    /**
     * Read D6+ Score format (VWSC chunk)
     */
    private readD6Score(stream: ReadStream): bool {
        // VWSC Header
        const totalLength = stream.readUint32();
        const headerLength = stream.readUint32();

        // Read header fields
        if (headerLength >= 12) {
            const scoreVersion = stream.readInt32();
            this.spriteRecordSize = stream.readInt32();
            this.numChannels = stream.readInt32();
        }

        if (headerLength >= 16) {
            this.numFrames = stream.readInt32();
        }

        // Skip any extra header bytes
        const headerBytesRead: i32 = 16;
        if (<i32>headerLength > headerBytesRead) {
            stream.skip(<i32>headerLength - headerBytesRead);
        }

        // Read frame offset table
        const frameOffsets: u32[] = [];
        for (let i: i32 = 0; i < this.numFrames; i++) {
            frameOffsets.push(stream.readUint32());
        }

        // Calculate frame data size
        // Each frame has header + (numChannels * spriteRecordSize)
        const frameHeaderSize: i32 = 32; // Approximate header size

        // Read each frame
        this.frames = [];
        for (let i: i32 = 0; i < this.numFrames; i++) {
            const frame = new Frame();
            frame.frameNum = i + 1; // Director uses 1-based frame numbers
            frame.read(stream, this.version, this.numChannels, this.spriteRecordSize);
            this.frames.push(frame);
        }

        return true;
    }

    /**
     * Read D5 Score format
     */
    private readD5Score(stream: ReadStream): bool {
        // D5 has a simpler header
        const totalLength = stream.readUint32();

        // D5 typically has 48 channels
        this.numChannels = 48;
        this.spriteRecordSize = 20;

        // Calculate frame count from data size
        const frameDataSize = this.numChannels * this.spriteRecordSize + 12; // header + channels
        this.numFrames = (<i32>totalLength - 4) / frameDataSize;

        // Read frames
        this.frames = [];
        for (let i: i32 = 0; i < this.numFrames; i++) {
            const frame = new Frame();
            frame.frameNum = i + 1;
            frame.read(stream, this.version, this.numChannels, this.spriteRecordSize);
            this.frames.push(frame);
        }

        return true;
    }

    /**
     * Read D4 Score format
     */
    private readD4Score(stream: ReadStream): bool {
        // D4 has simpler structure
        const totalLength = stream.readUint32();

        // D4 has 48 channels, 16 bytes per sprite
        this.numChannels = 48;
        this.spriteRecordSize = 16;

        const frameDataSize = this.numChannels * this.spriteRecordSize + 10;
        this.numFrames = (<i32>totalLength - 4) / frameDataSize;

        this.frames = [];
        for (let i: i32 = 0; i < this.numFrames; i++) {
            const frame = new Frame();
            frame.frameNum = i + 1;
            frame.read(stream, this.version, this.numChannels, this.spriteRecordSize);
            this.frames.push(frame);
        }

        return true;
    }

    /**
     * Read labels from VWLB chunk
     */
    readLabels(stream: ReadStream): void {
        const count = stream.readUint16();
        this.labels = [];

        for (let i: i32 = 0; i < <i32>count; i++) {
            const label = new Label();
            label.frameNum = stream.readInt32();
            const nameLen = stream.readUint8();
            label.name = stream.readString(nameLen);
            this.labels.push(label);
        }
    }

    /**
     * Get a frame by number (1-indexed like Director)
     */
    getFrame(frameNum: i32): Frame | null {
        const idx = frameNum - 1;
        if (idx >= 0 && idx < this.frames.length) {
            return unchecked(this.frames[idx]);
        }
        return null;
    }

    /**
     * Get frame count
     */
    getFrameCount(): i32 {
        return this.frames.length;
    }

    /**
     * Get channel count
     */
    getChannelCount(): i32 {
        return this.numChannels;
    }

    /**
     * Find frame number by label name
     */
    findLabel(name: string): i32 {
        for (let i: i32 = 0; i < this.labels.length; i++) {
            if (unchecked(this.labels[i]).name == name) {
                return unchecked(this.labels[i]).frameNum;
            }
        }
        return -1;
    }

    /**
     * Get label at frame
     */
    getLabelAt(frameNum: i32): string {
        for (let i: i32 = 0; i < this.labels.length; i++) {
            if (unchecked(this.labels[i]).frameNum == frameNum) {
                return unchecked(this.labels[i]).name;
            }
        }
        return "";
    }

    /**
     * Get all non-empty channels at a frame
     */
    getActiveChannels(frameNum: i32): Channel[] {
        const result: Channel[] = [];
        const frame = this.getFrame(frameNum);
        if (frame === null) return result;

        for (let i: i32 = 0; i < frame.channels.length; i++) {
            const channel = unchecked(frame.channels[i]);
            if (!channel.isEmpty()) {
                result.push(channel);
            }
        }
        return result;
    }

    /**
     * Get sprite at specific channel and frame
     */
    getSprite(frameNum: i32, channelNum: i32): Channel | null {
        const frame = this.getFrame(frameNum);
        if (frame === null) return null;
        return frame.getChannel(channelNum);
    }
}
