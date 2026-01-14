# Director Web Player - AssemblyScript Architecture & Implementation Plan

## Executive Summary

Build a client-side Director player running entirely in the browser using **AssemblyScript** for performance-critical WebAssembly modules. AssemblyScript's TypeScript-like syntax enables direct porting of the existing JavaScript viewer code while gaining WASM performance benefits.

---

## Why AssemblyScript Over C++/Emscripten

| Factor | AssemblyScript | C++ (Emscripten) |
|--------|----------------|------------------|
| **Code reuse** | Port existing JS viewer directly | Requires complete rewrite |
| **Learning curve** | TypeScript developers ready | Requires C++ expertise |
| **Interop with JS** | Native, seamless | Complex binding layer |
| **Build complexity** | Simple npm toolchain | Complex Emscripten setup |
| **Bundle size** | Smaller (~100KB typical) | Larger (500KB+ with runtime) |
| **Debug experience** | Source maps, familiar tools | Limited WASM debugging |
| **Maintenance** | Single codebase style | Two language ecosystems |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER RUNTIME                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                    TypeScript Orchestration Layer                         │   │
│  │                                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │   │
│  │  │ MoviePlayer │  │ EventRouter │  │ AudioMgr    │  │ UI Controller  │  │   │
│  │  │ - load/play │  │ - mouse/key │  │ - WebAudio  │  │ - file picker  │  │   │
│  │  │ - seek      │  │ - dispatch  │  │ - channels  │  │ - controls     │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬────────┘  │   │
│  │         │                │                │                  │           │   │
│  │  ┌──────▼────────────────▼────────────────▼──────────────────▼───────┐   │   │
│  │  │                    Rendering Engine (Canvas 2D)                    │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │   │
│  │  │  │ Compositor │  │ InkBlitter │  │ Transitions│  │ TextRender │  │   │   │
│  │  │  │ (channels) │  │ (18 modes) │  │ (effects)  │  │ (fonts)    │  │   │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │   │   │
│  │  └────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│  ════════════════════════════════════╪═══════════════════════════════════════   │
│                          WASM Linear Memory Bridge                               │
│  ════════════════════════════════════╪═══════════════════════════════════════   │
│                                      │                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                 AssemblyScript WebAssembly Modules                        │   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │   │
│  │  │  FileParser     │  │  ScoreEngine    │  │  LingoVM                │  │   │
│  │  │  ─────────────  │  │  ─────────────  │  │  ─────────────────────  │  │   │
│  │  │  • RIFX chunks  │  │  • Frame data   │  │  • Bytecode interpreter │  │   │
│  │  │  • Cast parsing │  │  • Channels     │  │  • Variable store       │  │   │
│  │  │  • Compression  │  │  • Tempo/timing │  │  • Handler dispatch     │  │   │
│  │  │  • Asset index  │  │  • Labels       │  │  • Property access      │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │   │
│  │  │  BitmapDecoder  │  │  PaletteEngine  │  │  SoundDecoder           │  │   │
│  │  │  ─────────────  │  │  ─────────────  │  │  ─────────────────────  │  │   │
│  │  │  • RLE decomp   │  │  • CLUT parsing │  │  • SND format           │  │   │
│  │  │  • Bit depths   │  │  • System pals  │  │  • AIFF headers         │  │   │
│  │  │  • RGBA output  │  │  • Color lookup │  │  • PCM conversion       │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Responsibilities

| Module | Language | Location | Responsibility |
|--------|----------|----------|----------------|
| **FileParser** | AssemblyScript | `assembly/parser/` | Parse RIFX container, extract chunks, build indices |
| **ScoreEngine** | AssemblyScript | `assembly/score/` | Parse VWSC, manage frames, channel state |
| **LingoVM** | AssemblyScript | `assembly/lingo/` | Execute bytecode, variables, handler calls |
| **BitmapDecoder** | AssemblyScript | `assembly/assets/` | RLE decompression, bit depth conversion |
| **PaletteEngine** | AssemblyScript | `assembly/assets/` | CLUT parsing, color lookup tables |
| **SoundDecoder** | AssemblyScript | `assembly/assets/` | SND/AIFF parsing, PCM extraction |
| **MoviePlayer** | TypeScript | `src/player/` | High-level playback control, timing |
| **Compositor** | TypeScript | `src/render/` | Channel management, dirty rectangles |
| **InkBlitter** | TypeScript | `src/render/` | Ink mode pixel operations |
| **EventRouter** | TypeScript | `src/events/` | Input → Lingo event dispatch |
| **AudioManager** | TypeScript | `src/audio/` | WebAudio API, sound channels |

---

## Project Structure

```
ProjectorRaysWeb/
├── assembly/                    # AssemblyScript source (→ WASM)
│   ├── parser/
│   │   ├── index.ts            # Main exports
│   │   ├── DirectorFile.ts     # RIFX parsing (port from JS)
│   │   ├── Chunk.ts            # Chunk base classes
│   │   ├── ChunkTypes.ts       # CastChunk, ConfigChunk, etc.
│   │   └── Stream.ts           # Binary reading (port from JS)
│   │
│   ├── score/
│   │   ├── index.ts
│   │   ├── Score.ts            # Timeline container
│   │   ├── Frame.ts            # Frame data structure
│   │   ├── Channel.ts          # Sprite channel state
│   │   └── Sprite.ts           # Sprite properties
│   │
│   ├── lingo/
│   │   ├── index.ts
│   │   ├── VM.ts               # Bytecode interpreter
│   │   ├── Handler.ts          # Script handler (port from JS)
│   │   ├── AST.ts              # Expression nodes
│   │   ├── Opcodes.ts          # Opcode definitions
│   │   └── Variables.ts        # Global/local storage
│   │
│   ├── assets/
│   │   ├── Bitmap.ts           # Image decoding
│   │   ├── Palette.ts          # Color tables
│   │   └── Sound.ts            # Audio parsing
│   │
│   └── tsconfig.json           # AssemblyScript config
│
├── src/                         # TypeScript source (→ JS)
│   ├── player/
│   │   ├── MoviePlayer.ts      # Main player class
│   │   ├── PlaybackState.ts    # State machine
│   │   └── Timeline.ts         # Frame sequencing
│   │
│   ├── render/
│   │   ├── Compositor.ts       # Channel rendering
│   │   ├── InkBlitter.ts       # Ink mode implementations
│   │   ├── Transitions.ts      # Visual effects
│   │   └── Stage.ts            # Canvas management
│   │
│   ├── events/
│   │   ├── EventRouter.ts      # Input handling
│   │   ├── MouseEvents.ts      # Mouse → Lingo
│   │   └── KeyboardEvents.ts   # Keyboard → Lingo
│   │
│   ├── audio/
│   │   ├── AudioManager.ts     # WebAudio controller
│   │   └── SoundChannel.ts     # Individual channels
│   │
│   ├── bridge/
│   │   ├── WasmLoader.ts       # Load & instantiate WASM
│   │   └── WasmBridge.ts       # JS ↔ WASM interface
│   │
│   └── index.ts                # Main entry point
│
├── build/                       # Compiled output
│   ├── director.wasm           # AssemblyScript → WASM
│   ├── director.js             # TypeScript → JS bundle
│   └── director.d.ts           # Type declarations
│
├── js/                          # Existing viewer (reference)
│   ├── director/               # Existing parsing code
│   └── lingodec/               # Existing decompiler
│
├── package.json
├── asconfig.json               # AssemblyScript build config
├── tsconfig.json               # TypeScript config
└── DIRECTOR_PLAYER_PLAN.md     # This file
```

---

## Build System

### package.json

```json
{
  "name": "director-web-player",
  "version": "0.1.0",
  "scripts": {
    "asbuild:debug": "asc assembly/index.ts -o build/director.wasm --sourceMap --debug",
    "asbuild:release": "asc assembly/index.ts -o build/director.wasm -O3 --noAssert",
    "build:ts": "tsc && esbuild src/index.ts --bundle --outfile=build/director.js",
    "build": "npm run asbuild:release && npm run build:ts",
    "dev": "npm run asbuild:debug && npm run build:ts",
    "test": "asp --config as-pect.config.js"
  },
  "devDependencies": {
    "assemblyscript": "^0.27.0",
    "@assemblyscript/loader": "^0.27.0",
    "as-pect": "^8.0.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0"
  }
}
```

### asconfig.json

```json
{
  "entries": ["assembly/index.ts"],
  "targets": {
    "debug": {
      "outFile": "build/director.wasm",
      "sourceMap": true,
      "debug": true
    },
    "release": {
      "outFile": "build/director.wasm",
      "optimizeLevel": 3,
      "shrinkLevel": 1,
      "noAssert": true
    }
  },
  "options": {
    "exportRuntime": true,
    "runtime": "incremental"
  }
}
```

---

## Key Interfaces

### 1. WASM Module Exports (AssemblyScript)

```typescript
// assembly/index.ts - Main WASM exports

// Memory management
export const memory: WebAssembly.Memory;

// Movie loading
export function createMovie(): i32;  // Returns movie handle
export function loadMovieFromBuffer(handle: i32, ptr: usize, len: i32): bool;
export function freeMovie(handle: i32): void;

// Movie info
export function getFrameCount(handle: i32): i32;
export function getChannelCount(handle: i32): i32;
export function getStageWidth(handle: i32): i32;
export function getStageHeight(handle: i32): i32;
export function getFrameRate(handle: i32): i32;

// Frame data (returns pointer to shared memory struct)
export function getFrame(handle: i32, frameNum: i32): usize;
export function getChannelData(handle: i32, frameNum: i32, channelNum: i32): usize;

// Cast member access
export function getCastMemberType(handle: i32, castId: i32, memberId: i32): i32;
export function getBitmapData(handle: i32, castId: i32, memberId: i32): usize;
export function getBitmapWidth(handle: i32, castId: i32, memberId: i32): i32;
export function getBitmapHeight(handle: i32, castId: i32, memberId: i32): i32;
export function getSoundData(handle: i32, castId: i32, memberId: i32): usize;
export function getSoundLength(handle: i32, castId: i32, memberId: i32): i32;

// Lingo VM
export function createVM(movieHandle: i32): i32;
export function executeHandler(vmHandle: i32, scriptId: i32, handlerNamePtr: usize): void;
export function setGlobalInt(vmHandle: i32, namePtr: usize, value: i32): void;
export function getGlobalInt(vmHandle: i32, namePtr: usize): i32;
export function vmStep(vmHandle: i32): i32;  // Returns 0=done, 1=running, 2=waiting
```

### 2. TypeScript Bridge

```typescript
// src/bridge/WasmBridge.ts

import loader from "@assemblyscript/loader";

export class WasmBridge {
  private instance: loader.ASUtil;
  private movieHandle: number = 0;
  private vmHandle: number = 0;

  async init(): Promise<void> {
    this.instance = await loader.instantiate(
      fetch("/build/director.wasm")
    );
  }

  loadMovie(buffer: ArrayBuffer): boolean {
    const { exports, __pin, __unpin, __newArrayBuffer } = this.instance;

    // Copy buffer to WASM memory
    const ptr = __newArrayBuffer(buffer);
    __pin(ptr);

    this.movieHandle = exports.createMovie();
    const success = exports.loadMovieFromBuffer(
      this.movieHandle,
      ptr,
      buffer.byteLength
    );

    __unpin(ptr);
    return success;
  }

  getFrameCount(): number {
    return this.instance.exports.getFrameCount(this.movieHandle);
  }

  getFrame(frameNum: number): FrameData {
    const ptr = this.instance.exports.getFrame(this.movieHandle, frameNum);
    return this.readFrameData(ptr);
  }

  getBitmap(castId: number, memberId: number): ImageData {
    const { exports } = this.instance;
    const width = exports.getBitmapWidth(this.movieHandle, castId, memberId);
    const height = exports.getBitmapHeight(this.movieHandle, castId, memberId);
    const ptr = exports.getBitmapData(this.movieHandle, castId, memberId);

    // Read RGBA data from WASM memory
    const rgba = new Uint8ClampedArray(
      this.instance.memory.buffer,
      ptr,
      width * height * 4
    );

    return new ImageData(rgba, width, height);
  }

  // ... more methods
}
```

### 3. Channel Data Structure

```typescript
// assembly/score/Channel.ts

@unmanaged
export class ChannelData {
  spriteNum: i16;
  castLib: i16;
  castMember: i16;

  locH: i16;
  locV: i16;
  width: i16;
  height: i16;

  ink: u8;
  blend: u8;

  flags: u8;  // visible, puppet, moveable, editable bits

  scriptId: i16;
  colorCode: u8;
  bgColorCode: u8;
}

// TypeScript interface for JS side
export interface IChannelData {
  spriteNum: number;
  castLib: number;
  castMember: number;
  locH: number;
  locV: number;
  width: number;
  height: number;
  ink: InkType;
  blend: number;
  visible: boolean;
  puppet: boolean;
  scriptId: number;
}
```

### 4. Frame Data Structure

```typescript
// assembly/score/Frame.ts

@unmanaged
export class FrameData {
  frameNum: i32;
  tempo: i16;
  transitionType: u8;
  transitionDuration: u8;
  paletteId: i16;

  sound1CastLib: i16;
  sound1CastMember: i16;
  sound2CastLib: i16;
  sound2CastMember: i16;

  scriptId: i16;

  channelCount: i16;
  // Channels follow in memory: ChannelData[channelCount]
}
```

---

## Porting Strategy from Existing JS Viewer

The existing `js/` directory contains working parsing code. Port in this order:

### Phase 1: Core Parsing (Port Directly)

| Source File | Target File | Complexity |
|-------------|-------------|------------|
| `js/stream.js` | `assembly/parser/Stream.ts` | Low |
| `js/lingodec/enums.js` | `assembly/parser/Enums.ts` | Low |
| `js/director/subchunk.js` | `assembly/parser/Subchunk.ts` | Low |
| `js/director/chunk.js` | `assembly/parser/Chunk.ts` | Medium |
| `js/director/dirfile.js` | `assembly/parser/DirectorFile.ts` | Medium |

### Phase 2: Asset Decoding (Port + Enhance)

| Source File | Target File | Notes |
|-------------|-------------|-------|
| `js/projectorrays-lib.js` (bitmap) | `assembly/assets/Bitmap.ts` | Extract bitmap logic |
| `js/projectorrays-lib.js` (palette) | `assembly/assets/Palette.ts` | Extract palette logic |
| `js/projectorrays-lib.js` (sound) | `assembly/assets/Sound.ts` | Extract sound logic |

### Phase 3: Lingo (Port + Convert to Interpreter)

| Source File | Target File | Notes |
|-------------|-------------|-------|
| `js/lingodec/enums.js` | `assembly/lingo/Opcodes.ts` | Direct port |
| `js/lingodec/names.js` | `assembly/lingo/Names.ts` | Direct port |
| `js/lingodec/handler.js` | `assembly/lingo/Handler.ts` | Port, then add execution |
| `js/lingodec/ast.js` | `assembly/lingo/AST.ts` | Port, add evaluate() |
| `js/lingodec/script.js` | `assembly/lingo/Script.ts` | Direct port |

### Phase 4: Score (New Implementation)

| File | Source Reference | Notes |
|------|------------------|-------|
| `assembly/score/Score.ts` | ScummVM score.cpp | New, reference ScummVM |
| `assembly/score/Frame.ts` | ScummVM frame.h | New, reference ScummVM |
| `assembly/score/Channel.ts` | ScummVM channel.h | New, reference ScummVM |

---

## AssemblyScript Porting Examples

### Stream Class (js/stream.js → assembly/parser/Stream.ts)

**Original JavaScript:**
```javascript
export class ReadStream {
    constructor(buffer, endianness = Endianness.kBigEndian) {
        this.buffer = buffer;
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        this.pos = 0;
        this.endianness = endianness;
    }

    readUint32() {
        const value = this.view.getUint32(this.pos, this.endianness === Endianness.kLittleEndian);
        this.pos += 4;
        return value;
    }
}
```

**AssemblyScript Port:**
```typescript
// assembly/parser/Stream.ts

export class ReadStream {
    private data: Uint8Array;
    private pos: i32;
    private littleEndian: bool;

    constructor(data: Uint8Array, littleEndian: bool = false) {
        this.data = data;
        this.pos = 0;
        this.littleEndian = littleEndian;
    }

    readUint32(): u32 {
        const p = this.pos;
        this.pos += 4;

        if (this.littleEndian) {
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

    readInt16(): i16 {
        const p = this.pos;
        this.pos += 2;

        let value: u16;
        if (this.littleEndian) {
            value = <u16>unchecked(this.data[p]) | (<u16>unchecked(this.data[p + 1]) << 8);
        } else {
            value = (<u16>unchecked(this.data[p]) << 8) | <u16>unchecked(this.data[p + 1]);
        }
        return <i16>value;
    }

    get size(): i32 {
        return this.data.length;
    }

    get position(): i32 {
        return this.pos;
    }

    seek(offset: i32): void {
        this.pos = offset;
    }

    eof(): bool {
        return this.pos >= this.data.length;
    }
}
```

### Handler Bytecode Reading (js/lingodec/handler.js → assembly/lingo/Handler.ts)

**Key Difference:** In JS we decompile to AST for display. In AssemblyScript we keep bytecode for execution.

```typescript
// assembly/lingo/Handler.ts

export class Bytecode {
    opcode: u8;
    obj: i32;
    pos: i32;
}

export class Handler {
    name: string;
    bytecodes: Bytecode[];
    argumentNames: string[];
    localNames: string[];
    globalNames: string[];

    // Execution state
    pc: i32 = 0;
    stack: LingoValue[] = [];
    locals: Map<string, LingoValue> = new Map();

    constructor() {
        this.bytecodes = [];
        this.argumentNames = [];
        this.localNames = [];
        this.globalNames = [];
    }

    readData(stream: ReadStream, version: i32): void {
        // Port from handler.js readData()
        const nameId = stream.readUint16();
        const vectorPos = stream.readUint16();
        const compiledLen = stream.readUint32();
        const compiledOffset = stream.readUint32();
        const argumentCount = stream.readUint16();
        const argumentOffset = stream.readUint32();
        const localsCount = stream.readUint16();
        const localsOffset = stream.readUint32();
        // ... continue porting
    }

    // NEW: Execute one instruction (not in original JS)
    step(vm: LingoVM): ExecutionResult {
        if (this.pc >= this.bytecodes.length) {
            return ExecutionResult.Done;
        }

        const bc = this.bytecodes[this.pc];
        this.pc++;

        switch (bc.opcode) {
            case OpCode.kOpRet:
                return ExecutionResult.Done;

            case OpCode.kOpPushInt:
                this.stack.push(LingoValue.fromInt(bc.obj));
                break;

            case OpCode.kOpAdd:
                const b = this.stack.pop();
                const a = this.stack.pop();
                this.stack.push(a.add(b));
                break;

            case OpCode.kOpJmp:
                this.pc = this.findPosition(bc.obj);
                break;

            case OpCode.kOpJmpIfZ:
                const cond = this.stack.pop();
                if (cond.isZero()) {
                    this.pc = this.findPosition(bc.obj);
                }
                break;

            // ... more opcodes
        }

        return ExecutionResult.Running;
    }
}
```

---

## MVP Feature Prioritization

### Phase 1: Static Frame Rendering (Weeks 1-4)

| Task | Module | Port From | Complexity |
|------|--------|-----------|------------|
| Set up AssemblyScript build | Build | - | Low |
| Port Stream class | `assembly/parser/` | `js/stream.js` | Low |
| Port Chunk classes | `assembly/parser/` | `js/director/chunk.js` | Medium |
| Port DirectorFile | `assembly/parser/` | `js/director/dirfile.js` | Medium |
| Implement Score parsing | `assembly/score/` | ScummVM reference | High |
| Port bitmap decoding | `assembly/assets/` | `js/projectorrays-lib.js` | Medium |
| Port palette handling | `assembly/assets/` | `js/projectorrays-lib.js` | Low |
| Create TypeScript bridge | `src/bridge/` | - | Medium |
| Build Canvas renderer | `src/render/` | - | Medium |

**Deliverable:** Load .dir file, display frame 1 with sprites positioned correctly.

### Phase 2: Timeline Playback (Weeks 5-8)

| Task | Module | Complexity |
|------|--------|------------|
| Frame sequencing | `src/player/` | Medium |
| Tempo handling | `src/player/` | Low |
| Basic ink modes (copy, transparent, matte) | `src/render/` | High |
| Sound channel playback | `src/audio/` | Medium |
| Sprite tweening | `assembly/score/` | Medium |
| Playback controls UI | `src/` | Low |

**Deliverable:** Animations play with correct timing and sound.

### Phase 3: Lingo VM Core (Weeks 9-16)

| Task | Module | Port From | Complexity |
|------|--------|-----------|------------|
| Port Handler class | `assembly/lingo/` | `js/lingodec/handler.js` | Medium |
| Port AST nodes | `assembly/lingo/` | `js/lingodec/ast.js` | Medium |
| Build bytecode interpreter | `assembly/lingo/` | NEW | Very High |
| Variable system | `assembly/lingo/` | NEW | Medium |
| `on mouseDown/Up` events | `src/events/` | NEW | Medium |
| `on enterFrame` events | `src/events/` | NEW | Medium |
| `go to frame` command | `assembly/lingo/` | NEW | Low |
| `puppetSprite` command | `assembly/lingo/` | NEW | Medium |
| Property access | `assembly/lingo/` | NEW | High |

**Deliverable:** Interactive buttons and navigation work.

### Phase 4: Extended Compatibility (Ongoing)

| Task | Complexity | Notes |
|------|------------|-------|
| All ink modes | High | Port from ScummVM reference |
| Transitions | High | 50+ effect types |
| Text rendering | High | Font handling |
| External cast linking | High | Multi-file support |
| Film loops | Medium | Nested playback |
| More Lingo commands | Ongoing | As needed per content |

---

## Ink Mode Implementation

Priority order based on frequency of use:

```typescript
// src/render/InkBlitter.ts

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

export class InkBlitter {
    blit(
        dest: ImageData,
        src: ImageData,
        x: number, y: number,
        ink: InkType,
        blend: number,
        bgColor: number
    ): void {
        switch (ink) {
            case InkType.Copy:
                this.blitCopy(dest, src, x, y);
                break;
            case InkType.Transparent:
                this.blitTransparent(dest, src, x, y);  // Skip white
                break;
            case InkType.Matte:
                this.blitMatte(dest, src, x, y);  // Use alpha
                break;
            case InkType.Blend:
                this.blitBlend(dest, src, x, y, blend / 100);
                break;
            case InkType.BackgroundTransparent:
                this.blitBgTransparent(dest, src, x, y, bgColor);
                break;
            // ... more modes
        }
    }

    private blitTransparent(dest: ImageData, src: ImageData, dx: number, dy: number): void {
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const si = (y * src.width + x) * 4;
                const r = src.data[si], g = src.data[si+1], b = src.data[si+2];

                // Skip white pixels
                if (r === 255 && g === 255 && b === 255) continue;

                const di = ((dy + y) * dest.width + (dx + x)) * 4;
                dest.data[di] = r;
                dest.data[di+1] = g;
                dest.data[di+2] = b;
                dest.data[di+3] = 255;
            }
        }
    }
}
```

---

## Score Parsing (New Implementation)

Since the existing JS viewer doesn't parse Score data, this must be implemented fresh using ScummVM as reference.

### Score Chunk Format (VWSC)

```typescript
// assembly/score/Score.ts

export class Score {
    frames: Frame[] = [];
    labels: Map<string, i32> = new Map();
    numChannels: i32 = 0;

    read(stream: ReadStream, version: i32): void {
        // Header
        const totalLength = stream.readUint32();
        const headerLength = stream.readUint32();
        const scriptOffset = stream.readUint32();
        const scriptLength = stream.readUint32();

        // Frame offsets table
        const numFrames = stream.readUint16();
        const frameOffsets: i32[] = [];
        for (let i = 0; i < numFrames; i++) {
            frameOffsets.push(stream.readUint32());
        }

        // Parse each frame
        for (let i = 0; i < numFrames; i++) {
            stream.seek(frameOffsets[i]);
            const frame = new Frame();
            frame.read(stream, version, this.numChannels);
            this.frames.push(frame);
        }
    }
}

export class Frame {
    channels: ChannelData[] = [];
    actionId: i16 = 0;
    transitionType: u8 = 0;
    transitionDuration: u8 = 0;
    tempo: i16 = 0;
    paletteId: i16 = 0;
    sound1: CastMemberID = new CastMemberID();
    sound2: CastMemberID = new CastMemberID();

    read(stream: ReadStream, version: i32, numChannels: i32): void {
        // Read frame header based on version
        if (version >= 500) {
            this.readD5Frame(stream, numChannels);
        } else {
            this.readD4Frame(stream, numChannels);
        }
    }

    private readD5Frame(stream: ReadStream, numChannels: i32): void {
        // Main channels (tempo, palette, transition, sound)
        this.actionId = stream.readInt16();
        this.transitionType = stream.readUint8();
        this.transitionDuration = stream.readUint8();
        // ... continue based on ScummVM frame.cpp

        // Sprite channels
        for (let i = 0; i < numChannels; i++) {
            const channel = new ChannelData();
            channel.read(stream, version);
            this.channels.push(channel);
        }
    }
}
```

---

## Validation Strategy

### 1. Chunk Parsing Validation

```typescript
// test/parser.test.ts
import { DirectorFile } from "../assembly/parser/DirectorFile";
import { parseWithJSViewer } from "./js-viewer-reference";

describe("DirectorFile parsing", () => {
    it("should match JS viewer chunk counts", async () => {
        const buffer = await loadTestFile("test-movie.dir");

        const wasmResult = DirectorFile.parse(buffer);
        const jsResult = parseWithJSViewer(buffer);

        expect(wasmResult.castCount).toBe(jsResult.castCount);
        expect(wasmResult.scriptCount).toBe(jsResult.scriptCount);
        expect(wasmResult.bitmapCount).toBe(jsResult.bitmapCount);
    });
});
```

### 2. Bitmap Decoding Validation

```typescript
// test/bitmap.test.ts
it("should produce identical RGBA output", async () => {
    const wasmBitmap = wasmDecoder.getBitmap(1, 5);
    const jsBitmap = jsDecoder.getBitmap(1, 5);

    expect(wasmBitmap.width).toBe(jsBitmap.width);
    expect(wasmBitmap.height).toBe(jsBitmap.height);

    // Pixel-by-pixel comparison
    for (let i = 0; i < wasmBitmap.data.length; i++) {
        expect(wasmBitmap.data[i]).toBe(jsBitmap.data[i]);
    }
});
```

### 3. Frame State Comparison

```typescript
// test/frame.test.ts
it("should extract matching channel positions", async () => {
    const wasmFrame = wasmPlayer.getFrame(1);
    const jsFrame = jsViewer.getFrameState(1);  // Need to add this to JS viewer

    for (let i = 0; i < wasmFrame.channels.length; i++) {
        expect(wasmFrame.channels[i].locH).toBe(jsFrame.channels[i].locH);
        expect(wasmFrame.channels[i].locV).toBe(jsFrame.channels[i].locV);
        expect(wasmFrame.channels[i].castMember).toBe(jsFrame.channels[i].castMember);
    }
});
```

---

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **AssemblyScript limitations** | Medium | Medium | Prototype complex features early; fallback to JS if needed |
| **Score format complexity** | High | High | Use ScummVM as authoritative reference |
| **Lingo VM performance** | Medium | Low | AssemblyScript compiles to efficient WASM |
| **Memory management** | Medium | Medium | Use AssemblyScript's incremental GC; pool objects |
| **JS/WASM boundary overhead** | Low | Medium | Minimize crossings; batch data transfers |
| **Version differences** | High | High | Target D6-D8 initially; add others later |

### AssemblyScript Limitations to Watch

1. **No closures** - Use class methods instead
2. **No union types** - Use class hierarchy
3. **Limited reflection** - Pre-define type handlers
4. **String handling** - Strings are objects, handle encoding carefully
5. **No exceptions** - Use return codes or nullable types

---

## Immediate Next Steps

### Week 1: Project Setup
1. Initialize npm project with AssemblyScript
2. Set up build pipeline (asc + esbuild)
3. Create basic test harness
4. Port `Stream.ts` class

### Week 2: Core Parsing
1. Port `Chunk.ts` base classes
2. Port `DirectorFile.ts`
3. Verify chunk extraction matches JS viewer
4. Export basic movie info to JS

### Week 3: Score Research
1. Study ScummVM `score.cpp`, `frame.cpp`
2. Document VWSC chunk format
3. Implement basic Score parsing
4. Extract frame/channel data

### Week 4: First Frame
1. Build TypeScript bridge
2. Port bitmap decoder
3. Create Canvas renderer
4. Display frame 1 of test movie

---

## Test Files Needed

To validate the implementation, collect test Director files:

1. **Simple animation** - No scripts, just sprite movement
2. **Button navigation** - Basic `on mouseUp` handlers
3. **Sound test** - Multiple sound channels
4. **Palette test** - Custom palettes, palette effects
5. **Ink test** - Various ink modes
6. **Text test** - Text cast members
7. **Complex movie** - Real-world content for compatibility testing

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Can load any D6-D8 .dir file without errors
- [ ] Frame 1 renders with correct sprite positions
- [ ] Bitmaps display with correct palettes
- [ ] Stage size and background color correct

### Phase 2 Complete When:
- [ ] Animations play at correct tempo
- [ ] Sound plays in sync
- [ ] Basic ink modes (copy, transparent, matte) work
- [ ] Playback controls functional

### Phase 3 Complete When:
- [ ] `on mouseDown/Up` handlers execute
- [ ] `go to frame` navigation works
- [ ] Simple interactive presentations functional
- [ ] Property access works (`the locH of sprite 1`)

### Full MVP When:
- [ ] 80% of test files play correctly
- [ ] Common Lingo commands supported
- [ ] Performance acceptable (60fps for simple content)
- [ ] Memory usage reasonable (<100MB for typical movies)
