/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    XtraDefinition,
    XtraInstance,
    XtraRegistration,
    XtraCallContext,
    LingoValue,
    Lingo
} from './types.js';

/**
 * XtraRegistry - Central registry for all Xtras
 *
 * This manages Xtra registration, instantiation, and lifecycle.
 * Use this to register custom Xtras or access built-in ones.
 *
 * @example
 * ```typescript
 * // Register a custom Xtra
 * XtraRegistry.register(myXtraDefinition);
 *
 * // Create an instance (like `new xtra("MyXtra")` in Lingo)
 * const instance = XtraRegistry.createInstance("MyXtra");
 *
 * // Call a method
 * const result = instance.call("myMethod", [Lingo.string("arg")], context);
 * ```
 */
export class XtraRegistry {
    private static xtras: Map<string, XtraRegistration> = new Map();
    private static instances: Map<string, XtraInstance[]> = new Map();

    /**
     * Register an Xtra definition
     * @param definition The Xtra definition to register
     * @param source Whether this is a built-in or user Xtra
     */
    static register(definition: XtraDefinition, source: 'builtin' | 'user' = 'user'): void {
        const name = definition.name.toLowerCase();

        if (this.xtras.has(name)) {
            console.warn(`Xtra "${definition.name}" is already registered. Overwriting.`);
        }

        this.xtras.set(name, {
            definition,
            source,
            loadedAt: new Date()
        });

        console.log(`Registered Xtra: ${definition.name} (${source})`);
    }

    /**
     * Unregister an Xtra
     * @param name Name of the Xtra to unregister
     */
    static unregister(name: string): boolean {
        const normalizedName = name.toLowerCase();
        const registration = this.xtras.get(normalizedName);

        if (!registration) {
            return false;
        }

        // Dispose all instances
        const instances = this.instances.get(normalizedName) || [];
        for (const instance of instances) {
            if (instance.dispose) {
                instance.dispose();
            }
        }
        this.instances.delete(normalizedName);

        this.xtras.delete(normalizedName);
        return true;
    }

    /**
     * Check if an Xtra is registered
     * @param name Name of the Xtra
     */
    static has(name: string): boolean {
        return this.xtras.has(name.toLowerCase());
    }

    /**
     * Get an Xtra definition
     * @param name Name of the Xtra
     */
    static get(name: string): XtraDefinition | null {
        const registration = this.xtras.get(name.toLowerCase());
        return registration?.definition ?? null;
    }

    /**
     * Get registration info for an Xtra
     * @param name Name of the Xtra
     */
    static getRegistration(name: string): XtraRegistration | null {
        return this.xtras.get(name.toLowerCase()) ?? null;
    }

    /**
     * Create a new instance of an Xtra
     * This is equivalent to `new xtra("XtraName")` in Lingo
     *
     * @param name Name of the Xtra
     * @param initArgs Optional initialization arguments
     */
    static createInstance(name: string, initArgs?: LingoValue[]): XtraInstance | null {
        const normalizedName = name.toLowerCase();
        const registration = this.xtras.get(normalizedName);

        if (!registration) {
            console.error(`Xtra "${name}" not found. Available Xtras: ${this.listNames().join(', ')}`);
            return null;
        }

        try {
            const instance = registration.definition.createInstance(initArgs);

            // Track instance for cleanup
            if (!this.instances.has(normalizedName)) {
                this.instances.set(normalizedName, []);
            }
            this.instances.get(normalizedName)!.push(instance);

            return instance;
        } catch (error) {
            console.error(`Failed to create instance of Xtra "${name}":`, error);
            return null;
        }
    }

    /**
     * List all registered Xtra names
     */
    static listNames(): string[] {
        return Array.from(this.xtras.values()).map(r => r.definition.name);
    }

    /**
     * List all registered Xtras with their info
     */
    static list(): XtraRegistration[] {
        return Array.from(this.xtras.values());
    }

    /**
     * Get count of active instances for an Xtra
     */
    static getInstanceCount(name: string): number {
        return this.instances.get(name.toLowerCase())?.length ?? 0;
    }

    /**
     * Dispose all instances of an Xtra
     */
    static disposeInstances(name: string): void {
        const normalizedName = name.toLowerCase();
        const instances = this.instances.get(normalizedName) || [];

        for (const instance of instances) {
            if (instance.dispose) {
                instance.dispose();
            }
        }

        this.instances.set(normalizedName, []);
    }

    /**
     * Dispose all Xtra instances (cleanup)
     */
    static disposeAll(): void {
        for (const [name, instances] of this.instances.entries()) {
            for (const instance of instances) {
                if (instance.dispose) {
                    instance.dispose();
                }
            }
        }
        this.instances.clear();
    }

    /**
     * Create the default call context
     */
    static createContext(currentFrame: number = 1): XtraCallContext {
        return {
            currentFrame,
            getXtra: (name: string) => this.createInstance(name),
            log: (message: string) => console.log(`[Xtra] ${message}`),
            warn: (message: string) => console.warn(`[Xtra] ${message}`),
            error: (message: string) => console.error(`[Xtra] ${message}`)
        };
    }
}

/**
 * BaseXtraInstance - Base class for Xtra instances
 *
 * Extend this class to create custom Xtra instances with
 * automatic property management and method dispatch.
 */
export abstract class BaseXtraInstance implements XtraInstance {
    abstract readonly xtra: XtraDefinition;

    protected properties: Map<string, LingoValue> = new Map();

    constructor(defaultProperties?: Record<string, LingoValue>) {
        if (defaultProperties) {
            for (const [key, value] of Object.entries(defaultProperties)) {
                this.properties.set(key.toLowerCase(), value);
            }
        }
    }

    call(methodName: string, args: LingoValue[], context: XtraCallContext): LingoValue | Promise<LingoValue> {
        const normalizedName = methodName.toLowerCase();
        const method = this.xtra.methods.get(normalizedName);

        if (!method) {
            context.warn(`Method "${methodName}" not found on Xtra "${this.xtra.name}"`);
            return Lingo.void();
        }

        return method(this, args, context);
    }

    get(propertyName: string): LingoValue {
        return this.properties.get(propertyName.toLowerCase()) ?? Lingo.void();
    }

    set(propertyName: string, value: LingoValue): void {
        this.properties.set(propertyName.toLowerCase(), value);
    }

    dispose?(): void {
        // Override in subclasses for cleanup
    }
}

/**
 * SimpleXtra - Helper to create simple Xtras without subclassing
 *
 * @example
 * ```typescript
 * const myXtra = SimpleXtra.create({
 *     name: "MyXtra",
 *     methods: {
 *         greet: (instance, args, ctx) => {
 *             const name = args[0]?.type === 'string' ? args[0].value : 'World';
 *             return Lingo.string(`Hello, ${name}!`);
 *         }
 *     }
 * });
 *
 * XtraRegistry.register(myXtra);
 * ```
 */
export class SimpleXtra {
    static create(config: {
        name: string;
        description?: string;
        version?: string;
        author?: string;
        methods?: Record<string, (instance: XtraInstance, args: LingoValue[], ctx: XtraCallContext) => LingoValue | Promise<LingoValue>>;
        defaultProperties?: Record<string, LingoValue>;
        onInit?: (instance: XtraInstance, args?: LingoValue[]) => void;
        onDispose?: (instance: XtraInstance) => void;
    }): XtraDefinition {
        const methodMap = new Map<string, (instance: XtraInstance, args: LingoValue[], ctx: XtraCallContext) => LingoValue | Promise<LingoValue>>();

        if (config.methods) {
            for (const [name, method] of Object.entries(config.methods)) {
                methodMap.set(name.toLowerCase(), method);
            }
        }

        const definition: XtraDefinition = {
            name: config.name,
            description: config.description,
            version: config.version,
            author: config.author,
            methods: methodMap,
            defaultProperties: config.defaultProperties,

            createInstance(initArgs?: LingoValue[]): XtraInstance {
                const instance = new SimpleXtraInstance(definition, config.defaultProperties);

                if (config.onInit) {
                    config.onInit(instance, initArgs);
                }

                if (config.onDispose) {
                    instance._onDispose = config.onDispose;
                }

                return instance;
            }
        };

        return definition;
    }
}

class SimpleXtraInstance extends BaseXtraInstance {
    readonly xtra: XtraDefinition;
    _onDispose?: (instance: XtraInstance) => void;

    constructor(xtra: XtraDefinition, defaultProperties?: Record<string, LingoValue>) {
        super(defaultProperties);
        this.xtra = xtra;
    }

    dispose(): void {
        if (this._onDispose) {
            this._onDispose(this);
        }
    }
}
