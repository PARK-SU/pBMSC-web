import { hasWebAssembly } from './webAssembly.ts';

interface Decoded {
  readonly channels: Float32Array[];
  readonly sampleRate: number;
}

export class AudioDecoder {
  private context: OfflineAudioContext | undefined;
  private worker: Worker | undefined;
  private sequence = 0;
  private readonly waiting = new Map<
    number,
    { resolve: (value: Decoded) => void; reject: (error: Error) => void }
  >();

  async vorbis(bytes: ArrayBuffer): Promise<Decoded> {
    if (!hasWebAssembly()) throw new Error('WebAssembly is needed for the Ogg Vorbis fallback');
    if (!this.worker) {
      const worker = new Worker(new URL('./vorbis.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<Decoded & { id: number; error?: string }>) => {
        const pending = this.waiting.get(e.data.id);
        this.waiting.delete(e.data.id);
        if (e.data.error) pending?.reject(new Error(e.data.error));
        else pending?.resolve(e.data);
      };
      worker.onerror = () => {
        for (const p of this.waiting.values()) p.reject(new Error('Vorbis worker failed'));
        this.waiting.clear();
        worker.terminate();
        this.worker = undefined;
      };
      this.worker = worker;
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker!.postMessage({ id, bytes }, [bytes]);
    });
  }

  async decode(blob: Blob, forceVorbis = false): Promise<AudioBuffer> {
    const bytes = await blob.arrayBuffer();
    this.context ??= new OfflineAudioContext(2, 1, 44100);
    if (!forceVorbis) {
      try {
        return await this.context.decodeAudioData(bytes.slice(0));
      } catch {
      }
    }
    const decoded = await this.vorbis(bytes);
    const buffer = this.context.createBuffer(
      decoded.channels.length,
      decoded.channels[0]!.length,
      decoded.sampleRate,
    );
    decoded.channels.forEach((channel, i) => buffer.getChannelData(i).set(channel));
    if (buffer.sampleRate === 44100) return buffer;
    const resampler = new OfflineAudioContext(
      Math.min(2, buffer.numberOfChannels),
      Math.ceil((buffer.length * 44100) / buffer.sampleRate),
      44100,
    );
    const source = resampler.createBufferSource();
    source.buffer = buffer;
    source.connect(resampler.destination);
    source.start();
    return resampler.startRendering();
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    for (const p of this.waiting.values()) p.reject(new Error('Decoder disposed'));
    this.waiting.clear();
    this.context = undefined;
  }
}
