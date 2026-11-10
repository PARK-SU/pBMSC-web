import { VbError, type VbErrorKind } from '../../core/vb.ts';

const dotNetMessages: Readonly<Record<VbErrorKind, string>> = {
  InvalidCast: 'Specified cast is not valid.',
  Format: 'Input string was not in a correct format.',
  Overflow: 'Arithmetic operation resulted in an overflow.',
  DivideByZero: 'Attempted to divide by zero.',
  Argument: 'Value does not fall within the expected range.',
  NullReference: 'Object reference not set to an instance of an object.',
  IO: 'I/O error occurred.',
  Arithmetic: 'Function does not accept floating point Not-a-Number values.',
  NotImplemented: 'The method or operation is not implemented.',
};

export function describeError(error: unknown): string {
  if (error instanceof VbError) return `${error.message}: ${dotNetMessages[error.kind]}`;
  if (error instanceof RangeError) {
    return `IndexOutOfRangeException: Index was outside the bounds of the array. (${error.message})`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
