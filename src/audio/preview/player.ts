import { followPosition } from './follower.ts';
import { chunkFrames, type ChunkRenderer, type PreparedScore } from './renderer.ts';

export interface PlayerStatus {
  readonly kind: 'stopped' | 'preparing' | 'playing';
  readonly underruns: number;
  readonly position: number;
  readonly seconds: number;
  readonly duration: number;
  readonly warnings: readonly string[];
  readonly error: string | undefined;
}
export const stoppedStatus: PlayerStatus = {
  kind: 'stopped',
  underruns: 0,
  position: 0,
  seconds: 0,
  duration: 0,
  warnings: [],
  error: undefined,
};
interface Run {
  readonly prepared: PreparedScore;
  readonly context: AudioContext;
  readonly abort: AbortController;
  readonly sources: Set<AudioBufferSourceNode>;
  readonly total: number;
  next: number;
  index: number;
  origin: number | undefined;
  pumping: boolean;
  underruns: number;
  position: number;
  clock: number;
  observedAt: number;
  uiAt: number;
}
export interface PlayerHost {
  status(status: PlayerStatus): void;
  position(position: number): void;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
  now(): number;
}

export class PreviewPlayer {
  private run: Run | undefined;
  private frame: number | undefined;
  private readonly renderer: Pick<ChunkRenderer, 'render'>;
  private readonly host: PlayerHost;
  offsetMs = 0;

  constructor(renderer: Pick<ChunkRenderer, 'render'>, host: PlayerHost) {
    this.renderer = renderer;
    this.host = host;
  }

  start(prepared: PreparedScore, context: AudioContext): void {
    this.stop();
    const run: Run = {
      prepared,
      context,
      abort: new AbortController(),
      sources: new Set(),
      total: Math.max(1, Math.ceil((prepared.end - prepared.score.start) * context.sampleRate)),
      next: 0,
      index: 0,
      origin: undefined,
      pumping: false,
      underruns: 0,
      position: prepared.score.startPosition,
      clock: context.currentTime,
      observedAt: this.host.now(),
      uiAt: 0,
    };
    this.run = run;
    this.report(run, 'preparing');
    void this.pump(run);
    this.frame = this.host.requestFrame(() => this.tick(run));
  }

  stop(error?: string): void {
    const run = this.run;
    this.run = undefined;
    run?.abort.abort();
    if (this.frame !== undefined) this.host.cancelFrame(this.frame);
    this.frame = undefined;
    if (run) {
      for (const source of run.sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {
        }
        source.disconnect();
        source.buffer = null;
      }
      run.sources.clear();
      this.report(run, 'stopped', error);
    } else if (error) this.host.status({ ...stoppedStatus, error });
  }

  private async pump(run: Run): Promise<void> {
    if (run.pumping || this.run !== run) return;
    run.pumping = true;
    try {
      while (this.run === run && run.sources.size < 3 && run.next < run.total) {
        const first = run.next,
          rate = run.context.sampleRate;
        const count = Math.min(chunkFrames(run.index++, rate), run.total - first);
        const buffer = await this.renderer.render(
          run.prepared,
          first,
          count,
          rate,
          run.abort.signal,
        );
        if (this.run !== run) return;
        if (run.origin === undefined) {
          run.origin = run.context.currentTime + 0.05;
          run.clock = run.context.currentTime;
          run.observedAt = this.host.now();
        }
        const when = run.origin + first / rate;
        const late = Math.max(0, Math.ceil((run.context.currentTime - when) * rate));
        if (late > 0) run.underruns++;
        run.next += count;
        if (late >= count) continue;
        const source = run.context.createBufferSource();
        source.buffer = buffer;
        source.connect(run.context.destination);
        run.sources.add(source);
        source.onended = () => {
          run.sources.delete(source);
          source.disconnect();
          source.buffer = null;
          if (this.run !== run) return;
          if (run.next >= run.total && !run.sources.size) this.finish(run);
          else void this.pump(run);
        };
        source.start(Math.max(run.context.currentTime, when + late / rate), late / rate);
        this.report(run, 'playing');
      }
      if (this.run === run && run.next >= run.total && !run.sources.size) this.finish(run);
    } catch (error) {
      if (this.run === run) this.stop(error instanceof Error ? error.message : String(error));
    } finally {
      run.pumping = false;
    }
  }

  private finish(run: Run): void {
    run.position = followPosition(run.prepared.score.tempo, run.prepared.end, 0, 0);
    this.host.position(run.position);
    this.stop();
  }

  private tick(run: Run): void {
    if (this.run !== run) return;
    const time = this.host.now(),
      clock = run.context.currentTime;
    if (clock !== run.clock) {
      run.clock = clock;
      run.observedAt = time;
    }
    if (run.origin !== undefined) {
      if (run.context.state !== 'running' || time - run.observedAt > 250) {
        this.stop('Audio was interrupted. Tap Play to resume.');
        return;
      }
      const output = run.context.getOutputTimestamp?.();
      const outputClock = output?.contextTime;
      const outputAt = output?.performanceTime;
      const hasOutput =
        outputClock !== undefined &&
        outputAt !== undefined &&
        Number.isFinite(outputClock) &&
        Number.isFinite(outputAt) &&
        outputAt > 0;
      const estimate = output
        ? hasOutput
          ? outputClock + (time - outputAt) / 1000
          : run.origin
        : clock + Math.min((time - run.observedAt) / 1000, 128 / run.context.sampleRate);
      run.position = Math.max(
        run.position,
        followPosition(
          run.prepared.score.tempo,
          run.prepared.score.start,
          estimate,
          run.origin,
          output ? 0 : run.context.outputLatency || 0,
          this.offsetMs,
        ),
      );
      this.host.position(run.position);
      if (time - run.uiAt >= 250) {
        run.uiAt = time;
        this.report(run, 'playing');
      }
    }
    this.frame = this.host.requestFrame(() => this.tick(run));
  }

  private report(run: Run, kind: PlayerStatus['kind'], error?: string): void {
    this.host.status({
      kind,
      underruns: run.underruns,
      position: run.position,
      seconds: Math.min(
        run.prepared.end - run.prepared.score.start,
        Math.max(0, run.context.currentTime - (run.origin ?? run.context.currentTime)),
      ),
      duration: run.prepared.end - run.prepared.score.start,
      warnings: [...run.prepared.warnings].map(([name, message]) => `${name}: ${message}`),
      error,
    });
  }
}
