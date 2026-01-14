/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Director Web Player - Xtra Plugin System
 *
 * Xtras (eXtra) are plugins that extend Director's functionality.
 * In the original Director, Xtras were DLLs/shared libraries.
 * In the web player, they are JavaScript/TypeScript modules.
 *
 * @module xtra
 *
 * @example
 * ```typescript
 * import { XtraRegistry, SimpleXtra, Lingo } from './xtra';
 *
 * // Create a custom Xtra
 * const MyXtra = SimpleXtra.create({
 *     name: 'MyXtra',
 *     methods: {
 *         greet: (instance, args, ctx) => {
 *             return Lingo.string('Hello from MyXtra!');
 *         }
 *     }
 * });
 *
 * // Register it
 * XtraRegistry.register(MyXtra);
 *
 * // Use it (like `new xtra("MyXtra")` in Lingo)
 * const instance = XtraRegistry.createInstance('MyXtra');
 * const result = instance.call('greet', [], context);
 * ```
 */

// Core types
export {
    LingoValue,
    LingoVoid,
    LingoInteger,
    LingoFloat,
    LingoString,
    LingoSymbol,
    LingoList,
    LingoPropList,
    LingoXtraInstance,
    Lingo,
    XtraCallContext,
    XtraInstance,
    XtraMethod,
    XtraDefinition,
    XtraRegistration
} from './types.js';

// Registry and base classes
export {
    XtraRegistry,
    BaseXtraInstance,
    SimpleXtra
} from './XtraRegistry.js';

// Built-in Xtras
export {
    FileIOXtra,
    MultiuserXtra,
    NetLingoXtra,
    registerBuiltinXtras,
    builtinXtras
} from './builtin/index.js';
