const ascii = (bytes: Uint8Array, offset: number, text: string): boolean =>
  [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));

export async function readDuration(blob: Blob): Promise<number | undefined> {
  const header = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
  if (ascii(header, 0, 'RIFF') && ascii(header, 8, 'WAVE')) {
    let offset = 12,
      sampleRate = 0,
      blockAlign = 0,
      format = 0,
      factFrames: number | undefined,
      dataBytes: number | undefined;
    while (offset + 8 <= blob.size) {
      const chunk = new Uint8Array(await blob.slice(offset, offset + 40).arrayBuffer());
      if (chunk.length < 8) break;
      const view = new DataView(chunk.buffer);
      const length = view.getUint32(4, true);
      if (ascii(chunk, 0, 'fmt ') && length >= 16 && chunk.length >= 24) {
        format = view.getUint16(8, true);
        sampleRate = view.getUint32(12, true);
        blockAlign = view.getUint16(20, true);
      }
      if (ascii(chunk, 0, 'fact') && length >= 4 && chunk.length >= 12)
        factFrames = view.getUint32(8, true);
      if (ascii(chunk, 0, 'data')) dataBytes = Math.min(length, blob.size - offset - 8);
      if (dataBytes !== undefined && sampleRate > 0) {
        if ((format === 1 || format === 3) && blockAlign > 0)
          return dataBytes / blockAlign / sampleRate;
        if (factFrames !== undefined) return factFrames / sampleRate;
      }
      offset += 8 + length + (length % 2);
    }
  }
  if (ascii(header, 0, 'OggS')) {
    let rate = 0;
    for (let i = 0; i + 16 <= header.length; i++) {
      if (header[i] === 1 && ascii(header, i + 1, 'vorbis')) {
        rate = new DataView(header.buffer).getUint32(i + 12, true);
        break;
      }
    }
    if (rate > 0) {
      const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - 131072)).arrayBuffer());
      const view = new DataView(tail.buffer);
      const serial = new DataView(header.buffer).getUint32(14, true);
      let granule = 0n;
      for (let i = 0; i + 27 <= tail.length; i++) {
        if (!ascii(tail, i, 'OggS') || tail[i + 4] !== 0) continue;
        const n = tail[i + 26]!;
        if (i + 27 + n > tail.length) continue;
        let payload = 0;
        for (let j = 0; j < n; j++) payload += tail[i + 27 + j]!;
        if (i + 27 + n + payload > tail.length) continue;
        if (view.getUint32(i + 14, true) !== serial) return undefined;
        const value = view.getBigUint64(i + 6, true);
        if (value !== 0xffffffffffffffffn) granule = value;
        i += 26 + n + payload;
      }
      if (granule > 0 && granule <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(granule) / rate;
    }
  }
  return undefined;
}
