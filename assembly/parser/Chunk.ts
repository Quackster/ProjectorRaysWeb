/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadStream } from "./Stream";
import { Endianness, CastType, ScriptType } from "./Enums";
import { MemoryMapEntry, KeyTableEntry, CastListEntry } from "./Subchunk";

/**
 * Convert internal Director version to human-readable version
 */
export function humanVersion(ver: i32): i32 {
    if (ver >= 1951) return 1200;
    if (ver >= 1922) return 1150;
    if (ver >= 1921) return 1100;
    if (ver >= 1851) return 1000;
    if (ver >= 1700) return 850;
    if (ver >= 1410) return 800;
    if (ver >= 1224) return 700;
    if (ver >= 1218) return 600;
    if (ver >= 1201) return 500;
    if (ver >= 1117) return 404;
    if (ver >= 1115) return 400;
    if (ver >= 1029) return 310;
    if (ver >= 1028) return 300;
    return 200;
}

/**
 * InitialMapChunk - Points to memory map (imap chunk)
 */
export class InitialMapChunk {
    version: u32 = 0;
    mmapOffset: u32 = 0;
    directorVersion: u32 = 0;
    unused1: u32 = 0;
    unused2: u32 = 0;
    unused3: u32 = 0;

    read(stream: ReadStream): void {
        this.version = stream.readUint32();
        this.mmapOffset = stream.readUint32();
        this.directorVersion = stream.readUint32();
        this.unused1 = stream.readUint32();
        this.unused2 = stream.readUint32();
        this.unused3 = stream.readUint32();
    }
}

/**
 * MemoryMapChunk - Memory map of all chunks (mmap chunk)
 */
export class MemoryMapChunk {
    headerLength: i16 = 0;
    entryLength: i16 = 0;
    chunkCountMax: i32 = 0;
    chunkCountUsed: i32 = 0;
    junkHead: i32 = 0;
    junkHead2: i32 = 0;
    freeHead: i32 = 0;
    mapArray: MemoryMapEntry[] = [];

    read(stream: ReadStream): void {
        this.headerLength = stream.readInt16();
        this.entryLength = stream.readInt16();
        this.chunkCountMax = stream.readInt32();
        this.chunkCountUsed = stream.readInt32();
        this.junkHead = stream.readInt32();
        this.junkHead2 = stream.readInt32();
        this.freeHead = stream.readInt32();

        this.mapArray = [];
        for (let i: i32 = 0; i < this.chunkCountUsed; i++) {
            const entry = new MemoryMapEntry();
            entry.read(stream);
            this.mapArray.push(entry);
        }
    }
}

/**
 * KeyTableChunk - Maps chunk IDs to cast IDs (KEY* chunk)
 */
export class KeyTableChunk {
    entrySize: u16 = 0;
    entrySize2: u16 = 0;
    entryCount: u32 = 0;
    usedCount: u32 = 0;
    entries: KeyTableEntry[] = [];

    read(stream: ReadStream): void {
        this.entrySize = stream.readUint16();
        this.entrySize2 = stream.readUint16();
        this.entryCount = stream.readUint32();
        this.usedCount = stream.readUint32();

        this.entries = [];
        for (let i: u32 = 0; i < this.entryCount; i++) {
            const entry = new KeyTableEntry();
            entry.read(stream);
            this.entries.push(entry);
        }
    }
}

/**
 * ConfigChunk - Movie configuration (DRCF/VWCF chunk)
 */
export class ConfigChunk {
    len: i16 = 0;
    fileVersion: i16 = 0;
    movieTop: i16 = 0;
    movieLeft: i16 = 0;
    movieBottom: i16 = 0;
    movieRight: i16 = 0;
    minMember: i16 = 0;
    maxMember: i16 = 0;
    field9: i8 = 0;
    field10: i8 = 0;

    // Pre-D7 field or D7 stage color components
    preD7field11: i16 = 0;
    D7stageColorG: u8 = 0;
    D7stageColorB: u8 = 0;

    commentFont: i16 = 0;
    commentSize: i16 = 0;
    commentStyle: u16 = 0;

    // Pre-D7 stage color or D7 RGB components
    preD7stageColor: i16 = 0;
    D7stageColorIsRGB: u8 = 0;
    D7stageColorR: u8 = 0;

    bitDepth: i16 = 0;
    field17: u8 = 0;
    field18: u8 = 0;
    field19: i32 = 0;
    directorVersion: i16 = 0;
    field21: i16 = 0;
    field22: i32 = 0;
    field23: i32 = 0;
    field24: i32 = 0;
    field25: i8 = 0;
    field26: u8 = 0;
    frameRate: i16 = 0;
    platform: i16 = 0;
    protection: i16 = 0;
    field29: i32 = 0;
    checksum: u32 = 0;

    read(stream: ReadStream): void {
        stream.endianness = Endianness.BigEndian;

        // Read director version first to determine format
        stream.seek(36);
        this.directorVersion = stream.readInt16();
        const ver = humanVersion(this.directorVersion);

        stream.seek(0);
        this.len = stream.readInt16();
        this.fileVersion = stream.readInt16();
        this.movieTop = stream.readInt16();
        this.movieLeft = stream.readInt16();
        this.movieBottom = stream.readInt16();
        this.movieRight = stream.readInt16();
        this.minMember = stream.readInt16();
        this.maxMember = stream.readInt16();
        this.field9 = stream.readInt8();
        this.field10 = stream.readInt8();

        if (ver < 700) {
            this.preD7field11 = stream.readInt16();
        } else {
            this.D7stageColorG = stream.readUint8();
            this.D7stageColorB = stream.readUint8();
        }

        this.commentFont = stream.readInt16();
        this.commentSize = stream.readInt16();
        this.commentStyle = stream.readUint16();

        if (ver < 700) {
            this.preD7stageColor = stream.readInt16();
        } else {
            this.D7stageColorIsRGB = stream.readUint8();
            this.D7stageColorR = stream.readUint8();
        }

        this.bitDepth = stream.readInt16();
        this.field17 = stream.readUint8();
        this.field18 = stream.readUint8();
        this.field19 = stream.readInt32();
        stream.readInt16(); // directorVersion already read
        this.field21 = stream.readInt16();
        this.field22 = stream.readInt32();
        this.field23 = stream.readInt32();
        this.field24 = stream.readInt32();
        this.field25 = stream.readInt8();
        this.field26 = stream.readUint8();
        this.frameRate = stream.readInt16();
        this.platform = stream.readInt16();
        this.protection = stream.readInt16();
        this.field29 = stream.readInt32();
        this.checksum = stream.readUint32();
    }

    get stageWidth(): i32 {
        return <i32>(this.movieRight - this.movieLeft);
    }

    get stageHeight(): i32 {
        return <i32>(this.movieBottom - this.movieTop);
    }

    unprotect(): void {
        this.fileVersion = this.directorVersion;
        if (this.protection % 23 === 0) {
            this.protection += 1;
        }
    }
}

/**
 * CastInfoChunk - Info about a cast member
 */
export class CastInfoChunk {
    dataOffset: u32 = 0;
    unk1: u32 = 0;
    unk2: u32 = 0;
    flags: u32 = 0;
    scriptId: u32 = 0;
    scriptSrcText: string = "";
    name: string = "";

    // Offset table for list data
    offsetTableLen: u16 = 0;
    offsetTable: u32[] = [];
    itemsLen: u32 = 0;
    items: Uint8Array[] = [];

    read(stream: ReadStream): void {
        // Read header
        this.dataOffset = stream.readUint32();
        this.unk1 = stream.readUint32();
        this.unk2 = stream.readUint32();
        this.flags = stream.readUint32();
        this.scriptId = stream.readUint32();

        // Read offset table
        stream.seek(<i32>this.dataOffset);
        this.offsetTableLen = stream.readUint16();
        this.offsetTable = [];
        for (let i: u16 = 0; i < this.offsetTableLen; i++) {
            this.offsetTable.push(stream.readUint32());
        }

        // Read items
        this.itemsLen = stream.readUint32();
        const listOffset = stream.pos;

        this.items = [];
        for (let i: u16 = 0; i < this.offsetTableLen; i++) {
            const offset = unchecked(this.offsetTable[<i32>i]);
            const nextOffset = (i === this.offsetTableLen - 1)
                ? this.itemsLen
                : unchecked(this.offsetTable[<i32>i + 1]);
            stream.seek(listOffset + <i32>offset);
            const len = <i32>(nextOffset - offset);
            this.items.push(stream.readBytes(len));
        }

        // Parse script text and name from items
        if (this.items.length > 0) {
            this.scriptSrcText = this.readStringFromItem(0);
        }
        if (this.items.length > 1) {
            this.name = this.readPascalStringFromItem(1);
        }
    }

    private readStringFromItem(index: i32): string {
        if (index >= this.items.length) return "";
        const item = unchecked(this.items[index]);
        let result = "";
        for (let i: i32 = 0; i < item.length; i++) {
            result += String.fromCharCode(<i32>unchecked(item[i]));
        }
        return result;
    }

    private readPascalStringFromItem(index: i32): string {
        if (index >= this.items.length) return "";
        const item = unchecked(this.items[index]);
        if (item.length === 0) return "";
        const len = <i32>unchecked(item[0]);
        let result = "";
        for (let i: i32 = 1; i <= len && i < item.length; i++) {
            result += String.fromCharCode(<i32>unchecked(item[i]));
        }
        return result;
    }
}

/**
 * CastMemberChunk - A single cast member (CASt chunk)
 */
export class CastMemberChunk {
    type: u32 = 0;  // CastType
    infoLen: u32 = 0;
    specificDataLen: u32 = 0;
    info: CastInfoChunk | null = null;
    specificData: Uint8Array | null = null;
    hasFlags1: bool = false;
    flags1: u8 = 0;
    id: i32 = 0;
    castSectionID: i32 = 0;
    castLibID: i32 = 0;
    scriptType: u16 = 0;

    read(stream: ReadStream, version: i32): void {
        stream.endianness = Endianness.BigEndian;

        if (version >= 500) {
            this.type = stream.readUint32();
            this.infoLen = stream.readUint32();
            this.specificDataLen = stream.readUint32();

            // Info
            if (this.infoLen > 0) {
                const infoData = stream.readBytes(<i32>this.infoLen);
                const infoStream = new ReadStream(infoData, stream.endianness);
                this.info = new CastInfoChunk();
                this.info.read(infoStream);
            }

            // Specific data
            this.hasFlags1 = false;
            if (this.specificDataLen > 0) {
                this.specificData = stream.readBytes(<i32>this.specificDataLen);
            }
        } else {
            this.specificDataLen = <u32>stream.readUint16();
            this.infoLen = stream.readUint32();

            // Type is in specific data for older versions
            let specificDataLeft = <i32>this.specificDataLen;
            this.type = <u32>stream.readUint8();
            specificDataLeft -= 1;

            if (specificDataLeft > 0) {
                this.hasFlags1 = true;
                this.flags1 = stream.readUint8();
                specificDataLeft -= 1;
            } else {
                this.hasFlags1 = false;
            }

            // Specific data
            if (specificDataLeft > 0) {
                this.specificData = stream.readBytes(specificDataLeft);
            }

            // Info
            if (this.infoLen > 0) {
                const infoData = stream.readBytes(<i32>this.infoLen);
                const infoStream = new ReadStream(infoData, stream.endianness);
                this.info = new CastInfoChunk();
                this.info.read(infoStream);
            }
        }

        // Parse script member specific data
        if (this.type === <u32>CastType.kCastTypeScript && this.specificData !== null) {
            const specificStream = new ReadStream(this.specificData!, stream.endianness);
            if (specificStream.size >= 2) {
                this.scriptType = specificStream.readUint16();
            }
        }
    }

    getScriptID(): u32 {
        if (this.info !== null) {
            return this.info!.scriptId;
        }
        return 0;
    }

    getScriptText(): string {
        if (this.info !== null) {
            return this.info!.scriptSrcText;
        }
        return "";
    }

    getName(): string {
        if (this.info !== null) {
            return this.info!.name;
        }
        return "";
    }
}

/**
 * CastChunk - Contains cast member IDs (CAS* chunk)
 */
export class CastChunk {
    memberIDs: i32[] = [];
    name: string = "";
    id: i32 = 0;
    minMember: i32 = 0;

    read(stream: ReadStream): void {
        stream.endianness = Endianness.BigEndian;
        this.memberIDs = [];
        while (!stream.eof()) {
            const id = stream.readInt32();
            this.memberIDs.push(id);
        }
    }

    populate(castName: string, castId: i32, minMember: i32): void {
        this.name = castName;
        this.id = castId;
        this.minMember = minMember;
    }
}

/**
 * CastListChunk - List of cast libraries (MCsL chunk)
 */
export class CastListChunk {
    dataOffset: u32 = 0;
    unk0: u16 = 0;
    castCount: u16 = 0;
    itemsPerCast: u16 = 0;
    unk1: u16 = 0;
    entries: CastListEntry[] = [];

    // List data
    offsetTableLen: u16 = 0;
    offsetTable: u32[] = [];
    itemsLen: u32 = 0;
    items: Uint8Array[] = [];
    itemEndianness: Endianness = Endianness.BigEndian;

    read(stream: ReadStream): void {
        stream.endianness = Endianness.BigEndian;
        this.itemEndianness = stream.endianness;

        // Read header
        this.dataOffset = stream.readUint32();
        this.unk0 = stream.readUint16();
        this.castCount = stream.readUint16();
        this.itemsPerCast = stream.readUint16();
        this.unk1 = stream.readUint16();

        // Read offset table
        stream.seek(<i32>this.dataOffset);
        this.offsetTableLen = stream.readUint16();
        this.offsetTable = [];
        for (let i: u16 = 0; i < this.offsetTableLen; i++) {
            this.offsetTable.push(stream.readUint32());
        }

        // Read items
        this.itemsLen = stream.readUint32();
        const listOffset = stream.pos;

        this.items = [];
        for (let i: u16 = 0; i < this.offsetTableLen; i++) {
            const offset = unchecked(this.offsetTable[<i32>i]);
            const nextOffset = (i === this.offsetTableLen - 1)
                ? this.itemsLen
                : unchecked(this.offsetTable[<i32>i + 1]);
            stream.seek(listOffset + <i32>offset);
            const len = <i32>(nextOffset - offset);
            this.items.push(stream.readBytes(len));
        }

        // Parse cast entries
        this.entries = [];
        for (let i: u16 = 0; i < this.castCount; i++) {
            const entry = new CastListEntry();
            const baseIndex = <i32>i * <i32>this.itemsPerCast;

            if (this.itemsPerCast >= 1) {
                entry.name = this.readPascalStringFromItem(baseIndex + 1);
            }
            if (this.itemsPerCast >= 2) {
                entry.filePath = this.readPascalStringFromItem(baseIndex + 2);
            }
            if (this.itemsPerCast >= 3) {
                entry.preloadSettings = this.readUint16FromItem(baseIndex + 3);
            }
            if (this.itemsPerCast >= 4 && baseIndex + 4 < this.items.length) {
                const item = unchecked(this.items[baseIndex + 4]);
                if (item.length >= 8) {
                    const itemStream = new ReadStream(item, this.itemEndianness);
                    entry.minMember = itemStream.readUint16();
                    entry.maxMember = itemStream.readUint16();
                    entry.id = itemStream.readInt32();
                }
            }
            this.entries.push(entry);
        }
    }

    private readPascalStringFromItem(index: i32): string {
        if (index >= this.items.length) return "";
        const item = unchecked(this.items[index]);
        if (item.length === 0) return "";
        const len = <i32>unchecked(item[0]);
        let result = "";
        for (let i: i32 = 1; i <= len && i < item.length; i++) {
            result += String.fromCharCode(<i32>unchecked(item[i]));
        }
        return result;
    }

    private readUint16FromItem(index: i32): u16 {
        if (index >= this.items.length) return 0;
        const item = unchecked(this.items[index]);
        if (item.length < 2) return 0;
        const stream = new ReadStream(item, this.itemEndianness);
        return stream.readUint16();
    }
}
