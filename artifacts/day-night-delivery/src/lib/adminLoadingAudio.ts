type BrowserWindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type EngineNode = OscillatorNode | AudioBufferSourceNode;

type EngineAudioState = {
  context: AudioContext;
  master: GainNode;
  nodes: EngineNode[];
  stopTimers: number[];
};

const STORAGE_KEY = "dn_admin_loading_audio_muted_v1";
const DEFAULT_VOLUME = 0.18;

let sharedContext: AudioContext | null = null;
let activeEngine: EngineAudioState | null = null;

function canUseBrowserAudio(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getAudioContext(): AudioContext | null {
  if (!canUseBrowserAudio()) return null;
  if (sharedContext) return sharedContext;

  const audioWindow = window as BrowserWindowWithAudio;
  const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
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

function makeNoiseBuffer(context: AudioContext): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * 1.2));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const fade = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * 0.22 * fade;
  }

  return buffer;
}

function connectOscillator(context: AudioContext, master: GainNode, options: { type: OscillatorType; startFrequency: number; idleFrequency: number; gain: number; delay?: number }): OscillatorNode {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime + (options.delay ?? 0);

  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(options.idleFrequency * 1.35, now + 0.28);
  oscillator.frequency.exponentialRampToValueAtTime(options.idleFrequency, now + 0.95);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.gain, now + 0.22);
  gain.gain.linearRampToValueAtTime(options.gain * 0.76, now + 1.1);

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
  filter.frequency.setValueAtTime(92, now);
  filter.Q.setValueAtTime(0.62, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.052, now + 0.18);
  gain.gain.linearRampToValueAtTime(0.026, now + 1.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  noise.start(now);

  return noise;
}

export async function startAdminLoadingEngineAudio(): Promise<boolean> {
  if (safeReadMuted()) return false;

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
  master.gain.exponentialRampToValueAtTime(DEFAULT_VOLUME, now + 0.28);
  master.connect(context.destination);

  const nodes: EngineNode[] = [
    connectOscillator(context, master, { type: "sawtooth", startFrequency: 24, idleFrequency: 44, gain: 0.082 }),
    connectOscillator(context, master, { type: "triangle", startFrequency: 38, idleFrequency: 64, gain: 0.046, delay: 0.04 }),
    connectOscillator(context, master, { type: "sine", startFrequency: 92, idleFrequency: 118, gain: 0.018, delay: 0.12 }),
    connectEngineNoise(context, master),
  ];

  const stopTimers: number[] = [];
  const idleTimer = window.setTimeout(() => {
    const idleNow = context.currentTime;
    master.gain.cancelScheduledValues(idleNow);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), idleNow);
    master.gain.linearRampToValueAtTime(DEFAULT_VOLUME * 0.58, idleNow + 0.72);
  }, 1500);
  stopTimers.push(idleTimer);

  activeEngine = { context, master, nodes, stopTimers };
  return true;
}

export function stopAdminLoadingEngineAudio(): void {
  if (!activeEngine) return;

  const { context, master, nodes, stopTimers } = activeEngine;
  const now = context.currentTime;

  stopTimers.forEach((timer) => window.clearTimeout(timer));

  try {
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  } catch {
    // Continue cleanup even if the AudioContext is already closed by the browser.
  }

  nodes.forEach((node) => {
    try {
      node.stop(now + 0.42);
    } catch {
      // Node may already be stopped; safe to ignore.
    }
  });

  const disconnectTimer = window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {
      // Already disconnected.
    }
  }, 520);

  window.setTimeout(() => window.clearTimeout(disconnectTimer), 800);
  activeEngine = null;
}
