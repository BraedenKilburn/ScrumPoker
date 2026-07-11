import { ref } from "vue";
import { soundCuesKey } from "@/modules/constants";

type Note = {
  freq: number;
  /** Seconds after the cue starts. */
  startOffset: number;
  duration: number;
};

// Module scope so every caller shares one preference and one AudioContext.
const soundCuesEnabled = ref(localStorage.getItem(soundCuesKey) === "true");
let audioCtx: AudioContext | null = null;
let lastCueAt = 0;

const CUE_DEBOUNCE_MS = 250;
// Quiet peak (~ -24 dB): a nudge, not an alarm.
const PEAK_GAIN = 0.06;

function getContext() {
  if (typeof AudioContext === "undefined") return null;
  audioCtx ??= new AudioContext();
  return audioCtx;
}

function playNote(ctx: AudioContext, { freq, startOffset, duration }: Note) {
  const start = ctx.currentTime + startOffset;
  const osc = new OscillatorNode(ctx, { type: "sine", frequency: freq });
  const gain = new GainNode(ctx, { gain: 0.0001 });
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function playCue(notes: Note[]) {
  if (!soundCuesEnabled.value) return;
  const now = performance.now();
  if (now - lastCueAt < CUE_DEBOUNCE_MS) return;
  lastCueAt = now;

  const ctx = getContext();
  if (!ctx) return;
  const schedule = () => notes.forEach((note) => playNote(ctx, note));
  // Background tabs suspend the context; resume before playing — a cue
  // is most useful exactly when the tab isn't focused. If the browser
  // still blocks (no user gesture yet after page load), skip silently.
  if (ctx.state === "suspended") {
    ctx.resume().then(schedule, () => {});
  } else {
    schedule();
  }
}

/** Ascending two-note "ta-da" when votes are revealed. */
function playRevealCue() {
  playCue([
    { freq: 660, startOffset: 0, duration: 0.3 },
    { freq: 880, startOffset: 0.09, duration: 0.35 },
  ]);
}

/** Single mellow note when a new round starts — your turn to vote. */
function playNewRoundCue() {
  playCue([{ freq: 523, startOffset: 0, duration: 0.35 }]);
}

function toggleSoundCues() {
  soundCuesEnabled.value = !soundCuesEnabled.value;
  localStorage.setItem(soundCuesKey, String(soundCuesEnabled.value));
  // The enabling click is the user gesture browsers require before audio
  // may play; use it to unlock the context and confirm sound works.
  if (soundCuesEnabled.value) playNewRoundCue();
}

export function useSoundCues() {
  return {
    soundCuesEnabled,
    toggleSoundCues,
    playRevealCue,
    playNewRoundCue,
  };
}
