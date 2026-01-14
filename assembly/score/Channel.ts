/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadStream } from "../parser/Stream";

/**
 * Ink types for sprite rendering
 */
export const enum InkType {
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
 * Sprite types
 */
export const enum SpriteType {
    Inactive = 0,
    Bitmap = 1,
    Rectangle = 2,
    RoundedRectangle = 3,
    Oval = 4,
    LineTopBottom = 5,
    LineBottomTop = 6,
    Text = 7,
    Button = 8,
    Checkbox = 9,
    RadioButton = 10,
    Pict = 11,
    OutlinedRectangle = 12,
    OutlinedRoundedRectangle = 13,
    OutlinedOval = 14,
    ThickLine = 15,
    CastMember = 16,
    FilmLoop = 17,
    DirMovie = 18
}

/**
 * Channel flags
 */
export const enum ChannelFlags {
    Visible = 0x01,
    Puppet = 0x02,
    Moveable = 0x04,
    Editable = 0x08,
    Trails = 0x10,
    Stretch = 0x20
}

/**
 * Channel data - represents a sprite slot in a frame
 * Each frame has multiple channels (typically 48-1000+)
 */
export class Channel {
    // Cast member reference
    castLib: i16 = 0;
    castMember: i16 = 0;

    // Position and size
    locH: i16 = 0;
    locV: i16 = 0;
    width: i16 = 0;
    height: i16 = 0;

    // Visual properties
    spriteType: u8 = 0;
    ink: u8 = 0;
    blend: u8 = 100;
    foreColor: u8 = 0;
    backColor: u8 = 255;

    // Behavior
    scriptId: i16 = 0;
    flags: u8 = <u8>ChannelFlags.Visible;

    // Tweening/motion (D6+)
    startPoint: i16 = 0;
    endPoint: i16 = 0;
    tweenPath: i16 = 0;

    // Constraint
    constraint: i16 = 0;

    /**
     * Check if channel has content
     */
    isEmpty(): bool {
        return this.castMember == 0 && this.spriteType == 0;
    }

    /**
     * Check if channel is visible
     */
    isVisible(): bool {
        return (this.flags & ChannelFlags.Visible) != 0;
    }

    /**
     * Check if channel is puppeted
     */
    isPuppet(): bool {
        return (this.flags & ChannelFlags.Puppet) != 0;
    }

    /**
     * Check if channel is moveable
     */
    isMoveable(): bool {
        return (this.flags & ChannelFlags.Moveable) != 0;
    }

    /**
     * Read channel data from stream (D6+ format)
     * Record size varies by Director version
     */
    readD6(stream: ReadStream): void {
        // D6 sprite record is typically 48 bytes per channel
        this.scriptId = stream.readInt16();
        this.spriteType = stream.readUint8();
        this.ink = stream.readUint8();

        this.castLib = stream.readInt16();
        this.castMember = stream.readInt16();

        this.foreColor = stream.readUint8();
        this.backColor = stream.readUint8();

        this.locV = stream.readInt16();
        this.locH = stream.readInt16();
        this.height = stream.readInt16();
        this.width = stream.readInt16();

        this.blend = stream.readUint8();
        this.flags = stream.readUint8();

        // Extended properties (D6+)
        stream.skip(2); // padding/reserved

        this.constraint = stream.readInt16();

        // Skip remaining bytes to complete the record
        stream.skip(26); // Additional D6 properties we're not using yet
    }

    /**
     * Read channel data from stream (D5 format)
     */
    readD5(stream: ReadStream): void {
        // D5 has smaller sprite records
        this.scriptId = stream.readInt16();
        this.spriteType = stream.readUint8();
        this.ink = stream.readUint8();

        this.castMember = stream.readInt16();
        this.castLib = 0; // D5 doesn't have multiple cast libraries

        this.locV = stream.readInt16();
        this.locH = stream.readInt16();
        this.height = stream.readInt16();
        this.width = stream.readInt16();

        this.foreColor = stream.readUint8();
        this.backColor = stream.readUint8();
        this.blend = 100; // Default blend

        this.flags = <u8>ChannelFlags.Visible;
    }

    /**
     * Read channel data from stream (D4 format)
     */
    readD4(stream: ReadStream): void {
        // D4 format - even simpler
        this.scriptId = stream.readInt16();
        this.spriteType = stream.readUint8();

        const inkAndCast = stream.readUint8();
        this.ink = inkAndCast & 0x3F;

        this.castMember = stream.readInt16();
        this.castLib = 0;

        this.locV = stream.readInt16();
        this.locH = stream.readInt16();
        this.height = stream.readInt16();
        this.width = stream.readInt16();

        this.foreColor = 0;
        this.backColor = 255;
        this.blend = 100;
        this.flags = <u8>ChannelFlags.Visible;
    }

    /**
     * Clone this channel
     */
    clone(): Channel {
        const c = new Channel();
        c.castLib = this.castLib;
        c.castMember = this.castMember;
        c.locH = this.locH;
        c.locV = this.locV;
        c.width = this.width;
        c.height = this.height;
        c.spriteType = this.spriteType;
        c.ink = this.ink;
        c.blend = this.blend;
        c.foreColor = this.foreColor;
        c.backColor = this.backColor;
        c.scriptId = this.scriptId;
        c.flags = this.flags;
        c.startPoint = this.startPoint;
        c.endPoint = this.endPoint;
        c.tweenPath = this.tweenPath;
        c.constraint = this.constraint;
        return c;
    }
}
