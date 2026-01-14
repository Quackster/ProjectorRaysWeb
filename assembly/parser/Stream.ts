/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Endianness } from "./Enums";

/**
 * ReadStream - Binary reading with endianness support
 * Port of js/stream.js ReadStream class to AssemblyScript
 */
export class ReadStream {
    private data: Uint8Array;
    private _pos: i32;
    private _size: i32;
    public endianness: Endianness;

    constructor(data: Uint8Array, endianness: Endianness = Endianness.BigEndian) {
        this.data = data;
        this._pos = 0;
        this._size = data.length;
        this.endianness = endianness;
    }

    get pos(): i32 {
        return this._pos;
    }

    get size(): i32 {
        return this._size;
    }

    seek(pos: i32): void {
        this._pos = pos;
    }

    skip(offset: i32): void {
        this._pos += offset;
    }

    eof(): bool {
        return this._pos >= this._size;
    }

    pastEOF(): bool {
        return this._pos > this._size;
    }

    // Read raw bytes (returns a view, not a copy)
    readBytes(len: i32): Uint8Array {
        if (this._pos + len > this._size) {
            throw new Error("ReadStream::readBytes: Read past end of stream!");
        }
        const result = this.data.subarray(this._pos, this._pos + len);
        this._pos += len;
        return result;
    }

    // Read up to len bytes (may return fewer at end)
    readUpToBytes(len: i32): Uint8Array {
        if (this.eof()) {
            return new Uint8Array(0);
        }
        const available = min(len, this._size - this._pos);
        return this.readBytes(available);
    }

    readUint8(): u8 {
        if (this._pos + 1 > this._size) {
            throw new Error("ReadStream::readUint8: Read past end of stream!");
        }
        const value = unchecked(this.data[this._pos]);
        this._pos += 1;
        return value;
    }

    readInt8(): i8 {
        return <i8>this.readUint8();
    }

    readUint16(): u16 {
        if (this._pos + 2 > this._size) {
            throw new Error("ReadStream::readUint16: Read past end of stream!");
        }
        const p = this._pos;
        this._pos += 2;

        if (this.endianness === Endianness.LittleEndian) {
            return (
                <u16>unchecked(this.data[p]) |
                (<u16>unchecked(this.data[p + 1]) << 8)
            );
        } else {
            return (
                (<u16>unchecked(this.data[p]) << 8) |
                <u16>unchecked(this.data[p + 1])
            );
        }
    }

    readInt16(): i16 {
        return <i16>this.readUint16();
    }

    readUint32(): u32 {
        if (this._pos + 4 > this._size) {
            throw new Error("ReadStream::readUint32: Read past end of stream!");
        }
        const p = this._pos;
        this._pos += 4;

        if (this.endianness === Endianness.LittleEndian) {
            return (
                <u32>unchecked(this.data[p]) |
                (<u32>unchecked(this.data[p + 1]) << 8) |
                (<u32>unchecked(this.data[p + 2]) << 16) |
                (<u32>unchecked(this.data[p + 3]) << 24)
            );
        } else {
            return (
                (<u32>unchecked(this.data[p]) << 24) |
                (<u32>unchecked(this.data[p + 1]) << 16) |
                (<u32>unchecked(this.data[p + 2]) << 8) |
                <u32>unchecked(this.data[p + 3])
            );
        }
    }

    readInt32(): i32 {
        return <i32>this.readUint32();
    }

    readFloat32(): f32 {
        if (this._pos + 4 > this._size) {
            throw new Error("ReadStream::readFloat32: Read past end of stream!");
        }
        const p = this._pos;
        this._pos += 4;

        // Read bytes in correct order based on endianness
        let bits: u32;
        if (this.endianness === Endianness.LittleEndian) {
            bits = (
                <u32>unchecked(this.data[p]) |
                (<u32>unchecked(this.data[p + 1]) << 8) |
                (<u32>unchecked(this.data[p + 2]) << 16) |
                (<u32>unchecked(this.data[p + 3]) << 24)
            );
        } else {
            bits = (
                (<u32>unchecked(this.data[p]) << 24) |
                (<u32>unchecked(this.data[p + 1]) << 16) |
                (<u32>unchecked(this.data[p + 2]) << 8) |
                <u32>unchecked(this.data[p + 3])
            );
        }
        return reinterpret<f32>(bits);
    }

    readFloat64(): f64 {
        if (this._pos + 8 > this._size) {
            throw new Error("ReadStream::readFloat64: Read past end of stream!");
        }
        const p = this._pos;
        this._pos += 8;

        // Read bytes in correct order based on endianness
        let lo: u32, hi: u32;
        if (this.endianness === Endianness.LittleEndian) {
            lo = (
                <u32>unchecked(this.data[p]) |
                (<u32>unchecked(this.data[p + 1]) << 8) |
                (<u32>unchecked(this.data[p + 2]) << 16) |
                (<u32>unchecked(this.data[p + 3]) << 24)
            );
            hi = (
                <u32>unchecked(this.data[p + 4]) |
                (<u32>unchecked(this.data[p + 5]) << 8) |
                (<u32>unchecked(this.data[p + 6]) << 16) |
                (<u32>unchecked(this.data[p + 7]) << 24)
            );
        } else {
            hi = (
                (<u32>unchecked(this.data[p]) << 24) |
                (<u32>unchecked(this.data[p + 1]) << 16) |
                (<u32>unchecked(this.data[p + 2]) << 8) |
                <u32>unchecked(this.data[p + 3])
            );
            lo = (
                (<u32>unchecked(this.data[p + 4]) << 24) |
                (<u32>unchecked(this.data[p + 5]) << 16) |
                (<u32>unchecked(this.data[p + 6]) << 8) |
                <u32>unchecked(this.data[p + 7])
            );
        }
        const bits: u64 = (<u64>hi << 32) | <u64>lo;
        return reinterpret<f64>(bits);
    }

    /**
     * Read variable-length integer (7-bit encoding used in Director)
     */
    readVarInt(): u32 {
        let val: u32 = 0;
        let b: u8;
        do {
            b = this.readUint8();
            val = (val << 7) | <u32>(b & 0x7f);
        } while (b >> 7);
        return val;
    }

    /**
     * Read fixed-length string (Latin-1 encoding)
     */
    readString(len: i32): string {
        if (this._pos + len > this._size) {
            throw new Error("ReadStream::readString: Read past end of stream!");
        }

        let result = "";
        for (let i: i32 = 0; i < len; i++) {
            result += String.fromCharCode(<i32>unchecked(this.data[this._pos + i]));
        }
        this._pos += len;
        return result;
    }

    /**
     * Read null-terminated C string
     */
    readCString(): string {
        let result = "";
        let ch = this.readInt8();
        while (ch !== 0) {
            result += String.fromCharCode(<i32>(ch & 0xff));
            ch = this.readInt8();
        }
        return result;
    }

    /**
     * Read Pascal string (length-prefixed)
     */
    readPascalString(): string {
        const len = <i32>this.readUint8();
        return this.readString(len);
    }

    /**
     * Create a substream from current position
     */
    substream(len: i32): ReadStream {
        if (this._pos + len > this._size) {
            throw new Error("ReadStream::substream: Read past end of stream!");
        }
        const sub = new ReadStream(
            this.data.subarray(this._pos, this._pos + len),
            this.endianness
        );
        this._pos += len;
        return sub;
    }
}

/**
 * WriteStream - Binary writing with endianness support
 */
export class WriteStream {
    private data: Uint8Array;
    private _pos: i32;
    private _size: i32;
    public endianness: Endianness;

    constructor(size: i32, endianness: Endianness = Endianness.BigEndian) {
        this.data = new Uint8Array(size);
        this._pos = 0;
        this._size = size;
        this.endianness = endianness;
    }

    get pos(): i32 {
        return this._pos;
    }

    get size(): i32 {
        return this._size;
    }

    seek(pos: i32): void {
        this._pos = pos;
    }

    skip(offset: i32): void {
        this._pos += offset;
    }

    pastEOF(): bool {
        return this._pos > this._size;
    }

    writeBytes(bytes: Uint8Array): i32 {
        const len = bytes.length;
        if (this._pos + len > this._size) {
            throw new Error("WriteStream::writeBytes: Write past end of stream!");
        }
        for (let i: i32 = 0; i < len; i++) {
            unchecked(this.data[this._pos + i] = bytes[i]);
        }
        this._pos += len;
        return len;
    }

    writeUint8(value: u8): void {
        if (this._pos + 1 > this._size) {
            throw new Error("WriteStream::writeUint8: Write past end of stream!");
        }
        unchecked(this.data[this._pos] = value);
        this._pos += 1;
    }

    writeInt8(value: i8): void {
        this.writeUint8(<u8>value);
    }

    writeUint16(value: u16): void {
        if (this._pos + 2 > this._size) {
            throw new Error("WriteStream::writeUint16: Write past end of stream!");
        }
        const p = this._pos;
        this._pos += 2;

        if (this.endianness === Endianness.LittleEndian) {
            unchecked(this.data[p] = <u8>(value & 0xff));
            unchecked(this.data[p + 1] = <u8>((value >> 8) & 0xff));
        } else {
            unchecked(this.data[p] = <u8>((value >> 8) & 0xff));
            unchecked(this.data[p + 1] = <u8>(value & 0xff));
        }
    }

    writeInt16(value: i16): void {
        this.writeUint16(<u16>value);
    }

    writeUint32(value: u32): void {
        if (this._pos + 4 > this._size) {
            throw new Error("WriteStream::writeUint32: Write past end of stream!");
        }
        const p = this._pos;
        this._pos += 4;

        if (this.endianness === Endianness.LittleEndian) {
            unchecked(this.data[p] = <u8>(value & 0xff));
            unchecked(this.data[p + 1] = <u8>((value >> 8) & 0xff));
            unchecked(this.data[p + 2] = <u8>((value >> 16) & 0xff));
            unchecked(this.data[p + 3] = <u8>((value >> 24) & 0xff));
        } else {
            unchecked(this.data[p] = <u8>((value >> 24) & 0xff));
            unchecked(this.data[p + 1] = <u8>((value >> 16) & 0xff));
            unchecked(this.data[p + 2] = <u8>((value >> 8) & 0xff));
            unchecked(this.data[p + 3] = <u8>(value & 0xff));
        }
    }

    writeInt32(value: i32): void {
        this.writeUint32(<u32>value);
    }

    writeString(value: string): void {
        const len = value.length;
        if (this._pos + len > this._size) {
            throw new Error("WriteStream::writeString: Write past end of stream!");
        }
        for (let i: i32 = 0; i < len; i++) {
            unchecked(this.data[this._pos + i] = <u8>value.charCodeAt(i));
        }
        this._pos += len;
    }

    writePascalString(value: string): void {
        this.writeUint8(<u8>value.length);
        this.writeString(value);
    }

    getBuffer(): Uint8Array {
        return this.data;
    }
}
