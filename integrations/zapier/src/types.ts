import type { Bundle, ZObject } from 'zapier-platform-core';

export type { Bundle, ZObject };

// A trigger/create/search perform. Loosely typed return because Zapier maps
// the value into its own runtime envelope.
export type Perform<T = unknown> = (z: ZObject, bundle: Bundle) => Promise<T>;
