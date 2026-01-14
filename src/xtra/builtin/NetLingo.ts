/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SimpleXtra } from '../XtraRegistry.js';
import { Lingo, LingoValue, XtraInstance, XtraCallContext } from '../types.js';

/**
 * NetLingo Xtra - HTTP networking operations
 *
 * Provides HTTP GET/POST functionality using the Fetch API.
 * This is a modern replacement for the original NetLingo Xtra
 * that was used for web requests in Director.
 *
 * Common Lingo usage:
 * ```lingo
 * netObj = new xtra("NetLingo")
 * netObj.netRequest("https://api.example.com/data")
 * status = netObj.netDone()
 * if status = 0 then
 *   data = netObj.netTextResult()
 * end if
 * ```
 */
export const NetLingoXtra = SimpleXtra.create({
    name: 'NetLingo',
    description: 'HTTP networking operations',
    version: '1.0.0',
    author: 'Director Web Player',

    defaultProperties: {
        url: Lingo.string(''),
        status: Lingo.integer(0), // 0=idle, 1=pending, 2=complete, -1=error
        lastError: Lingo.string(''),
        result: Lingo.string('')
    },

    methods: {
        /**
         * netRequest(url) - Start a GET request
         */
        netrequest: async (instance, args, ctx) => {
            const url = args[0]?.type === 'string' ? args[0].value : '';

            if (!url) {
                instance.set('lastError', Lingo.string('No URL provided'));
                instance.set('status', Lingo.integer(-1));
                return Lingo.integer(-1);
            }

            instance.set('url', Lingo.string(url));
            instance.set('status', Lingo.integer(1)); // Pending
            instance.set('result', Lingo.string(''));
            instance.set('lastError', Lingo.string(''));

            try {
                const response = await fetch(url);
                const text = await response.text();

                if (response.ok) {
                    instance.set('result', Lingo.string(text));
                    instance.set('status', Lingo.integer(2)); // Complete
                    (instance as any)._response = response;
                    (instance as any)._result = text;
                    return Lingo.integer(0);
                } else {
                    instance.set('lastError', Lingo.string(`HTTP ${response.status}: ${response.statusText}`));
                    instance.set('status', Lingo.integer(-1));
                    return Lingo.integer(-1);
                }
            } catch (e) {
                instance.set('lastError', Lingo.string(String(e)));
                instance.set('status', Lingo.integer(-1));
                return Lingo.integer(-1);
            }
        },

        /**
         * postNetText(url, data) - POST text data
         */
        postnettext: async (instance, args, ctx) => {
            const url = args[0]?.type === 'string' ? args[0].value : '';
            const data = args[1]?.type === 'string' ? args[1].value : '';

            if (!url) {
                instance.set('lastError', Lingo.string('No URL provided'));
                instance.set('status', Lingo.integer(-1));
                return Lingo.integer(-1);
            }

            instance.set('url', Lingo.string(url));
            instance.set('status', Lingo.integer(1));

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    body: data,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const text = await response.text();

                if (response.ok) {
                    instance.set('result', Lingo.string(text));
                    instance.set('status', Lingo.integer(2));
                    return Lingo.integer(0);
                } else {
                    instance.set('lastError', Lingo.string(`HTTP ${response.status}`));
                    instance.set('status', Lingo.integer(-1));
                    return Lingo.integer(-1);
                }
            } catch (e) {
                instance.set('lastError', Lingo.string(String(e)));
                instance.set('status', Lingo.integer(-1));
                return Lingo.integer(-1);
            }
        },

        /**
         * netDone() - Check if request is complete
         * Returns: 0=complete, 1=pending, -1=error
         */
        netdone: (instance, args, ctx) => {
            const status = instance.get('status');
            if (status.type === 'integer') {
                // Map internal status to Director convention
                if (status.value === 2) return Lingo.integer(0);  // Complete = 0
                if (status.value === 1) return Lingo.integer(1);  // Pending = 1
                if (status.value === -1) return Lingo.integer(-1); // Error = -1
            }
            return Lingo.integer(1); // Default to pending
        },

        /**
         * netTextResult() - Get result text
         */
        nettextresult: (instance, args, ctx) => {
            return instance.get('result');
        },

        /**
         * netError() - Get last error
         */
        neterror: (instance, args, ctx) => {
            return instance.get('lastError');
        },

        /**
         * netAbort() - Cancel pending request
         */
        netabort: (instance, args, ctx) => {
            // In modern Fetch API, we'd need AbortController
            // For simplicity, just mark as aborted
            instance.set('status', Lingo.integer(-1));
            instance.set('lastError', Lingo.string('Request aborted'));
            return Lingo.void();
        },

        /**
         * getNetText(url) - Synchronous-style get (actually async)
         */
        getnettext: async (instance, args, ctx) => {
            await (NetLingoXtra.methods.get('netrequest')!)(instance, args, ctx);
            return instance.get('result');
        },

        /**
         * urlEncode(text) - URL encode a string
         */
        urlencode: (instance, args, ctx) => {
            const text = args[0]?.type === 'string' ? args[0].value : '';
            return Lingo.string(encodeURIComponent(text));
        },

        /**
         * urlDecode(text) - URL decode a string
         */
        urldecode: (instance, args, ctx) => {
            const text = args[0]?.type === 'string' ? args[0].value : '';
            try {
                return Lingo.string(decodeURIComponent(text));
            } catch {
                return Lingo.string(text);
            }
        },

        /**
         * externalEvent(eventName, ...args) - Dispatch browser event
         */
        externalevent: (instance, args, ctx) => {
            const eventName = args[0]?.type === 'string' ? args[0].value : 'lingoEvent';
            const eventArgs = args.slice(1).map(a => Lingo.toJS(a));

            const event = new CustomEvent(eventName, {
                detail: { args: eventArgs }
            });
            window.dispatchEvent(event);

            return Lingo.void();
        }
    }
});
