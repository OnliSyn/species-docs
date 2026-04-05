'use client';

import { type ComponentType } from 'react';

type GenUIProps<T = Record<string, unknown>> = {
  data: T;
};

type GenUIComponent = ComponentType<GenUIProps>;

const registry = new Map<string, GenUIComponent>();

export function registerUIComponent(key: string, component: GenUIComponent): void {
  registry.set(key, component);
}

export function getUIComponent(key: string): GenUIComponent | undefined {
  return registry.get(key);
}

export function hasUIComponent(result: unknown): result is { _ui: string; [key: string]: unknown } {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_ui' in result &&
    typeof (result as Record<string, unknown>)._ui === 'string' &&
    registry.has((result as Record<string, unknown>)._ui as string)
  );
}

export type { GenUIProps, GenUIComponent };
