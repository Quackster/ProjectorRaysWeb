# Xtra Development Guide

This guide explains how to create custom Xtras (plugins) for the Director Web Player.

## What are Xtras?

In the original Macromedia/Adobe Director, **Xtras** were plugin libraries (DLLs on Windows, shared libraries on Mac) that extended Director's functionality. They were used for:

- File system access (FileIO Xtra)
- Network communication (NetLingo, Multiuser Xtras)
- Database connectivity
- 3D rendering
- Custom media formats
- Hardware interfaces

In the Director Web Player, Xtras are implemented as **JavaScript/TypeScript modules** that run in the browser. They provide the same Lingo API as the original Xtras but use web APIs under the hood.

## Quick Start

### Creating a Simple Xtra

```typescript
import { SimpleXtra, XtraRegistry, Lingo } from './src/xtra/index.js';

// Define your Xtra
const MyXtra = SimpleXtra.create({
    name: 'MyXtra',
    description: 'A simple example Xtra',
    version: '1.0.0',

    methods: {
        // Method: greet(name)
        greet: (instance, args, ctx) => {
            const name = args[0]?.type === 'string' ? args[0].value : 'World';
            return Lingo.string(`Hello, ${name}!`);
        },

        // Method: add(a, b)
        add: (instance, args, ctx) => {
            const a = args[0]?.type === 'integer' ? args[0].value : 0;
            const b = args[1]?.type === 'integer' ? args[1].value : 0;
            return Lingo.integer(a + b);
        }
    }
});

// Register it
XtraRegistry.register(MyXtra);
```

### Using Your Xtra in Lingo

```lingo
-- In Lingo (Director script)
myObj = new xtra("MyXtra")
put myObj.greet("Director")  -- "Hello, Director!"
put myObj.add(5, 3)          -- 8
```

## Xtra Architecture

### Lingo Value Types

Xtras communicate with Lingo using these value types:

| Type | TypeScript | Lingo Equivalent |
|------|------------|------------------|
| `void` | `Lingo.void()` | `VOID` |
| `integer` | `Lingo.integer(42)` | `42` |
| `float` | `Lingo.float(3.14)` | `3.14` |
| `string` | `Lingo.string("hello")` | `"hello"` |
| `symbol` | `Lingo.symbol("foo")` | `#foo` |
| `list` | `Lingo.list([...])` | `[1, 2, 3]` |
| `propList` | `Lingo.propList(map)` | `[#a: 1, #b: 2]` |

### The `Lingo` Helper Object

```typescript
import { Lingo, LingoValue } from './src/xtra/index.js';

// Creating values
const num = Lingo.integer(42);
const str = Lingo.string("hello");
const list = Lingo.list([Lingo.integer(1), Lingo.integer(2)]);

// Converting from JavaScript
const value = Lingo.from({ name: "test", count: 5 });

// Converting to JavaScript
const jsValue = Lingo.toJS(lingoValue);

// Check truthiness
if (Lingo.isTruthy(value)) { /* ... */ }
```

## Creating Xtras

### Method 1: SimpleXtra (Recommended)

Best for most use cases. Quick and declarative.

```typescript
const MyXtra = SimpleXtra.create({
    name: 'MyXtra',
    description: 'Optional description',
    version: '1.0.0',
    author: 'Your Name',

    // Default property values
    defaultProperties: {
        status: Lingo.integer(0),
        name: Lingo.string('')
    },

    // Methods callable from Lingo
    methods: {
        // Synchronous method
        getStatus: (instance, args, ctx) => {
            return instance.get('status');
        },

        // Async method (returns Promise)
        fetchData: async (instance, args, ctx) => {
            const url = args[0]?.type === 'string' ? args[0].value : '';
            const response = await fetch(url);
            const text = await response.text();
            return Lingo.string(text);
        }
    },

    // Called when instance is created
    onInit: (instance, args) => {
        console.log('Instance created with args:', args);
    },

    // Called when instance is destroyed
    onDispose: (instance) => {
        console.log('Instance disposed');
    }
});
```

### Method 2: BaseXtraInstance (Advanced)

For complex Xtras that need full control.

```typescript
import {
    XtraDefinition,
    XtraInstance,
    BaseXtraInstance,
    XtraMethod,
    LingoValue,
    Lingo
} from './src/xtra/index.js';

class MyXtraInstance extends BaseXtraInstance {
    readonly xtra: XtraDefinition;
    private socket: WebSocket | null = null;

    constructor(xtra: XtraDefinition) {
        super(xtra.defaultProperties);
        this.xtra = xtra;
    }

    // Override call for custom dispatch
    call(methodName: string, args: LingoValue[], context: XtraCallContext): LingoValue {
        // Custom pre-processing
        console.log(`Calling ${methodName}`);

        // Default dispatch
        return super.call(methodName, args, context);
    }

    // Cleanup
    dispose(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

const MyXtraDefinition: XtraDefinition = {
    name: 'MyAdvancedXtra',
    methods: new Map([
        ['connect', (instance, args, ctx) => {
            // Implementation
            return Lingo.integer(0);
        }]
    ]),

    createInstance(initArgs?: LingoValue[]): XtraInstance {
        return new MyXtraInstance(this);
    }
};

XtraRegistry.register(MyXtraDefinition);
```

## Method Signatures

### Method Parameters

```typescript
type XtraMethod = (
    instance: XtraInstance,  // The Xtra instance
    args: LingoValue[],      // Arguments from Lingo
    context: XtraCallContext // Runtime context
) => LingoValue | Promise<LingoValue>;
```

### Call Context

```typescript
interface XtraCallContext {
    currentFrame: number;                    // Movie's current frame
    getXtra: (name: string) => XtraInstance; // Access other Xtras
    log: (message: string) => void;          // Console log
    warn: (message: string) => void;         // Console warn
    error: (message: string) => void;        // Console error
}
```

### Example: Using Context

```typescript
const MyXtra = SimpleXtra.create({
    name: 'MyXtra',
    methods: {
        doWork: (instance, args, ctx) => {
            ctx.log(`Working on frame ${ctx.currentFrame}`);

            // Access another Xtra
            const fileIO = ctx.getXtra('FileIO');
            if (fileIO) {
                fileIO.call('openFile', [Lingo.string('data.txt'), Lingo.integer(1)], ctx);
            }

            return Lingo.void();
        }
    }
});
```

## Async Methods

Xtras can use async/await for non-blocking operations:

```typescript
methods: {
    fetchJSON: async (instance, args, ctx) => {
        const url = args[0]?.type === 'string' ? args[0].value : '';

        try {
            const response = await fetch(url);
            const data = await response.json();
            return Lingo.from(data);
        } catch (e) {
            ctx.error(`Fetch failed: ${e}`);
            return Lingo.void();
        }
    }
}
```

## Properties

Xtras can have properties that persist across method calls:

```typescript
const MyXtra = SimpleXtra.create({
    name: 'MyXtra',
    defaultProperties: {
        counter: Lingo.integer(0),
        name: Lingo.string('default')
    },
    methods: {
        increment: (instance, args, ctx) => {
            const current = instance.get('counter');
            const value = current.type === 'integer' ? current.value : 0;
            instance.set('counter', Lingo.integer(value + 1));
            return instance.get('counter');
        },

        setName: (instance, args, ctx) => {
            const name = args[0]?.type === 'string' ? args[0].value : '';
            instance.set('name', Lingo.string(name));
            return Lingo.void();
        }
    }
});
```

## Complete Example: Database Xtra

Here's a more complete example of a LocalStorage-based "database" Xtra:

```typescript
// src/xtra/custom/DatabaseXtra.ts

import { SimpleXtra, Lingo, LingoValue } from '../index.js';

export const DatabaseXtra = SimpleXtra.create({
    name: 'Database',
    description: 'LocalStorage-based key-value database',
    version: '1.0.0',

    defaultProperties: {
        dbName: Lingo.string('default'),
        lastError: Lingo.string('')
    },

    methods: {
        /**
         * open(dbName) - Open/create a database
         */
        open: (instance, args, ctx) => {
            const dbName = args[0]?.type === 'string' ? args[0].value : 'default';
            instance.set('dbName', Lingo.string(dbName));
            ctx.log(`Database opened: ${dbName}`);
            return Lingo.integer(0);
        },

        /**
         * put(key, value) - Store a value
         */
        put: (instance, args, ctx) => {
            const key = args[0]?.type === 'string' ? args[0].value : '';
            const value = args[1];

            if (!key) {
                instance.set('lastError', Lingo.string('Key required'));
                return Lingo.integer(-1);
            }

            const dbName = instance.get('dbName');
            const prefix = dbName.type === 'string' ? dbName.value : 'default';

            try {
                localStorage.setItem(
                    `db:${prefix}:${key}`,
                    JSON.stringify(Lingo.toJS(value))
                );
                return Lingo.integer(0);
            } catch (e) {
                instance.set('lastError', Lingo.string(String(e)));
                return Lingo.integer(-1);
            }
        },

        /**
         * get(key) - Retrieve a value
         */
        get: (instance, args, ctx) => {
            const key = args[0]?.type === 'string' ? args[0].value : '';
            const dbName = instance.get('dbName');
            const prefix = dbName.type === 'string' ? dbName.value : 'default';

            const raw = localStorage.getItem(`db:${prefix}:${key}`);
            if (raw === null) {
                return Lingo.void();
            }

            try {
                return Lingo.from(JSON.parse(raw));
            } catch {
                return Lingo.string(raw);
            }
        },

        /**
         * delete(key) - Remove a value
         */
        delete: (instance, args, ctx) => {
            const key = args[0]?.type === 'string' ? args[0].value : '';
            const dbName = instance.get('dbName');
            const prefix = dbName.type === 'string' ? dbName.value : 'default';

            localStorage.removeItem(`db:${prefix}:${key}`);
            return Lingo.integer(0);
        },

        /**
         * keys() - List all keys in database
         */
        keys: (instance, args, ctx) => {
            const dbName = instance.get('dbName');
            const prefix = dbName.type === 'string' ? `db:${dbName.value}:` : 'db:default:';

            const keys: LingoValue[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keys.push(Lingo.string(key.slice(prefix.length)));
                }
            }

            return Lingo.list(keys);
        },

        /**
         * clear() - Remove all data in database
         */
        clear: (instance, args, ctx) => {
            const dbName = instance.get('dbName');
            const prefix = dbName.type === 'string' ? `db:${dbName.value}:` : 'db:default:';

            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }

            for (const key of keysToRemove) {
                localStorage.removeItem(key);
            }

            return Lingo.integer(keysToRemove.length);
        }
    }
});
```

**Usage in Lingo:**

```lingo
db = new xtra("Database")
db.open("myApp")
db.put("user", [#name: "John", #score: 100])
userData = db.get("user")
put userData.name  -- "John"
allKeys = db.keys()
```

## Registering Custom Xtras

### At Startup

```typescript
// main.ts
import { XtraRegistry, registerBuiltinXtras } from './src/xtra/index.js';
import { DatabaseXtra } from './src/xtra/custom/DatabaseXtra.js';

// Register built-in Xtras
registerBuiltinXtras();

// Register custom Xtras
XtraRegistry.register(DatabaseXtra);

// List all available Xtras
console.log('Available Xtras:', XtraRegistry.listNames());
```

### Dynamic Loading

```typescript
// Load Xtra from URL (e.g., user plugins)
async function loadXtraFromURL(url: string): Promise<void> {
    const module = await import(url);
    if (module.default && typeof module.default === 'object') {
        XtraRegistry.register(module.default);
    }
}
```

## Built-in Xtras Reference

### FileIO

File system operations (browser-sandboxed).

```lingo
fileObj = new xtra("FileIO")
fileObj.displayOpen()           -- Show file picker
fileObj.openFile("path", mode)  -- mode: 1=read, 2=write, 3=append
content = fileObj.readFile()
fileObj.writeString("text")
fileObj.closeFile()
```

### Multiuser

WebSocket-based networking.

```lingo
conn = new xtra("Multiuser")
conn.Initialize("ws://server:port")
conn.ConnectToNetServer("movieID", "userID", "password")
conn.sendNetMessage("subject", "recipient", "content")
msg = conn.getNetMessage()
conn.DisconnectFromServer()
```

### NetLingo

HTTP requests.

```lingo
net = new xtra("NetLingo")
net.netRequest("https://api.example.com/data")
if net.netDone() = 0 then
    data = net.netTextResult()
end if
```

## Best Practices

1. **Method Names**: Use lowercase method names in the `methods` object. The registry normalizes names to lowercase.

2. **Error Handling**: Set an `error` or `lastError` property and return error codes rather than throwing exceptions.

3. **Async Operations**: Use async/await for I/O operations. The Lingo VM handles Promises automatically.

4. **Cleanup**: Implement `onDispose` to clean up resources (WebSockets, timers, etc.).

5. **Browser APIs**: Remember that Xtras run in the browser. Use web APIs (fetch, localStorage, WebSocket, etc.) instead of Node.js APIs.

6. **Type Safety**: Always validate argument types before using them:

```typescript
const value = args[0]?.type === 'string' ? args[0].value : 'default';
```

## Debugging

```typescript
methods: {
    debugMethod: (instance, args, ctx) => {
        // Use context logging
        ctx.log('Debug: method called');
        ctx.warn('Debug: warning message');
        ctx.error('Debug: error message');

        // Inspect arguments
        console.log('Args:', args.map(a => Lingo.toJS(a)));

        // Inspect properties
        console.log('Properties:', Array.from((instance as any).properties.entries()));

        return Lingo.void();
    }
}
```

## Migration from Original Xtras

When porting an original Director Xtra to the web player:

1. **Identify methods**: List all methods the original Xtra exposed
2. **Map to web APIs**: Find browser equivalents for native operations
3. **Handle limitations**: Document features that can't work in browser
4. **Test compatibility**: Test with real Director content that uses the Xtra

### Example: Original FileIO → Web FileIO

| Original | Web Implementation |
|----------|-------------------|
| File system access | File System Access API / localStorage |
| Synchronous I/O | Async operations with Promises |
| Native paths | Virtual paths or file handles |
| Binary files | ArrayBuffer / Blob |

## Need Help?

- Check the built-in Xtras in `src/xtra/builtin/` for examples
- Review the type definitions in `src/xtra/types.ts`
- Open an issue on GitHub for questions
