/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Lingo value types that can be passed to/from Xtras
 */
export type LingoValue =
    | LingoVoid
    | LingoInteger
    | LingoFloat
    | LingoString
    | LingoSymbol
    | LingoList
    | LingoPropList
    | LingoXtraInstance;

export interface LingoVoid {
    type: 'void';
}

export interface LingoInteger {
    type: 'integer';
    value: number;
}

export interface LingoFloat {
    type: 'float';
    value: number;
}

export interface LingoString {
    type: 'string';
    value: string;
}

export interface LingoSymbol {
    type: 'symbol';
    value: string;
}

export interface LingoList {
    type: 'list';
    value: LingoValue[];
}

export interface LingoPropList {
    type: 'propList';
    value: Map<string | LingoSymbol, LingoValue>;
}

export interface LingoXtraInstance {
    type: 'xtraInstance';
    xtraName: string;
    instance: XtraInstance;
}

/**
 * Helper functions to create Lingo values
 */
export const Lingo = {
    void(): LingoVoid {
        return { type: 'void' };
    },

    integer(value: number): LingoInteger {
        return { type: 'integer', value: Math.floor(value) };
    },

    float(value: number): LingoFloat {
        return { type: 'float', value };
    },

    string(value: string): LingoString {
        return { type: 'string', value };
    },

    symbol(value: string): LingoSymbol {
        return { type: 'symbol', value };
    },

    list(value: LingoValue[]): LingoList {
        return { type: 'list', value };
    },

    propList(value: Map<string | LingoSymbol, LingoValue>): LingoPropList {
        return { type: 'propList', value };
    },

    /**
     * Convert a JavaScript value to a Lingo value
     */
    from(value: unknown): LingoValue {
        if (value === null || value === undefined) {
            return Lingo.void();
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? Lingo.integer(value) : Lingo.float(value);
        }
        if (typeof value === 'string') {
            return Lingo.string(value);
        }
        if (typeof value === 'boolean') {
            return Lingo.integer(value ? 1 : 0);
        }
        if (Array.isArray(value)) {
            return Lingo.list(value.map(v => Lingo.from(v)));
        }
        if (value instanceof Map) {
            return Lingo.propList(value as Map<string, LingoValue>);
        }
        if (typeof value === 'object' && value !== null) {
            const map = new Map<string, LingoValue>();
            for (const [k, v] of Object.entries(value)) {
                map.set(k, Lingo.from(v));
            }
            return Lingo.propList(map);
        }
        return Lingo.void();
    },

    /**
     * Convert a Lingo value to a JavaScript value
     */
    toJS(value: LingoValue): unknown {
        switch (value.type) {
            case 'void':
                return null;
            case 'integer':
            case 'float':
                return value.value;
            case 'string':
                return value.value;
            case 'symbol':
                return value.value;
            case 'list':
                return value.value.map(v => Lingo.toJS(v));
            case 'propList':
                const obj: Record<string, unknown> = {};
                for (const [k, v] of value.value.entries()) {
                    const key = typeof k === 'string' ? k : k.value;
                    obj[key] = Lingo.toJS(v);
                }
                return obj;
            case 'xtraInstance':
                return value.instance;
            default:
                return null;
        }
    },

    /**
     * Check if value is truthy in Lingo terms
     */
    isTruthy(value: LingoValue): boolean {
        switch (value.type) {
            case 'void':
                return false;
            case 'integer':
                return value.value !== 0;
            case 'float':
                return value.value !== 0;
            case 'string':
                return value.value.length > 0;
            case 'list':
                return value.value.length > 0;
            case 'propList':
                return value.value.size > 0;
            default:
                return true;
        }
    }
};

/**
 * Method call context passed to Xtra methods
 */
export interface XtraCallContext {
    /** The movie's current frame */
    currentFrame: number;
    /** Access to other Xtras */
    getXtra: (name: string) => XtraInstance | null;
    /** Log a message (goes to console) */
    log: (message: string) => void;
    /** Log a warning */
    warn: (message: string) => void;
    /** Log an error */
    error: (message: string) => void;
}

/**
 * Xtra instance - a created instance of an Xtra
 */
export interface XtraInstance {
    /** The Xtra definition this instance was created from */
    readonly xtra: XtraDefinition;
    /** Call a method on this instance */
    call(methodName: string, args: LingoValue[], context: XtraCallContext): LingoValue | Promise<LingoValue>;
    /** Get a property value */
    get(propertyName: string): LingoValue;
    /** Set a property value */
    set(propertyName: string, value: LingoValue): void;
    /** Clean up resources when instance is destroyed */
    dispose?(): void;
}

/**
 * Xtra method signature
 */
export type XtraMethod = (
    instance: XtraInstance,
    args: LingoValue[],
    context: XtraCallContext
) => LingoValue | Promise<LingoValue>;

/**
 * Xtra definition - defines an Xtra's interface and behavior
 */
export interface XtraDefinition {
    /** Unique name of the Xtra (e.g., "FileIO", "Multiuser") */
    readonly name: string;

    /** Human-readable description */
    readonly description?: string;

    /** Version string */
    readonly version?: string;

    /** Author/source */
    readonly author?: string;

    /** Available methods */
    readonly methods: ReadonlyMap<string, XtraMethod>;

    /** Default property values */
    readonly defaultProperties?: Record<string, LingoValue>;

    /** Create a new instance of this Xtra */
    createInstance(initArgs?: LingoValue[]): XtraInstance;
}

/**
 * Xtra registration info for the registry
 */
export interface XtraRegistration {
    definition: XtraDefinition;
    source: 'builtin' | 'user';
    loadedAt: Date;
}
