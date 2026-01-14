/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { XtraRegistry } from '../XtraRegistry.js';
import { FileIOXtra } from './FileIO.js';
import { MultiuserXtra } from './Multiuser.js';
import { NetLingoXtra } from './NetLingo.js';

export { FileIOXtra } from './FileIO.js';
export { MultiuserXtra } from './Multiuser.js';
export { NetLingoXtra } from './NetLingo.js';

/**
 * Register all built-in Xtras
 */
export function registerBuiltinXtras(): void {
    XtraRegistry.register(FileIOXtra, 'builtin');
    XtraRegistry.register(MultiuserXtra, 'builtin');
    XtraRegistry.register(NetLingoXtra, 'builtin');

    console.log('Built-in Xtras registered:', XtraRegistry.listNames().join(', '));
}

/**
 * List of all built-in Xtra definitions
 */
export const builtinXtras = [
    FileIOXtra,
    MultiuserXtra,
    NetLingoXtra
];
