import { TUNING } from '@/game/tuning/tuning';

type AudioContextCtor = typeof AudioContext;

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private sfx: GainNode | null = null;
  private lineZip: { osc: OscillatorNode; gain: GainNode } | null = null;
  private reelTimer: number | null = null;
  private reelLoopTension = 0;

  async unlock() {
    if (!this.ctx) {
      const Ctor = (window.AudioContext || (window as typeof window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext) as AudioContextCtor;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.ambient = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.master.gain.value = TUNING.audio.masterGain;
      this.ambient.gain.value = TUNING.audio.ambientGain;
      this.sfx.gain.value = TUNING.audio.sfxGain;
      this.ambient.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    }

    await this.ctx.resume();
  }

  castWhoosh(power: number) {
    this.noiseBurst(TUNING.audio.whooshMs, TUNING.audio.sfxGain * power, 'lowpass', 2000, 500);
  }

  lurePlop(velocity: number) {
    this.tone(180 + velocity * 80, 90, TUNING.audio.plopMs, 'sine', TUNING.audio.sfxGain);
    this.noiseBurst(TUNING.audio.plopMs, TUNING.audio.sfxGain * 0.35, 'lowpass', 900, 220);
  }

  lureTwitch() {
    this.noiseBurst(TUNING.audio.twitchMs, TUNING.audio.sfxGain * 0.28, 'bandpass', 1400, 1200);
  }

  nibbleTick() {
    this.tone(50, 50, TUNING.audio.nibbleTickMs, 'triangle', TUNING.audio.sfxGain * 0.8);
    window.setTimeout(() => {
      this.tone(50, 50, TUNING.audio.nibbleTickMs, 'triangle', TUNING.audio.sfxGain * 0.55);
    }, TUNING.audio.nibbleGapMs);
  }

  hooksetThunk() {
    this.tone(80, 44, TUNING.audio.hookMs, 'sine', TUNING.audio.sfxGain);
    this.noiseBurst(TUNING.audio.twitchMs, TUNING.audio.sfxGain * 0.55, 'lowpass', 1200, 260);
  }

  fishSplash(intensity: number) {
    this.noiseBurst(TUNING.audio.splashMs, TUNING.audio.sfxGain * intensity, 'lowpass', 1500, 260);
  }

  lineSnap() {
    this.tone(800, 200, TUNING.audio.snapMs, 'sawtooth', TUNING.audio.sfxGain);
  }

  catchChime() {
    this.tone(392, 392, TUNING.audio.catchMs, 'sine', TUNING.audio.sfxGain * 0.45);
    this.tone(494, 494, TUNING.audio.catchMs, 'sine', TUNING.audio.sfxGain * 0.32);
  }

  escapeSplash() {
    this.noiseBurst(TUNING.audio.escapeMs, TUNING.audio.sfxGain * 0.62, 'lowpass', 1000, 180);
  }

  updateLoops(tension: number, reeling: boolean) {
    if (!this.ctx || !this.sfx) {
      return;
    }

    this.reelLoopTension = tension;

    if (tension > TUNING.audio.lineStrainMinTension) {
      if (!this.lineZip) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = TUNING.audio.lineZipFrequencyHz;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.sfx);
        osc.start();
        this.lineZip = { osc, gain };
      }
      this.lineZip.osc.frequency.setTargetAtTime(TUNING.audio.lineZipFrequencyHz * (1 + tension * TUNING.audio.lineStrainPitchRise), this.ctx.currentTime, 0.03);
      this.lineZip.gain.gain.setTargetAtTime((tension - TUNING.audio.lineStrainMinTension) * TUNING.audio.lineStrainGain, this.ctx.currentTime, 0.04);
    } else if (this.lineZip) {
      this.lineZip.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }

    if (reeling && this.reelTimer === null) {
      this.reelClickLoop();
    }

    if (!reeling && this.reelTimer !== null) {
      window.clearTimeout(this.reelTimer);
      this.reelTimer = null;
    }
  }

  stopLoops() {
    if (this.reelTimer !== null) {
      window.clearTimeout(this.reelTimer);
      this.reelTimer = null;
    }
    if (this.lineZip) {
      this.lineZip.osc.stop();
      this.lineZip = null;
    }
  }

  private reelClickLoop() {
    const tensionFactor = Math.min(1, Math.max(0, this.reelLoopTension));
    this.tone(
      TUNING.audio.reelClickStartHz,
      TUNING.audio.reelClickEndHz,
      TUNING.audio.nibbleTickMs,
      'square',
      TUNING.audio.reelClickGain + tensionFactor * TUNING.audio.reelClickGain
    );
    const interval = TUNING.audio.reelClickMaxIntervalMs - (TUNING.audio.reelClickMaxIntervalMs - TUNING.audio.reelClickMinIntervalMs) * tensionFactor;
    this.reelTimer = window.setTimeout(() => this.reelClickLoop(), interval);
  }

  private startAmbient() {
    if (!this.ctx || !this.ambient) {
      return;
    }

    const buffer = this.ctx.createBuffer(
      1,
      this.ctx.sampleRate * TUNING.audio.ambientBufferSeconds,
      this.ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let index = 0; index < data.length; index += 1) {
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.98;
      data[index] = last;
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = TUNING.audio.ambientFilterHz;
    source.connect(filter);
    filter.connect(this.ambient);
    source.start();
  }

  private tone(startHz: number, endHz: number, durationMs: number, type: OscillatorType, volume: number) {
    if (!this.ctx || !this.sfx) {
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const duration = durationMs / TUNING.timing.msPerSecond;
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endHz, 1), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfx);
    osc.start(now);
    osc.stop(now + duration);
  }

  private noiseBurst(durationMs: number, volume: number, filterType: BiquadFilterType, startHz: number, endHz: number) {
    if (!this.ctx || !this.sfx) {
      return;
    }

    const duration = durationMs / TUNING.timing.msPerSecond;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(startHz, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(endHz, 1), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    source.start(now);
    source.stop(now + duration);
  }
}
