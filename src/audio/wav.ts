export function pcm16(value: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(value * 32768)));
}

export interface PcmBuffer {
  readonly length: number;
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

export function wavHeader(frames: number, rate = 44100): Uint8Array<ArrayBuffer> {
  const bytes = frames * 4;
  if (bytes > 0xffffffff - 36) throw new Error('WAV export exceeds the 4 GB RIFF limit');
  const header = new Uint8Array(44),
    view = new DataView(header.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) header[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, bytes + 36, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, bytes, true);
  return header;
}

export function pcmBytes(buffer: PcmBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer.length * 4),
    view = new DataView(bytes.buffer);
  const left = buffer.getChannelData(0),
    right = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1));
  for (let i = 0; i < buffer.length; i++) {
    view.setInt16(i * 4, pcm16(left[i]!), true);
    view.setInt16(i * 4 + 2, pcm16(right[i]!), true);
  }
  return bytes;
}
