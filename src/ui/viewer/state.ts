import type { ViewerChrome } from './controller.ts';

export function viewValue<T>(_chrome: ViewerChrome, value: T): T {
  return value;
}
