export function keepFocus(event: { preventDefault(): void }): void {
  event.preventDefault();
}
export function focusOnMount(element: HTMLElement): void {
  queueMicrotask(() => {
    if (element.isConnected) element.focus();
  });
}
