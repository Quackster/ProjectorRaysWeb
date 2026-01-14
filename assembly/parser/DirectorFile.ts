/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ReadStream } from "./Stream";
import { Endianness, FOURCC, fourCCToString } from "./Enums";
import {
    ChunkInfo, MoaID, MemoryMapEntry, KeyTableEntry,
    NULL_COMPRESSION_GUID, ZLIB_COMPRESSION_GUID
} from "./Subchunk";
import {
    humanVersion,
    InitialMapChunk, MemoryMapChunk, KeyTableChunk, ConfigChunk,
    CastChunk, CastListChunk, CastMemberChunk
} from "./Chunk";

// FOURCC constants
const FOURCC_XFIR: u32 = FOURCC(0x58, 0x46, 0x49, 0x52); // "XFIR" (little-endian RIFX)
const FOURCC_RIFX: u32 = FOURCC(0x52, 0x49, 0x46, 0x58); // "RIFX"
const FOURCC_MV93: u32 = FOURCC(0x4D, 0x56, 0x39, 0x33); // "MV93"
const FOURCC_MC95: u32 = FOURCC(0x4D, 0x43, 0x39, 0x35); // "MC95"
const FOURCC_FGDM: u32 = FOURCC(0x46, 0x47, 0x44, 0x4D); // "FGDM"
const FOURCC_FGDC: u32 = FOURCC(0x46, 0x47, 0x44, 0x43); // "FGDC"

const FOURCC_imap: u32 = FOURCC(0x69, 0x6D, 0x61, 0x70); // "imap"
const FOURCC_mmap: u32 = FOURCC(0x6D, 0x6D, 0x61, 0x70); // "mmap"
const FOURCC_free: u32 = FOURCC(0x66, 0x72, 0x65, 0x65); // "free"
const FOURCC_junk: u32 = FOURCC(0x6A, 0x75, 0x6E, 0x6B); // "junk"
const FOURCC_KEY_: u32 = FOURCC(0x4B, 0x45, 0x59, 0x2A); // "KEY*"
const FOURCC_DRCF: u32 = FOURCC(0x44, 0x52, 0x43, 0x46); // "DRCF"
const FOURCC_VWCF: u32 = FOURCC(0x56, 0x57, 0x43, 0x46); // "VWCF"
const FOURCC_MCsL: u32 = FOURCC(0x4D, 0x43, 0x73, 0x4C); // "MCsL"
const FOURCC_CAS_: u32 = FOURCC(0x43, 0x41, 0x53, 0x2A); // "CAS*"
const FOURCC_CASt: u32 = FOURCC(0x43, 0x41, 0x53, 0x74); // "CASt"
const FOURCC_Lctx: u32 = FOURCC(0x4C, 0x63, 0x74, 0x78); // "Lctx"
const FOURCC_LctX: u32 = FOURCC(0x4C, 0x63, 0x74, 0x58); // "LctX"
const FOURCC_Lnam: u32 = FOURCC(0x4C, 0x6E, 0x61, 0x6D); // "Lnam"
const FOURCC_Lscr: u32 = FOURCC(0x4C, 0x73, 0x63, 0x72); // "Lscr"

const kRIFXHeaderSize: i32 = 12;
const kChunkHeaderSize: i32 = 8;

/**
 * DirectorFile - Main class for parsing Director files
 *
 * Note: This AssemblyScript version handles basic RIFX parsing.
 * Afterburner (FGDM/FGDC) files require zlib decompression which
 * must be handled in the JavaScript layer using pako.
 */
export class DirectorFile {
    // Stream and basic info
    private _data: Uint8Array | null = null;
    private _stream: ReadStream | null = null;

    // File properties
    endianness: Endianness = Endianness.BigEndian;
    codec: u32 = 0;
    version: i32 = 0;
    dotSyntax: bool = false;
    afterburned: bool = false;

    // Chunk index (simplified - use parallel arrays instead of Map)
    chunkInfoIds: i32[] = [];
    chunkInfoFourCCs: u32[] = [];
    chunkInfoLens: u32[] = [];
    chunkInfoOffsets: u32[] = [];

    // Parsed chunks
    initialMap: InitialMapChunk | null = null;
    memoryMap: MemoryMapChunk | null = null;
    keyTable: KeyTableChunk | null = null;
    config: ConfigChunk | null = null;
    castList: CastListChunk | null = null;
    casts: CastChunk[] = [];

    // Error tracking
    lastError: string = "";

    /**
     * Read a Director file from raw bytes
     * Returns true on success, false on error (check lastError)
     */
    read(data: Uint8Array): bool {
        this._data = data;
        this._stream = new ReadStream(data, Endianness.BigEndian);
        const stream = this._stream!;

        // Read RIFX header
        const metaFourCC = stream.readUint32();
        if (metaFourCC === FOURCC_XFIR) {
            stream.endianness = Endianness.LittleEndian;
        } else if (metaFourCC !== FOURCC_RIFX) {
            this.lastError = "Invalid file: not a RIFX container";
            return false;
        }
        this.endianness = stream.endianness;

        stream.readUint32(); // meta length
        this.codec = stream.readUint32();

        // Codec-dependent map reading
        if (this.codec === FOURCC_MV93 || this.codec === FOURCC_MC95) {
            if (!this.readMemoryMap()) {
                return false;
            }
        } else if (this.codec === FOURCC_FGDM || this.codec === FOURCC_FGDC) {
            this.afterburned = true;
            // Afterburner files require JS-side decompression
            // The JS layer should call readAfterburnerMap after decompressing
            this.lastError = "Afterburner files require JS-side decompression";
            return false;
        } else {
            this.lastError = "Unsupported codec: " + fourCCToString(this.codec);
            return false;
        }

        // Read essential chunks
        if (!this.readKeyTable()) return false;
        if (!this.readConfig()) return false;
        if (!this.readCasts()) return false;

        return true;
    }

    /**
     * Read memory map for MV93/MC95 files
     */
    private readMemoryMap(): bool {
        const stream = this._stream!;

        // Read imap chunk
        const imap = new InitialMapChunk();
        const imapStart = stream.pos;
        const imapFourCC = stream.readUint32();
        if (imapFourCC !== FOURCC_imap) {
            this.lastError = "Expected imap chunk at position " + imapStart.toString();
            return false;
        }
        const imapLen = stream.readUint32();
        imap.read(stream);
        this.initialMap = imap;

        // Read mmap chunk
        stream.seek(<i32>imap.mmapOffset);
        const mmap = new MemoryMapChunk();
        const mmapFourCC = stream.readUint32();
        if (mmapFourCC !== FOURCC_mmap) {
            this.lastError = "Expected mmap chunk";
            return false;
        }
        stream.readUint32(); // mmap length
        mmap.read(stream);
        this.memoryMap = mmap;

        // Build chunk index from memory map
        for (let i: i32 = 0; i < mmap.mapArray.length; i++) {
            const entry = unchecked(mmap.mapArray[i]);

            // Skip free and junk chunks
            if (entry.fourCC === FOURCC_free || entry.fourCC === FOURCC_junk) {
                continue;
            }

            this.chunkInfoIds.push(i);
            this.chunkInfoFourCCs.push(entry.fourCC);
            this.chunkInfoLens.push(entry.len);
            this.chunkInfoOffsets.push(entry.offset);
        }

        return true;
    }

    /**
     * Read the key table (KEY* chunk)
     */
    private readKeyTable(): bool {
        const idx = this.findFirstChunkByFourCC(FOURCC_KEY_);
        if (idx < 0) {
            this.lastError = "No KEY* chunk found";
            return false;
        }

        const offset = unchecked(this.chunkInfoOffsets[idx]);
        const len = unchecked(this.chunkInfoLens[idx]);

        this._stream!.seek(<i32>offset + kChunkHeaderSize);
        const chunkData = this._stream!.readBytes(<i32>len);
        const chunkStream = new ReadStream(chunkData, this.endianness);

        this.keyTable = new KeyTableChunk();
        this.keyTable.read(chunkStream);
        return true;
    }

    /**
     * Read the config chunk (DRCF or VWCF)
     */
    private readConfig(): bool {
        let idx = this.findFirstChunkByFourCC(FOURCC_DRCF);
        if (idx < 0) {
            idx = this.findFirstChunkByFourCC(FOURCC_VWCF);
        }
        if (idx < 0) {
            this.lastError = "No config chunk (DRCF/VWCF) found";
            return false;
        }

        const offset = unchecked(this.chunkInfoOffsets[idx]);
        const len = unchecked(this.chunkInfoLens[idx]);

        this._stream!.seek(<i32>offset + kChunkHeaderSize);
        const chunkData = this._stream!.readBytes(<i32>len);
        const chunkStream = new ReadStream(chunkData, this.endianness);

        this.config = new ConfigChunk();
        this.config.read(chunkStream);

        this.version = humanVersion(this.config.directorVersion);
        this.dotSyntax = this.version >= 700;

        return true;
    }

    /**
     * Read cast information
     */
    private readCasts(): bool {
        let internal = true;

        if (this.version >= 500) {
            // Try to read cast list
            const mcsLIdx = this.findFirstChunkByFourCC(FOURCC_MCsL);
            if (mcsLIdx >= 0) {
                const offset = unchecked(this.chunkInfoOffsets[mcsLIdx]);
                const len = unchecked(this.chunkInfoLens[mcsLIdx]);

                this._stream!.seek(<i32>offset + kChunkHeaderSize);
                const chunkData = this._stream!.readBytes(<i32>len);
                const chunkStream = new ReadStream(chunkData, this.endianness);

                this.castList = new CastListChunk();
                this.castList.read(chunkStream);

                // Load each cast from the list
                for (let i: i32 = 0; i < this.castList.entries.length; i++) {
                    const castEntry = unchecked(this.castList.entries[i]);
                    const sectionID = this.findCastSectionID(castEntry.id);

                    if (sectionID > 0) {
                        const cast = this.readCastChunk(sectionID);
                        if (cast !== null) {
                            cast.populate(castEntry.name, castEntry.id, <i32>castEntry.minMember);
                            this.casts.push(cast);
                        }
                    }
                }
                return true;
            } else {
                internal = false;
            }
        }

        // Fallback: read single CAS* chunk
        const casIdx = this.findFirstChunkByFourCC(FOURCC_CAS_);
        if (casIdx >= 0) {
            const cast = this.readCastChunk(unchecked(this.chunkInfoIds[casIdx]));
            if (cast !== null) {
                cast.populate(
                    internal ? "Internal" : "External",
                    1024,
                    <i32>this.config!.minMember
                );
                this.casts.push(cast);
            }
        }

        return true;
    }

    /**
     * Find cast section ID from key table
     */
    private findCastSectionID(castID: i32): i32 {
        if (this.keyTable === null) return -1;

        for (let i: i32 = 0; i < this.keyTable.entries.length; i++) {
            const entry = unchecked(this.keyTable.entries[i]);
            if (entry.castID === castID && entry.fourCC === FOURCC_CAS_) {
                return entry.sectionID;
            }
        }
        return -1;
    }

    /**
     * Read a CAS* chunk by section ID
     */
    private readCastChunk(sectionID: i32): CastChunk | null {
        const idx = this.findChunkByID(sectionID);
        if (idx < 0) return null;

        const offset = unchecked(this.chunkInfoOffsets[idx]);
        const len = unchecked(this.chunkInfoLens[idx]);

        this._stream!.seek(<i32>offset + kChunkHeaderSize);
        const chunkData = this._stream!.readBytes(<i32>len);
        const chunkStream = new ReadStream(chunkData, this.endianness);

        const cast = new CastChunk();
        cast.read(chunkStream);
        return cast;
    }

    /**
     * Read a CASt (cast member) chunk by section ID
     */
    readCastMemberChunk(sectionID: i32): CastMemberChunk | null {
        const idx = this.findChunkByID(sectionID);
        if (idx < 0) return null;

        const fourCC = unchecked(this.chunkInfoFourCCs[idx]);
        if (fourCC !== FOURCC_CASt) return null;

        const offset = unchecked(this.chunkInfoOffsets[idx]);
        const len = unchecked(this.chunkInfoLens[idx]);

        this._stream!.seek(<i32>offset + kChunkHeaderSize);
        const chunkData = this._stream!.readBytes(<i32>len);
        const chunkStream = new ReadStream(chunkData, this.endianness);

        const member = new CastMemberChunk();
        member.read(chunkStream, this.version);
        return member;
    }

    /**
     * Find first chunk index by fourCC
     */
    private findFirstChunkByFourCC(fourCC: u32): i32 {
        for (let i: i32 = 0; i < this.chunkInfoFourCCs.length; i++) {
            if (unchecked(this.chunkInfoFourCCs[i]) === fourCC) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Find chunk index by ID
     */
    private findChunkByID(id: i32): i32 {
        for (let i: i32 = 0; i < this.chunkInfoIds.length; i++) {
            if (unchecked(this.chunkInfoIds[i]) === id) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Check if this is a cast file (vs movie file)
     */
    isCast(): bool {
        return this.codec === FOURCC_MC95 || this.codec === FOURCC_FGDC;
    }

    /**
     * Get chunk count
     */
    getChunkCount(): i32 {
        return this.chunkInfoIds.length;
    }

    /**
     * Get cast count
     */
    getCastCount(): i32 {
        return this.casts.length;
    }

    /**
     * Get stage dimensions
     */
    getStageWidth(): i32 {
        if (this.config === null) return 0;
        return this.config!.stageWidth;
    }

    getStageHeight(): i32 {
        if (this.config === null) return 0;
        return this.config!.stageHeight;
    }

    /**
     * Get frame rate
     */
    getFrameRate(): i32 {
        if (this.config === null) return 0;
        return <i32>this.config!.frameRate;
    }
}

// Export factory function for easier JS interop
export function createDirectorFile(): DirectorFile {
    return new DirectorFile();
}

export function parseDirectorFile(data: Uint8Array): DirectorFile {
    const file = new DirectorFile();
    file.read(data);
    return file;
}
