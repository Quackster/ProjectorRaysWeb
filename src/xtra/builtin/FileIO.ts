/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SimpleXtra } from '../XtraRegistry.js';
import { Lingo, LingoValue, XtraInstance, XtraCallContext } from '../types.js';

/**
 * FileIO Xtra - File system operations
 *
 * This is a browser-compatible implementation that uses:
 * - File System Access API (where available)
 * - localStorage/IndexedDB for persistence
 * - In-memory storage as fallback
 *
 * Note: Due to browser security, this cannot access the real file system
 * without user interaction. It provides a virtualized file system.
 *
 * Common Lingo usage:
 * ```lingo
 * fileObj = new xtra("FileIO")
 * fileObj.openFile("myfile.txt", 1)  -- 1 = read mode
 * content = fileObj.readFile()
 * fileObj.closeFile()
 * ```
 */
export const FileIOXtra = SimpleXtra.create({
    name: 'FileIO',
    description: 'File system operations (browser-sandboxed)',
    version: '1.0.0',
    author: 'Director Web Player',

    defaultProperties: {
        fileName: Lingo.string(''),
        status: Lingo.integer(0),
        position: Lingo.integer(0),
        length: Lingo.integer(0),
        error: Lingo.string('')
    },

    methods: {
        /**
         * displayOpen() - Show file picker dialog
         * Returns: file path string or empty string if cancelled
         */
        displayopen: async (instance, args, ctx) => {
            try {
                if ('showOpenFilePicker' in window) {
                    const [fileHandle] = await (window as any).showOpenFilePicker();
                    const file = await fileHandle.getFile();
                    const content = await file.text();

                    // Store file info
                    (instance as any)._fileHandle = fileHandle;
                    (instance as any)._content = content;
                    (instance as any)._position = 0;

                    instance.set('fileName', Lingo.string(file.name));
                    instance.set('length', Lingo.integer(content.length));
                    instance.set('status', Lingo.integer(1));

                    return Lingo.string(file.name);
                } else {
                    ctx.warn('File System Access API not available');
                    return Lingo.string('');
                }
            } catch (e) {
                instance.set('error', Lingo.string(String(e)));
                return Lingo.string('');
            }
        },

        /**
         * displaySave(title, defaultName) - Show save dialog
         */
        displaysave: async (instance, args, ctx) => {
            const title = args[0]?.type === 'string' ? args[0].value : 'Save File';
            const defaultName = args[1]?.type === 'string' ? args[1].value : 'untitled.txt';

            try {
                if ('showSaveFilePicker' in window) {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: defaultName
                    });
                    (instance as any)._fileHandle = handle;
                    instance.set('fileName', Lingo.string(defaultName));
                    instance.set('status', Lingo.integer(2)); // Write mode
                    return Lingo.string(defaultName);
                } else {
                    ctx.warn('File System Access API not available');
                    return Lingo.string('');
                }
            } catch (e) {
                instance.set('error', Lingo.string(String(e)));
                return Lingo.string('');
            }
        },

        /**
         * openFile(path, mode) - Open a file
         * mode: 0 = closed, 1 = read, 2 = write, 3 = append
         */
        openfile: (instance, args, ctx) => {
            const path = args[0]?.type === 'string' ? args[0].value : '';
            const mode = args[1]?.type === 'integer' ? args[1].value : 1;

            // In browser, we use virtual storage
            const storageKey = `fileio:${path}`;
            const content = localStorage.getItem(storageKey) || '';

            (instance as any)._path = path;
            (instance as any)._content = content;
            (instance as any)._position = 0;
            (instance as any)._mode = mode;

            instance.set('fileName', Lingo.string(path));
            instance.set('status', Lingo.integer(mode));
            instance.set('length', Lingo.integer(content.length));
            instance.set('position', Lingo.integer(0));

            return Lingo.integer(1); // Success
        },

        /**
         * closeFile() - Close the current file
         */
        closefile: (instance, args, ctx) => {
            const mode = (instance as any)._mode || 0;
            const path = (instance as any)._path || '';
            const content = (instance as any)._content || '';

            // Save content if in write mode
            if ((mode === 2 || mode === 3) && path) {
                localStorage.setItem(`fileio:${path}`, content);
            }

            (instance as any)._content = null;
            (instance as any)._path = null;
            (instance as any)._position = 0;
            (instance as any)._mode = 0;

            instance.set('status', Lingo.integer(0));
            return Lingo.void();
        },

        /**
         * readFile() - Read entire file contents
         */
        readfile: (instance, args, ctx) => {
            const content = (instance as any)._content || '';
            return Lingo.string(content);
        },

        /**
         * readLine() - Read one line
         */
        readline: (instance, args, ctx) => {
            const content = (instance as any)._content || '';
            const position = (instance as any)._position || 0;

            const remaining = content.slice(position);
            const lineEnd = remaining.indexOf('\n');

            if (lineEnd === -1) {
                (instance as any)._position = content.length;
                instance.set('position', Lingo.integer(content.length));
                return Lingo.string(remaining);
            }

            const line = remaining.slice(0, lineEnd);
            (instance as any)._position = position + lineEnd + 1;
            instance.set('position', Lingo.integer((instance as any)._position));

            return Lingo.string(line);
        },

        /**
         * readChar() - Read one character
         */
        readchar: (instance, args, ctx) => {
            const content = (instance as any)._content || '';
            const position = (instance as any)._position || 0;

            if (position >= content.length) {
                return Lingo.string('');
            }

            const char = content[position];
            (instance as any)._position = position + 1;
            instance.set('position', Lingo.integer(position + 1));

            return Lingo.string(char);
        },

        /**
         * readWord() - Read one word (whitespace-delimited)
         */
        readword: (instance, args, ctx) => {
            const content = (instance as any)._content || '';
            let position = (instance as any)._position || 0;

            // Skip leading whitespace
            while (position < content.length && /\s/.test(content[position])) {
                position++;
            }

            // Read until whitespace
            let word = '';
            while (position < content.length && !/\s/.test(content[position])) {
                word += content[position];
                position++;
            }

            (instance as any)._position = position;
            instance.set('position', Lingo.integer(position));

            return Lingo.string(word);
        },

        /**
         * writeString(str) - Write a string
         */
        writestring: (instance, args, ctx) => {
            const str = args[0]?.type === 'string' ? args[0].value : '';
            const mode = (instance as any)._mode || 0;

            if (mode !== 2 && mode !== 3) {
                ctx.error('File not open for writing');
                return Lingo.integer(0);
            }

            const content = (instance as any)._content || '';
            const position = (instance as any)._position || 0;

            if (mode === 3) {
                // Append mode
                (instance as any)._content = content + str;
            } else {
                // Write mode - insert at position
                (instance as any)._content = content.slice(0, position) + str + content.slice(position);
            }

            (instance as any)._position = position + str.length;
            instance.set('position', Lingo.integer((instance as any)._position));
            instance.set('length', Lingo.integer(((instance as any)._content || '').length));

            return Lingo.integer(str.length);
        },

        /**
         * writeChar(char) - Write a single character
         */
        writechar: (instance, args, ctx) => {
            const char = args[0]?.type === 'string' ? args[0].value[0] || '' : '';
            return (FileIOXtra.methods.get('writestring')!)(instance, [Lingo.string(char)], ctx);
        },

        /**
         * setPosition(pos) - Set read/write position
         */
        setposition: (instance, args, ctx) => {
            const pos = args[0]?.type === 'integer' ? args[0].value : 0;
            (instance as any)._position = pos;
            instance.set('position', Lingo.integer(pos));
            return Lingo.void();
        },

        /**
         * getPosition() - Get current position
         */
        getposition: (instance, args, ctx) => {
            return Lingo.integer((instance as any)._position || 0);
        },

        /**
         * getLength() - Get file length
         */
        getlength: (instance, args, ctx) => {
            const content = (instance as any)._content || '';
            return Lingo.integer(content.length);
        },

        /**
         * delete() - Delete a file
         */
        delete: (instance, args, ctx) => {
            const path = args[0]?.type === 'string' ? args[0].value : (instance as any)._path;
            if (path) {
                localStorage.removeItem(`fileio:${path}`);
                return Lingo.integer(1);
            }
            return Lingo.integer(0);
        },

        /**
         * getOSDirectory() - Get OS directory path
         * Note: Returns virtual path in browser
         */
        getosdirectory: (instance, args, ctx) => {
            return Lingo.string('/virtual/');
        },

        /**
         * fileName() - Get current file name
         */
        filename: (instance, args, ctx) => {
            return instance.get('fileName');
        },

        /**
         * status() - Get file status
         */
        status: (instance, args, ctx) => {
            return instance.get('status');
        },

        /**
         * error() - Get last error
         */
        error: (instance, args, ctx) => {
            return instance.get('error');
        }
    },

    onDispose: (instance) => {
        // Auto-close file on dispose
        const mode = (instance as any)._mode || 0;
        if (mode !== 0) {
            (FileIOXtra.methods.get('closefile')!)(
                instance,
                [],
                { currentFrame: 0, getXtra: () => null, log: console.log, warn: console.warn, error: console.error }
            );
        }
    }
});
