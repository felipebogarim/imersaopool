const TARGET_SAMPLE_RATE = 16_000;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(44 + index * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Decodifica o arquivo no navegador e cria um WAV PCM mono completo e portátil. */
export async function normalizeAudioToWav(input: Blob): Promise<File> {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();

  try {
    const decoded = await context.decodeAudioData(await input.arrayBuffer());
    if (!decoded.length || !decoded.duration) throw new Error("empty-audio");

    const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const wav = encodePcm16Wav(rendered.getChannelData(0), TARGET_SAMPLE_RATE);
    return new File([wav], "audio-normalizado.wav", { type: "audio/wav" });
  } catch {
    throw new Error("Este áudio não pôde ser decodificado. Converta-o para MP3 ou WAV e tente novamente.");
  } finally {
    await context.close().catch(() => undefined);
  }
}

/**
 * Decodifica no navegador e devolve trechos WAV PCM (padrão: 3 minutos cada),
 * evitando enviar arquivos grandes de uma vez ao servidor.
 */
export async function normalizeAudioToWavChunks(input: Blob, chunkSeconds = 180): Promise<Blob[]> {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();

  try {
    const decoded = await context.decodeAudioData(await input.arrayBuffer());
    if (!decoded.length || !decoded.duration) throw new Error("empty-audio");

    const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);

    const chunkSize = Math.max(1, Math.floor(chunkSeconds * TARGET_SAMPLE_RATE));
    const chunks: Blob[] = [];
    for (let start = 0; start < samples.length; start += chunkSize) {
      chunks.push(encodePcm16Wav(samples.slice(start, start + chunkSize), TARGET_SAMPLE_RATE));
    }
    return chunks.length ? chunks : [encodePcm16Wav(samples, TARGET_SAMPLE_RATE)];
  } catch {
    throw new Error("Este áudio não pôde ser decodificado. Converta-o para MP3 ou WAV e tente novamente.");
  } finally {
    await context.close().catch(() => undefined);
  }
}
