export class AudioRuntime {
  private context: AudioContext | undefined;
  private interrupted = false;
  private unlocking = false;
  private silent: HTMLAudioElement | undefined;
  onInterrupt: (() => void) | undefined;

  get current(): AudioContext | undefined {
    return this.context;
  }

  unlock(): Promise<AudioContext> {
    if (!this.context || this.context.state === 'closed') {
      try {
        this.context = new AudioContext({ sampleRate: 44100 });
      } catch {
        this.context = new AudioContext();
      }
      const context = this.context;
      context.addEventListener('statechange', () => {
        if (!this.unlocking && context.state !== 'running') {
          this.interrupted = true;
          this.onInterrupt?.();
        }
      });
    }
    const context = this.context;
    this.unlocking = true;
    if (!this.silent) {
      this.silent = new Audio();
      this.silent.loop = true;
      this.silent.preload = 'auto';
      this.silent.setAttribute('playsinline', '');
      this.silent.src = new URL(
        'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==',
      ).href;
    }
    void this.silent.play().catch(() => {});
    const resume = this.interrupted
      ? context.suspend().then(() => context.resume())
      : context.resume();
    return resume
      .then(() => {
        this.interrupted = false;
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(context.destination);
        source.start();
        return context;
      })
      .finally(() => {
        this.unlocking = false;
      });
  }

  markInterrupted(): void {
    this.interrupted = true;
  }
  stopMedia(): void {
    this.silent?.pause();
  }
  async dispose(): Promise<void> {
    this.silent?.pause();
    this.silent = undefined;
    await this.context?.close();
    this.context = undefined;
  }
}
