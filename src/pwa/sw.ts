import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] };

setCacheNameDetails({ prefix: 'pbmsc-web:', precache: 'shell', suffix: self.registration.scope });
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING')
    event.waitUntil(self.skipWaiting());
});
