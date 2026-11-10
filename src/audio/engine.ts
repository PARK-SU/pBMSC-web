import type { ReadonlyChart } from '../core/model/chart.ts';
import { isColumnSound } from '../core/model/column.ts';
import { niB, niSTOP } from '../core/model/constants.ts';
import { buildPreviewTempoMap, timeFromVPosition, vPositionFromTime } from './preview/tempo.ts';
import { cint } from '../core/vb.ts';
import { AudioAssets, type AssetSource, type AudioAsset } from './assets.ts';
import { AudioCache } from './cache.ts';
import { AudioDecoder } from './decoder.ts';
import { buildPeaks, type WavePeaks } from './peaks.ts';
import { exportWave } from './preview/export.ts';
import { PreviewPlayer, stoppedStatus, type PlayerStatus } from './preview/player.ts';
import { ChunkRenderer, prepareScore, checkAbort } from './preview/renderer.ts';
import { buildScore } from './preview/score.ts';
import { AudioRuntime } from './runtime.ts';

export interface WaveOptions {
  readonly position: number;
  readonly left: number;
  readonly width: number;
  readonly precision: number;
  readonly opacity: number;
  readonly saturation: number;
  readonly locked: boolean;
  readonly onNotes: boolean;
  readonly audioLine: boolean;
}
export const defaultWaveOptions: WaveOptions = {
  position: 0,
  left: 50,
  width: 100,
  precision: 1,
  opacity: 80,
  saturation: 0,
  locked: true,
  onNotes: false,
  audioLine: true,
};
export interface AudioUiState extends PlayerStatus {
  readonly files: number;
  readonly loading: boolean;
  readonly exporting: boolean;
  readonly progress: number;
  readonly cacheBytes: number;
  readonly budget: number;
  readonly waveName: string;
  readonly wave: WaveOptions;
  readonly previewOnClick: boolean;
  readonly clickStopPreview: boolean;
  readonly offsetMs: number;
}
export const initialAudioState: AudioUiState = {
  ...stoppedStatus,
  files: 0,
  loading: false,
  exporting: false,
  progress: 0,
  cacheBytes: 0,
  budget: 0,
  waveName: '',
  wave: defaultWaveOptions,
  previewOnClick: true,
  clickStopPreview: true,
  offsetMs: 0,
};
export interface AuditionLine {
  readonly position: number;
  readonly end: number;
}
export interface AudioHost {
  state(state: AudioUiState): void;
  follow(position: number): void;
  audition(line: AuditionLine | undefined): void;
  waveChanged(): void;
}
interface SaveTarget {
  createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
}
type PickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SaveTarget>;
};

export class AudioEngine {
  readonly assets = new AudioAssets();
  readonly decoder = new AudioDecoder();
  readonly cache = new AudioCache(
    navigator.maxTouchPoints > 0 ? 100 * 1024 ** 2 : 300 * 1024 ** 2,
    (blob) => this.decoder.decode(blob),
  );
  readonly renderer = new ChunkRenderer(this.cache);
  private readonly runtime = new AudioRuntime();
  private readonly player: PreviewPlayer;
  private readonly host: AudioHost;
  private state: AudioUiState = initialAudioState;
  private tab = 1;
  private readonly sources = new Map<number, AssetSource>();
  private readonly sourceCounts = new Map<number, number>();
  private abort: AbortController | undefined;
  private generation = 0;
  private readonly auditions = new Map<
    number,
    { source: AudioBufferSourceNode; release(): void }
  >();
  private auditionGeneration = 0;
  private auditionFrame: number | undefined;
  private wakeLock: WakeLockSentinel | undefined;
  private readonly peaks = new Map<string, WavePeaks>();
  private waveRequest = 0;
  private manualRequest = 0;
  private manual: WavePeaks | undefined;
  private onNotes = new Map<number, WavePeaks>();

  constructor(host: AudioHost) {
    this.host = host;
    this.player = new PreviewPlayer(this.renderer, {
      status: (status) => {
        if (status.error) this.runtime.markInterrupted();
        this.update(status);
        if (status.kind === 'stopped') {
          this.releaseWakeLock();
          this.runtime.stopMedia();
        }
      },
      position: (value) => host.follow(value),
      requestFrame: (f) => requestAnimationFrame(f),
      cancelFrame: (f) => cancelAnimationFrame(f),
      now: () => performance.now(),
    });
    this.runtime.onInterrupt = () => this.stop('Audio was interrupted. Tap Play to resume.');
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pagehide', this.pageHide);
    navigator.mediaDevices?.addEventListener('devicechange', this.routeChange);
  }

  get status(): AudioUiState {
    return this.state;
  }
  get locked(): boolean {
    return this.state.kind !== 'stopped';
  }
  get wave(): WavePeaks | undefined {
    return this.manual;
  }
  get noteWaves(): ReadonlyMap<number, WavePeaks> {
    return this.onNotes;
  }

  private update(change: Partial<AudioUiState>): void {
    this.state = {
      ...this.state,
      ...change,
      cacheBytes: this.cache.bytes,
      budget: this.cache.budget,
    };
    this.host.state(this.state);
  }
  private source(): AssetSource {
    let source = this.sources.get(this.tab);
    if (!source) {
      source = this.assets.source(this.tab);
      this.sources.set(this.tab, source);
    }
    return source;
  }

  selectTab(tab: number): void {
    this.stop();
    this.waveRequest++;
    this.manualRequest++;
    this.tab = tab;
    this.onNotes = new Map();
    this.update({
      ...stoppedStatus,
      files: this.sourceCounts.get(tab) ?? this.assets.count(tab),
    });
    this.host.waveChanged();
  }

  discardTab(tab: number): void {
    this.sources.delete(tab);
    this.sourceCounts.delete(tab);
    void this.assets.discard(tab).catch((error: unknown) => this.error(error));
  }

  attachSource(tab: number, source: AssetSource, count: number): void {
    this.sources.set(tab, source);
    this.sourceCounts.set(tab, count);
    this.cache.clear();
    this.peaks.clear();
    this.onNotes = new Map();
    if (tab === this.tab) {
      this.update({ files: count, warnings: [], error: undefined });
      this.host.waveChanged();
    }
  }

  async importFiles(files: readonly File[]): Promise<void> {
    this.stop();
    const tab = this.tab;
    this.update({ loading: true, error: undefined });
    try {
      await this.assets.importFiles(tab, files);
      this.sources.delete(tab);
      this.cache.clear();
      this.peaks.clear();
      this.onNotes = new Map();
      if (tab === this.tab) {
        this.update({ files: this.assets.count(tab) });
        this.host.waveChanged();
      }
    } catch (error) {
      this.error(error);
    } finally {
      this.update({ loading: false });
    }
  }

  async play(chart: ReadonlyChart, position = 0, selectedOnly = false): Promise<void> {
    this.stop();
    const generation = this.generation;
    const abort = new AbortController();
    this.abort = abort;
    this.update({
      kind: 'preparing',
      warnings: [],
      error: undefined,
      position,
      seconds: 0,
      duration: 0,
    });
    try {
      const score = buildScore(chart, position, selectedOnly);
      if (selectedOnly && !score.events.length) {
        this.stop();
        return;
      }
      const contextPromise = this.runtime.unlock();
      const source = this.source();
      const context = await contextPromise;
      const prepared = await prepareScore(score, source, this.cache, abort.signal);
      if (this.generation !== generation) return;
      if (prepared.estimatedBytes > this.cache.budget)
        prepared.warnings.set(
          'Memory',
          'The decoded keysounds exceed the cache budget; long files may need extra memory.',
        );
      this.player.start(prepared, context);
      this.requestWakeLock(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      this.error(error);
    }
  }

  stop(error?: string): void {
    this.generation++;
    this.abort?.abort();
    this.abort = undefined;
    this.player.stop();
    this.stopAuditions();
    this.releaseWakeLock();
    this.runtime.stopMedia();
    this.update({ kind: 'stopped', exporting: false, ...(error ? { error } : {}) });
  }

  setOffset(ms: number): void {
    this.player.offsetMs = Math.max(-2000, Math.min(2000, ms));
    this.update({ offsetMs: this.player.offsetMs });
  }
  setPreviewOptions(previewOnClick: boolean, clickStopPreview: boolean): void {
    this.update({ previewOnClick, clickStopPreview });
  }

  private stopAuditions(): void {
    this.auditionGeneration++;
    for (const item of this.auditions.values()) {
      item.source.onended = null;
      try {
        item.source.stop();
      } catch {}
      item.source.disconnect();
      item.release();
    }
    this.auditions.clear();
    if (this.auditionFrame !== undefined) cancelAnimationFrame(this.auditionFrame);
    this.auditionFrame = undefined;
    this.host.audition(undefined);
  }

  async audition(
    chart: ReadonlyChart,
    stop: boolean,
    id?: number,
    noteIndex?: number,
  ): Promise<void> {
    if (this.locked) this.stop();
    if (stop) this.stopAuditions();
    if (id === undefined || (noteIndex !== undefined && chart.notes[noteIndex]?.landmine)) return;
    const name = chart.hWAV[id];
    if (!name) return;
    const asset = this.source().resolve(name);
    if (!asset) {
      if (this.state.files) this.error(new Error(`File not found: ${name}`));
      return;
    }
    const generation = this.auditionGeneration;
    try {
      const context = await this.runtime.unlock();
      const lease = await this.cache.acquire(this.source(), asset);
      if (generation !== this.auditionGeneration) {
        lease.release();
        return;
      }
      const previous = this.auditions.get(id);
      if (previous) {
        previous.source.stop();
        previous.source.disconnect();
        previous.release();
      }
      const source = context.createBufferSource();
      source.buffer = lease.buffer;
      source.connect(context.destination);
      const record = { source, release: () => lease.release() };
      this.auditions.set(id, record);
      source.onended = () => {
        if (this.auditions.get(id) === record) this.auditions.delete(id);
        source.disconnect();
        source.buffer = null;
        lease.release();
        if (!this.auditions.size) {
          this.host.audition(undefined);
          this.runtime.stopMedia();
        }
      };
      source.start();
      if (noteIndex !== undefined && this.state.wave.audioLine) {
        const map = buildPreviewTempoMap(chart.notes),
          start = timeFromVPosition(map, chart.notes[noteIndex]!.vPosition);
        const origin = context.currentTime,
          duration = lease.buffer.duration;
        if (this.auditionFrame !== undefined) cancelAnimationFrame(this.auditionFrame);
        const tick = () => {
          const elapsed = context.currentTime - origin;
          if (generation !== this.auditionGeneration || elapsed >= duration) {
            this.host.audition(undefined);
            return;
          }
          this.host.audition({
            position: vPositionFromTime(map, start + elapsed),
            end: vPositionFromTime(map, start + duration),
          });
          this.auditionFrame = requestAnimationFrame(tick);
        };
        this.auditionFrame = requestAnimationFrame(tick);
      }
      this.update({});
    } catch (error) {
      if (generation === this.auditionGeneration) this.error(error);
    }
  }

  setWaveOptions(change: Partial<WaveOptions>): void {
    this.update({ wave: { ...this.state.wave, ...change } });
    this.host.waveChanged();
  }

  private async getPeaks(asset: AudioAsset, source: AssetSource): Promise<WavePeaks> {
    const known = this.peaks.get(asset.key);
    if (known) return known;
    const lease = await this.cache.acquire(source, asset);
    try {
      const channels = Array.from({ length: Math.min(2, lease.buffer.numberOfChannels) }, (_, i) =>
        lease.buffer.getChannelData(i),
      );
      const peaks = buildPeaks(channels, lease.buffer.sampleRate);
      this.peaks.set(asset.key, peaks);
      let bytes = 0;
      for (const value of [...this.peaks.values()].reverse()) {
        bytes +=
          value.min.reduce((n, a) => n + a.byteLength, 0) +
          value.max.reduce((n, a) => n + a.byteLength, 0);
      }
      if (bytes > 16 * 1024 ** 2) {
        for (const [key, value] of this.peaks) {
          if (key === asset.key) continue;
          this.peaks.delete(key);
          bytes -=
            value.min.reduce((n, a) => n + a.byteLength, 0) +
            value.max.reduce((n, a) => n + a.byteLength, 0);
          if (bytes <= 16 * 1024 ** 2) break;
        }
      }
      return peaks;
    } finally {
      lease.release();
    }
  }

  async loadWave(file: File): Promise<void> {
    const request = ++this.manualRequest;
    this.update({ loading: true, error: undefined });
    try {
      const asset = (await this.assets.importFiles(-1, [file])).at(-1)!;
      const peaks = await this.getPeaks(asset, this.assets.source(-1));
      if (request !== this.manualRequest) return;
      this.manual = peaks;
      this.update({ waveName: file.name });
      this.host.waveChanged();
    } catch (error) {
      this.error(error);
    } finally {
      this.update({ loading: false });
    }
  }
  clearWave(): void {
    this.manualRequest++;
    this.manual = undefined;
    this.update({ waveName: '' });
    this.host.waveChanged();
  }

  async updateNoteWaves(
    chart: ReadonlyChart,
    ranges: readonly { low: number; high: number }[],
  ): Promise<void> {
    if (!this.state.wave.onNotes) return;
    const request = ++this.waveRequest,
      source = this.source(),
      map = buildPreviewTempoMap(chart.notes.filter((n) => n.columnIndex !== niSTOP));
    const visible = new Map<number, WavePeaks>();
    try {
      for (let i = 1; i < chart.notes.length; i++) {
        if (request !== this.waveRequest) return;
        const n = chart.notes[i]!;
        if (!isColumnSound(n.columnIndex)) continue;
        const id = cint(n.value / 10000),
          asset = source.resolve(chart.hWAV[id] ?? '');
        if (!asset || visible.has(id)) continue;
        const end = vPositionFromTime(
          map,
          timeFromVPosition(map, n.vPosition) + (asset.duration ?? 0),
        );
        if (!ranges.some((r) => n.vPosition <= r.high && end >= r.low)) continue;
        visible.set(id, await this.getPeaks(asset, source));
      }
      if (request !== this.waveRequest) return;
      this.onNotes = visible;
      this.host.waveChanged();
    } catch (error) {
      if (request === this.waveRequest) this.error(error);
    }
  }

  waveformPosition(chart: ReadonlyChart): number {
    return this.state.wave.locked
      ? (chart.notes.find((n) => n.columnIndex >= niB)?.vPosition ?? this.state.wave.position)
      : this.state.wave.position;
  }

  async export(chart: ReadonlyChart, name: string): Promise<void> {
    this.stop();
    const generation = this.generation,
      abort = new AbortController();
    this.abort = abort;
    this.update({ exporting: true, progress: 0, error: undefined });
    let writer: Awaited<ReturnType<SaveTarget['createWritable']>> | undefined;
    try {
      const score = buildScore(chart),
        source = this.source();
      const picker = (window as PickerWindow).showSaveFilePicker;
      const handle = await picker?.call(window, {
        suggestedName: name,
        types: [{ description: 'Wave audio', accept: { 'audio/wav': ['.wav'] } }],
      });
      const prepared = await prepareScore(score, source, this.cache, abort.signal);
      checkAbort(abort.signal);
      if (
        !handle &&
        prepared.end > 600 &&
        !window.confirm('Export more than ten minutes of audio to a download?')
      ) {
        this.stop();
        return;
      }
      writer = await handle?.createWritable();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      await exportWave(
        prepared,
        this.renderer,
        {
          write: async (bytes) => {
            if (writer) await writer.write(bytes);
            else chunks.push(bytes.slice());
          },
        },
        abort.signal,
        (progress) => {
          if (generation === this.generation) this.update({ progress });
        },
      );
      checkAbort(abort.signal);
      if (writer) {
        await writer.close();
        checkAbort(abort.signal);
      } else {
        const url = URL.createObjectURL(new Blob(chunks, { type: 'audio/wav' })),
          anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      this.update({
        warnings: [...prepared.warnings].map(([file, message]) => `${file}: ${message}`),
      });
    } catch (error) {
      await writer?.abort().catch(() => {});
      if (
        generation === this.generation &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        this.error(error);
    } finally {
      if (generation === this.generation) this.update({ exporting: false });
    }
  }

  private error(error: unknown): void {
    this.update({ error: error instanceof Error ? error.message : String(error) });
  }
  private readonly visibility = () => {
    if (document.hidden)
      this.stop('Playback stopped while the page was hidden. Tap Play to resume.');
  };
  private readonly pageHide = () => this.stop();
  private readonly routeChange = () => {
    this.stop('Audio output changed. Tap Play to resume.');
    void this.runtime.dispose();
  };
  private requestWakeLock(generation: number): void {
    if (!navigator.wakeLock) return;
    void navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (generation !== this.generation || !this.locked) void lock.release();
        else this.wakeLock = lock;
      })
      .catch(() => {});
  }
  private releaseWakeLock(): void {
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = undefined;
  }

  dispose(): void {
    this.stop();
    this.waveRequest++;
    this.manualRequest++;
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pagehide', this.pageHide);
    navigator.mediaDevices?.removeEventListener('devicechange', this.routeChange);
    this.decoder.dispose();
    this.cache.clear();
    this.peaks.clear();
    void this.runtime.dispose();
  }
}
