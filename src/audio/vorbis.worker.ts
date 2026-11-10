import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';

let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<{ id: number; bytes: ArrayBuffer }>) => {
  const { id, bytes } = event.data;
  queue = queue
    .then(async () => {
      const decoder = new OggVorbisDecoder();
      try {
        await decoder.ready;
        const decoded = await decoder.decodeFile(new Uint8Array(bytes));
        if (decoded.errors.length || decoded.samplesDecoded === 0)
          throw new Error(decoded.errors[0]?.message ?? 'Empty Vorbis stream');
        const channels = decoded.channelData;
        self.postMessage(
          { id, channels, sampleRate: decoded.sampleRate },
          { transfer: channels.map((c) => c.buffer) },
        );
      } finally {
        decoder.free();
      }
    })
    .catch((error: unknown) => {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    });
};
