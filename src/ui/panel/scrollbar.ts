import type { ScrollRange } from '../../editor/view.ts';

export const maxScrollContentSize = 10_000_000;

export function scrollContentSize(range: ScrollRange, viewport: number): number {
  const span = range.maximum - range.minimum + 1;
  if (viewport <= 0 || range.largeChange <= 0 || span <= range.largeChange) return viewport;
  return Math.min((viewport * span) / range.largeChange, maxScrollContentSize);
}

function userSteps(range: ScrollRange): number {
  return range.userMaximum - range.minimum;
}

export function scrollOffset(range: ScrollRange, value: number, viewport: number): number {
  const steps = userSteps(range);
  const scrollable = scrollContentSize(range, viewport) - viewport;
  if (steps <= 0 || scrollable <= 0) return 0;
  const clamped = Math.min(Math.max(value, range.minimum), range.userMaximum);
  return ((clamped - range.minimum) * scrollable) / steps;
}

export function scrollValue(range: ScrollRange, offset: number, viewport: number): number {
  const steps = userSteps(range);
  const scrollable = scrollContentSize(range, viewport) - viewport;
  if (steps <= 0 || scrollable <= 0) return range.minimum;
  const value = range.minimum + Math.round((offset * steps) / scrollable);
  return Math.min(Math.max(value, range.minimum), range.userMaximum);
}

export const minThumbLength = 20;

export function thumbGeometry(
  content: number,
  viewport: number,
  offset: number,
): { readonly start: number; readonly length: number } | undefined {
  const scrollable = content - viewport;
  if (viewport <= 0 || scrollable < 1) return undefined;
  const length = Math.min(viewport, Math.max(minThumbLength, (viewport * viewport) / content));
  const fraction = Math.min(1, Math.max(0, offset / scrollable));
  return { start: fraction * (viewport - length), length };
}

export type ScrollOrientation = 'vertical' | 'horizontal';

export class NativeScrollBar {
  private range: ScrollRange | undefined;
  private value = 0;
  private contentSize = -1;
  private assignedOffset = Number.NaN;
  private overlay = false;
  private readonly element: HTMLElement;
  private readonly spacer: HTMLElement;
  private readonly thumb: HTMLElement | undefined;
  private readonly orientation: ScrollOrientation;
  private readonly onValue: (value: number) => void;

  constructor(
    element: HTMLElement,
    spacer: HTMLElement,
    orientation: ScrollOrientation,
    onValue: (value: number) => void,
    thumb?: HTMLElement,
  ) {
    this.element = element;
    this.spacer = spacer;
    this.thumb = thumb;
    this.orientation = orientation;
    this.onValue = onValue;
    element.addEventListener('scroll', this.onScroll, { passive: true });
  }

  private get viewport(): number {
    return this.orientation === 'vertical' ? this.element.clientHeight : this.element.clientWidth;
  }

  private get overlayScrollBar(): boolean {
    const { element } = this;
    return this.orientation === 'vertical'
      ? element.offsetWidth === element.clientWidth
      : element.offsetHeight === element.clientHeight;
  }

  private placeThumb(viewport: number): void {
    const { thumb } = this;
    if (thumb === undefined) return;
    const geometry = this.overlay
      ? thumbGeometry(this.contentSize, viewport, this.offset)
      : undefined;
    thumb.hidden = geometry === undefined;
    if (geometry === undefined) return;
    const { start, length } = geometry;
    if (this.orientation === 'vertical') {
      thumb.style.height = `${length}px`;
      thumb.style.transform = `translateY(${start}px)`;
    } else {
      thumb.style.width = `${length}px`;
      thumb.style.transform = `translateX(${start}px)`;
    }
  }

  private get offset(): number {
    return this.orientation === 'vertical' ? this.element.scrollTop : this.element.scrollLeft;
  }

  private set offset(offset: number) {
    if (this.orientation === 'vertical') this.element.scrollTop = offset;
    else this.element.scrollLeft = offset;
  }

  update(range: ScrollRange, value: number): void {
    const viewport = this.viewport;
    this.overlay = this.thumb !== undefined && this.overlayScrollBar;
    const size = scrollContentSize(range, viewport);
    if (size !== this.contentSize) {
      this.contentSize = size;
      if (this.orientation === 'vertical') this.spacer.style.height = `${size}px`;
      else this.spacer.style.width = `${size}px`;
    }
    this.range = range;
    this.value = value;
    const end =
      this.orientation === 'vertical' ? this.element.scrollHeight : this.element.scrollWidth;
    const edge =
      value === range.minimum
        ? 0
        : value === range.userMaximum
          ? Math.max(0, end - viewport)
          : undefined;
    if (
      scrollValue(range, this.offset, viewport) !== value ||
      (edge !== undefined && this.offset !== edge)
    ) {
      this.offset = edge ?? scrollOffset(range, value, viewport);
      this.assignedOffset = this.offset;
    }
    this.placeThumb(viewport);
  }

  private readonly onScroll = (): void => {
    const range = this.range;
    if (range === undefined) return;
    const offset = this.offset;
    this.placeThumb(this.viewport);
    if (offset === this.assignedOffset) return;
    this.assignedOffset = Number.NaN;
    const value = scrollValue(range, offset, this.viewport);
    if (value === this.value) return;
    this.value = value;
    this.onValue(value);
  };

  dispose(): void {
    this.element.removeEventListener('scroll', this.onScroll);
  }
}
