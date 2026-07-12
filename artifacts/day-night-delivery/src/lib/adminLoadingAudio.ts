const STORAGE_KEY = "dn_admin_loading_audio_muted_v1";
const DEFAULT_VOLUME = 0.22;

type StoppableAudioNode = { stop: (when?: number) => void };

type EngineAudioState = {
  context: AudioContext;
  master: GainNode;
  nodes: StoppableAudioNode[];
  timers: number[];
};

let sharedContext: AudioContext | null = null;
let activeEngine: EngineAudioState | null = null;

function canUseBrowserAudio(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getAudioContext(): AudioContext | null {
  if (!canUseBrowserAudio()) return null;
  if (sharedContext) return sharedContext;

  const audioWindow = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextCtor) return null;

  try {
    sharedContext = new AudioContextCtor();
    return sharedContext;
  } catch {
    return null;
  }
}

function safeReadMuted(): boolean {
  if (!canUseBrowserAudio()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function isAdminLoadingAudioMuted(): boolean {
  return safeReadMuted();
}

export function setAdminLoadingAudioMuted(muted: boolean): void {
  if (!canUseBrowserAudio()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "true" : "false");
  } catch {
    // localStorage can be blocked; audio still works for the current session.
  }

  if (muted) stopAdminLoadingEngineAudio();
}

export async function armAdminLoadingAudio(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

function makeNoiseBuffer(context: AudioContext, seconds = 1.4): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const fade = 0.55 + 0.45 * (1 - index / length);
    const rumble = Math.sin(index / 32) * 0.18;
    data[index] = (Math.random() * 2 - 1 + rumble) * 0.2 * fade;
  }

  return buffer;
}

function connectOscillator(
  context: AudioContext,
  master: GainNode,
  options: { type: OscillatorType; startFrequency: number; idleFrequency: number; gain: number; delay?: number; detune?: number },
): OscillatorNode {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime + (options.delay ?? 0);

  oscillator.type = options.type;
  oscillator.detune.setValueAtTime(options.detune ?? 0, now);
  oscillator.frequency.setValueAtTime(options.startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(options.idleFrequency * 1.72, now + 0.16);
  oscillator.frequency.exponentialRampToValueAtTime(options.idleFrequency * 1.12, now + 0.46);
  oscillator.frequency.exponentialRampToValueAtTime(options.idleFrequency, now + 0.95);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.gain, now + 0.14);
  gain.gain.linearRampToValueAtTime(options.gain * 0.7, now + 1.18);

  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);

  return oscillator;
}

function connectEngineNoise(context: AudioContext, master: GainNode): AudioBufferSourceNode {
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const now = context.currentTime;

  noise.buffer = makeNoiseBuffer(context);
  noise.loop = true;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(86, now);
  filter.frequency.exponentialRampToValueAtTime(132, now + 0.34);
  filter.frequency.linearRampToValueAtTime(98, now + 1.12);
  filter.Q.setValueAtTime(0.72, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.074, now + 0.16);
  gain.gain.linearRampToValueAtTime(0.038, now + 1.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  noise.start(now);

  return noise;
}

function playIgnitionClick(context: AudioContext, master: GainNode): AudioBufferSourceNode {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const now = context.currentTime;

  source.buffer = makeNoiseBuffer(context, 0.18);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(720, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
  source.stop(now + 0.24);
  return source;
}

function addIdlePulse(context: AudioContext, master: GainNode, timers: number[]): void {
  const pulse = () => {
    if (!activeEngine || activeEngine.master !== master) return;
    const now = context.currentTime;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, DEFAULT_VOLUME * 0.42), now);
      master.gain.linearRampToValueAtTime(DEFAULT_VOLUME * 0.72, now + 0.08);
      master.gain.linearRampToValueAtTime(DEFAULT_VOLUME * 0.52, now + 0.22);
    } catch {
      // Browser may suspend the context during navigation; ignore safely.
    }
  };

  const timer = window.setInterval(pulse, 420);
  timers.push(timer);
}

export async function startAdminLoadingEngineAudio(): Promise<boolean> {
  if (!canUseBrowserAudio() || safeReadMuted()) return false;

  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === "suspended") await context.resume();
  } catch {
    return false;
  }

  stopAdminLoadingEngineAudio();

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(DEFAULT_VOLUME, now + 0.22);
  master.connect(context.destination);

  const nodes: StoppableAudioNode[] = [
    playIgnitionClick(context, master),
    connectOscillator(context, master, { type: "sawtooth", startFrequency: 22, idleFrequency: 43, gain: 0.096, detune: -8 }),
    connectOscillator(context, master, { type: "triangle", startFrequency: 34, idleFrequency: 63, gain: 0.058, delay: 0.035, detune: 6 }),
    connectOscillator(context, master, { type: "sine", startFrequency: 105, idleFrequency: 124, gain: 0.024, delay: 0.11 }),
    connectEngineNoise(context, master),
  ];

  const timers: number[] = [];
  const idleTimer = window.setTimeout(() => {
    const idleNow = context.currentTime;
    master.gain.cancelScheduledValues(idleNow);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), idleNow);
    master.gain.linearRampToValueAtTime(DEFAULT_VOLUME * 0.54, idleNow + 0.62);
    addIdlePulse(context, master, timers);
  }, 1320);
  timers.push(idleTimer);

  activeEngine = { context, master, nodes, timers };
  return true;
}

export function stopAdminLoadingEngineAudio(): void {
  if (!canUseBrowserAudio() || !activeEngine) return;

  const { context, master, nodes, timers } = activeEngine;
  const now = context.currentTime;

  timers.forEach((timer) => window.clearTimeout(timer));

  try {
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  } catch {
    // Continue cleanup even if the AudioContext is already closed by the browser.
  }

  nodes.forEach((node) => {
    try {
      node.stop(now + 0.48);
    } catch {
      // Node may already be stopped; safe to ignore.
    }
  });

  window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {
      // Already disconnected.
    }
  }, 620);

  activeEngine = null;
}
