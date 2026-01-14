/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadStream } from "./Stream";

/**
 * CastListEntry - Entry in the cast list (MCsL chunk)
 */
export class CastListEntry {
    name: string = "";
    filePath: string = "";
    preloadSettings: u16 = 0;
    minMember: u16 = 0;
    maxMember: u16 = 0;
    id: i32 = 0;
}

/**
 * MemoryMapEntry - Entry in the memory map (mmap chunk)
 */
export class MemoryMapEntry {
    fourCC: u32 = 0;
    len: u32 = 0;
    offset: u32 = 0;
    flags: i16 = 0;
    unknown0: i16 = 0;
    next: i32 = 0;

    read(stream: ReadStream): void {
        this.fourCC = stream.readUint32();
        this.len = stream.readUint32();
        this.offset = stream.readUint32();
        this.flags = stream.readInt16();
        this.unknown0 = stream.readInt16();
        this.next = stream.readInt32();
    }
}

/**
 * KeyTableEntry - Entry in the key table (KEY* chunk)
 */
export class KeyTableEntry {
    sectionID: i32 = 0;
    castID: i32 = 0;
    fourCC: u32 = 0;

    read(stream: ReadStream): void {
        this.sectionID = stream.readInt32();
        this.castID = stream.readInt32();
        this.fourCC = stream.readUint32();
    }
}

/**
 * MoaID - GUID-like identifier for compression types
 */
export class MoaID {
    data1: u32;
    data2: u16;
    data3: u16;
    data4: StaticArray<u8>;

    constructor(
        d1: u32 = 0, d2: u16 = 0, d3: u16 = 0,
        d40: u8 = 0, d41: u8 = 0, d42: u8 = 0, d43: u8 = 0,
        d44: u8 = 0, d45: u8 = 0, d46: u8 = 0, d47: u8 = 0
    ) {
        this.data1 = d1;
        this.data2 = d2;
        this.data3 = d3;
        this.data4 = new StaticArray<u8>(8);
        unchecked(this.data4[0] = d40);
        unchecked(this.data4[1] = d41);
        unchecked(this.data4[2] = d42);
        unchecked(this.data4[3] = d43);
        unchecked(this.data4[4] = d44);
        unchecked(this.data4[5] = d45);
        unchecked(this.data4[6] = d46);
        unchecked(this.data4[7] = d47);
    }

    read(stream: ReadStream): void {
        this.data1 = stream.readUint32();
        this.data2 = stream.readUint16();
        this.data3 = stream.readUint16();
        for (let i: i32 = 0; i < 8; i++) {
            unchecked(this.data4[i] = stream.readUint8());
        }
    }

    equals(other: MoaID): bool {
        if (this.data1 !== other.data1) return false;
        if (this.data2 !== other.data2) return false;
        if (this.data3 !== other.data3) return false;
        for (let i: i32 = 0; i < 8; i++) {
            if (unchecked(this.data4[i]) !== unchecked(other.data4[i])) return false;
        }
        return true;
    }
}

// Compression GUIDs
export const NULL_COMPRESSION_GUID = new MoaID(
    0xAC99982E, 0x005D, 0x0D50,
    0x00, 0x00, 0x08, 0x00, 0x07, 0x37, 0x7A, 0x34
);

export const ZLIB_COMPRESSION_GUID = new MoaID(
    0xAC99E904, 0x0070, 0x0B36,
    0x00, 0x00, 0x08, 0x00, 0x07, 0x37, 0x7A, 0x34
);

export const SND_COMPRESSION_GUID = new MoaID(
    0x7204A889, 0xAFD0, 0x11CF,
    0xA2, 0x22, 0x00, 0xA0, 0x24, 0x53, 0x44, 0x4C
);

/**
 * ChunkInfo - Information about a chunk in the file
 */
export class ChunkInfo {
    id: i32 = 0;
    fourCC: u32 = 0;
    len: u32 = 0;
    uncompressedLen: u32 = 0;
    offset: u32 = 0;
    compressionID: MoaID = new MoaID();
}
