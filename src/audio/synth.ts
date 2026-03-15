import type { InstrumentConfig } from './types';
import { midiToFreq } from './notes';

/**
 * A SynthVoice plays a single note with multi-oscillator unison,
 * ADSR amplitude envelope, and optional filter.
 * Each call to `play()` creates temporary nodes that auto-disconnect after release.
 */
export class SynthVoice {
  static play(
    ctx: AudioContext,
    destination: AudioNode,
    instrument: InstrumentConfig,
    midiNote: number,
    startTime: number,
    durationSecs: number,
    velocity: number = 1.0,
    globalDetune: number = 0,
  ): void {
    const freq = midiToFreq(midiNote);
    const env = instrument.ampEnv;

    // Calculate envelope times
    const releaseStart = startTime + durationSecs;
    const releaseEnd = releaseStart + env.release;

    // Amplitude envelope
    const ampGain = ctx.createGain();
    ampGain.gain.setValueAtTime(0, startTime);
    ampGain.gain.linearRampToValueAtTime(velocity, startTime + env.attack);
    ampGain.gain.linearRampToValueAtTime(
      velocity * env.sustain,
      startTime + env.attack + env.decay,
    );
    // Hold sustain until note end
    ampGain.gain.setValueAtTime(velocity * env.sustain, releaseStart);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

    // Optional filter
    let filterNode: BiquadFilterNode | null = null;
    if (instrument.filter) {
      filterNode = ctx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = instrument.filter.frequency;
      filterNode.Q.value = instrument.filter.Q;

      if (instrument.filter.envAmount && instrument.filter.envDecay) {
        const filterTarget = instrument.filter.frequency;
        const filterPeak = filterTarget + instrument.filter.envAmount;
        filterNode.frequency.setValueAtTime(filterPeak, startTime);
        filterNode.frequency.exponentialRampToValueAtTime(
          filterTarget,
          startTime + instrument.filter.envDecay,
        );
      }

      ampGain.connect(filterNode);
      filterNode.connect(destination);
    } else {
      ampGain.connect(destination);
    }

    // Schedule node cleanup after release completes
    setTimeout(() => {
      try {
        filterNode?.disconnect();
        ampGain.disconnect();
      } catch {}
    }, (releaseEnd - ctx.currentTime) * 1000 + 200);

    // Create oscillators
    const oscCount = instrument.oscCount || 1;
    const detuneSpread = instrument.unisonDetune || 0;

    for (let i = 0; i < oscCount; i++) {
      const osc = ctx.createOscillator();
      osc.type = instrument.oscType;
      osc.frequency.value = freq;

      // Spread detune evenly across unison voices
      let detune = globalDetune;
      if (oscCount > 1) {
        detune += (i / (oscCount - 1) - 0.5) * 2 * detuneSpread;
      }
      osc.detune.value = detune;

      // Per-oscillator gain to balance unison
      const oscGain = ctx.createGain();
      oscGain.gain.value = 1 / oscCount;
      osc.connect(oscGain);
      oscGain.connect(ampGain);

      osc.start(startTime);
      osc.stop(releaseEnd + 0.05);

      // Auto-cleanup
      osc.onended = () => {
        try {
          osc.disconnect();
          oscGain.disconnect();
        } catch {}
      };
    }
  }
}
