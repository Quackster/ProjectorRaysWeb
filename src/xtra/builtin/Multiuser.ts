/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SimpleXtra } from '../XtraRegistry.js';
import { Lingo, LingoValue, XtraInstance, XtraCallContext } from '../types.js';

/**
 * Multiuser Xtra - Network connectivity for multiplayer/chat
 *
 * This provides WebSocket-based networking compatible with the
 * original Shockwave Multiuser Server protocol concepts.
 *
 * The original Multiuser Xtra was used for:
 * - Chat applications
 * - Multiplayer games (like Habbo Hotel)
 * - Real-time collaborative apps
 *
 * Common Lingo usage:
 * ```lingo
 * gMultiuser = new xtra("Multiuser")
 * err = gMultiuser.Initialize("ws://server:port")
 * err = gMultiuser.ConnectToNetServer()
 * gMultiuser.sendNetMessage("hello", "everyone", "Hi there!")
 * ```
 */
export const MultiuserXtra = SimpleXtra.create({
    name: 'Multiuser',
    description: 'Network connectivity for multiplayer applications',
    version: '1.0.0',
    author: 'Director Web Player',

    defaultProperties: {
        serverAddress: Lingo.string(''),
        movieID: Lingo.string(''),
        userID: Lingo.string(''),
        connectionStatus: Lingo.integer(0), // 0=disconnected, 1=connecting, 2=connected
        lastError: Lingo.string('')
    },

    methods: {
        /**
         * Initialize(serverAddress) - Set up connection parameters
         * Returns: 0 on success, negative on error
         */
        initialize: (instance, args, ctx) => {
            const serverAddress = args[0]?.type === 'string' ? args[0].value : '';

            if (!serverAddress) {
                instance.set('lastError', Lingo.string('No server address provided'));
                return Lingo.integer(-1);
            }

            instance.set('serverAddress', Lingo.string(serverAddress));
            instance.set('connectionStatus', Lingo.integer(0));
            ctx.log(`Multiuser initialized for: ${serverAddress}`);

            return Lingo.integer(0);
        },

        /**
         * ConnectToNetServer([movieID], [userID], [password]) - Connect to server
         */
        connecttonetserver: async (instance, args, ctx) => {
            const movieID = args[0]?.type === 'string' ? args[0].value : 'defaultMovie';
            const userID = args[1]?.type === 'string' ? args[1].value : 'user_' + Math.random().toString(36).slice(2, 8);
            const password = args[2]?.type === 'string' ? args[2].value : '';

            const serverAddress = instance.get('serverAddress');
            if (serverAddress.type !== 'string' || !serverAddress.value) {
                instance.set('lastError', Lingo.string('Not initialized'));
                return Lingo.integer(-1);
            }

            instance.set('movieID', Lingo.string(movieID));
            instance.set('userID', Lingo.string(userID));
            instance.set('connectionStatus', Lingo.integer(1)); // Connecting

            try {
                const ws = new WebSocket(serverAddress.value);

                ws.onopen = () => {
                    instance.set('connectionStatus', Lingo.integer(2)); // Connected
                    ctx.log('Connected to server');

                    // Send login message
                    ws.send(JSON.stringify({
                        type: 'login',
                        movieID,
                        userID,
                        password
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        // Store message for retrieval
                        const messages = (instance as any)._messages || [];
                        messages.push(data);
                        (instance as any)._messages = messages;
                    } catch (e) {
                        ctx.warn('Failed to parse message: ' + event.data);
                    }
                };

                ws.onerror = (error) => {
                    instance.set('lastError', Lingo.string('WebSocket error'));
                    instance.set('connectionStatus', Lingo.integer(0));
                    ctx.error('WebSocket error');
                };

                ws.onclose = () => {
                    instance.set('connectionStatus', Lingo.integer(0));
                    ctx.log('Disconnected from server');
                };

                (instance as any)._ws = ws;
                return Lingo.integer(0);

            } catch (e) {
                instance.set('lastError', Lingo.string(String(e)));
                instance.set('connectionStatus', Lingo.integer(0));
                return Lingo.integer(-1);
            }
        },

        /**
         * DisconnectFromServer() - Disconnect from server
         */
        disconnectfromserver: (instance, args, ctx) => {
            const ws = (instance as any)._ws as WebSocket | undefined;
            if (ws) {
                ws.close();
                (instance as any)._ws = null;
            }
            instance.set('connectionStatus', Lingo.integer(0));
            return Lingo.integer(0);
        },

        /**
         * sendNetMessage(subject, recipients, contents, [senderID])
         * Send a message to users
         */
        sendnetmessage: (instance, args, ctx) => {
            const ws = (instance as any)._ws as WebSocket | undefined;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                instance.set('lastError', Lingo.string('Not connected'));
                return Lingo.integer(-1);
            }

            const subject = args[0]?.type === 'string' ? args[0].value : '';
            const recipients = args[1]; // Can be string or list
            const contents = args[2]; // Can be any type
            const senderID = args[3]?.type === 'string' ? args[3].value :
                (instance.get('userID').type === 'string' ? (instance.get('userID') as any).value : '');

            // Convert recipients to array
            let recipientList: string[] = [];
            if (recipients?.type === 'string') {
                recipientList = [recipients.value];
            } else if (recipients?.type === 'list') {
                recipientList = recipients.value
                    .filter(v => v.type === 'string')
                    .map(v => (v as any).value);
            } else if (recipients?.type === 'symbol') {
                recipientList = [recipients.value];
            }

            const message = {
                type: 'message',
                subject,
                recipients: recipientList,
                contents: Lingo.toJS(contents),
                senderID,
                timestamp: Date.now()
            };

            try {
                ws.send(JSON.stringify(message));
                return Lingo.integer(0);
            } catch (e) {
                instance.set('lastError', Lingo.string(String(e)));
                return Lingo.integer(-1);
            }
        },

        /**
         * getNetMessage() - Get next incoming message
         * Returns: property list with message data or VOID if no messages
         */
        getnetmessage: (instance, args, ctx) => {
            const messages = (instance as any)._messages as any[] || [];

            if (messages.length === 0) {
                return Lingo.void();
            }

            const msg = messages.shift();
            (instance as any)._messages = messages;

            // Convert to Lingo propList format
            const propList = new Map<string, LingoValue>();
            propList.set('subject', Lingo.string(msg.subject || ''));
            propList.set('senderID', Lingo.string(msg.senderID || ''));
            propList.set('content', Lingo.from(msg.contents));
            propList.set('errorCode', Lingo.integer(msg.errorCode || 0));
            propList.set('timestamp', Lingo.integer(msg.timestamp || Date.now()));

            if (msg.recipients) {
                propList.set('recipients', Lingo.list(
                    msg.recipients.map((r: string) => Lingo.string(r))
                ));
            }

            return Lingo.propList(propList);
        },

        /**
         * waitForNetMessage(timeout) - Wait for a message (blocking)
         * Note: In browser, this is async and non-blocking
         */
        waitfornetmessage: async (instance, args, ctx) => {
            const timeout = args[0]?.type === 'integer' ? args[0].value : 5000;

            return new Promise<LingoValue>((resolve) => {
                const startTime = Date.now();

                const check = () => {
                    const messages = (instance as any)._messages as any[] || [];
                    if (messages.length > 0) {
                        resolve((MultiuserXtra.methods.get('getnetmessage')!)(instance, [], ctx));
                        return;
                    }

                    if (Date.now() - startTime > timeout) {
                        resolve(Lingo.void());
                        return;
                    }

                    setTimeout(check, 50);
                };

                check();
            });
        },

        /**
         * setNetMessageHandler(handler) - Set callback for messages
         * Note: In Director this was a Lingo handler name
         */
        setnetmessagehandler: (instance, args, ctx) => {
            const handler = args[0]?.type === 'string' ? args[0].value : '';
            (instance as any)._messageHandler = handler;
            ctx.log(`Message handler set to: ${handler}`);
            return Lingo.integer(0);
        },

        /**
         * getNetAddressCookie() - Get connection ID cookie
         */
        getnetaddresscookie: (instance, args, ctx) => {
            const userID = instance.get('userID');
            return userID.type === 'string' ? Lingo.string(userID.value) : Lingo.string('');
        },

        /**
         * getUserCount() - Get number of connected users (if server supports)
         */
        getusercount: (instance, args, ctx) => {
            // This would need server-side support
            return Lingo.integer(0);
        },

        /**
         * getGroupCount() - Get number of groups/rooms
         */
        getgroupcount: (instance, args, ctx) => {
            return Lingo.integer(0);
        },

        /**
         * connectionStatus() - Get connection status
         */
        connectionstatus: (instance, args, ctx) => {
            return instance.get('connectionStatus');
        },

        /**
         * peer-to-peer methods (stubs)
         */
        checknetmessages: (instance, args, ctx) => {
            const messages = (instance as any)._messages as any[] || [];
            return Lingo.integer(messages.length);
        }
    },

    onInit: (instance, args) => {
        // Initialize message queue
        (instance as any)._messages = [];

        // Auto-initialize if server address provided
        if (args && args.length > 0 && args[0].type === 'string') {
            instance.call('initialize', args, {
                currentFrame: 0,
                getXtra: () => null,
                log: console.log,
                warn: console.warn,
                error: console.error
            });
        }
    },

    onDispose: (instance) => {
        // Disconnect on dispose
        const ws = (instance as any)._ws as WebSocket | undefined;
        if (ws) {
            ws.close();
        }
    }
});
