// Web Audio API Retro 8-bit Sound Synthesizer, plus recorded clips for the campus tap
import { BUBBLE_POP_CLIPS } from '../data/sfxClips';
import { SampleBank } from './sfxSamples';

export class RetroSoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  /** `popClips` is replaceable so tests can feed decoded clips without a network. */
  constructor(private readonly popClips: SampleBank = new SampleBank(BUBBLE_POP_CLIPS)) {}

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        // Decode the clips on the first sound, which always follows a user gesture. Failures fall back to synthesis.
        void this.popClips.load(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playTapSound(isCrit: boolean = false) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      if (isCrit) this.playCritChime(this.ctx);
      else this.playTapBlip(this.ctx);
    } catch {
      // Audio playback might be prevented by browser policy
    }
  }

  /**
   * Campus tap: a random bubble-pop clip at a slightly jittered pitch. A critical tap layers the crit chime on top.
   * Until the clips are decoded (or if none load), the synthesized tap blip plays instead.
   */
  public playPopSound(isCrit: boolean = false) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      if (!this.popClips.play(this.ctx)) this.playTapBlip(this.ctx);
      if (isCrit) this.playCritChime(this.ctx);
    } catch {
      // Audio playback might be prevented by browser policy
    }
  }

  /** Attack tap on another school: a small bomb going off. A critical hit is a bigger blast plus the crit chime. */
  public playAttackSound(isCrit: boolean = false) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      this.playBlast(this.ctx, isCrit ? 1.6 : 1);
      if (isCrit) this.playCritChime(this.ctx);
    } catch {
      // Audio playback might be prevented by browser policy
    }
  }

  /** Assist tap on an ally school: a game heal, rising sparkle notes. A critical assist adds the crit chime. */
  public playAssistSound(isCrit: boolean = false) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      this.playHeal(this.ctx);
      if (isCrit) this.playCritChime(this.ctx);
    } catch {
      // Audio playback might be prevented by browser policy
    }
  }

  private noise: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

  /** Half a second of white noise, made once per context: the body of the blast. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise?.ctx === ctx) return this.noise.buffer;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = { ctx, buffer };
    return buffer;
  }

  /** Low thump falling in pitch under a noise burst whose low-pass closes: a short, muffled boom. */
  private playBlast(ctx: AudioContext, size: number) {
    const now = ctx.currentTime;
    const length = 0.22 * size;

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(160 / size, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + length * 0.8);
    thumpGain.gain.setValueAtTime(0.35, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + length * 0.8);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + length * 0.8);

    const burst = ctx.createBufferSource();
    burst.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + length);
    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.3, now);
    burstGain.gain.exponentialRampToValueAtTime(0.001, now + length);
    burst.connect(filter);
    filter.connect(burstGain);
    burstGain.connect(ctx.destination);
    burst.start(now);
    burst.stop(now + length);
  }

  /** C5-E5-G5-C6 arpeggio, each note a soft triangle that overlaps the next. */
  private playHeal(ctx: AudioContext) {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const start = now + index * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  /** Satisfying short 8-bit blip. */
  private playTapBlip(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /** High sparkling chime, D5 to D6. */
  private playCritChime(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playLevelUpSound() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Arpeggio notes: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        const start = now + i * 0.08;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {}
  }

  public playBuySound() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  public playFeverSound() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1280, now + 0.25);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {}
  }

  public playCheerSound() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Multi-tone whistle / fanfare
      [659.25, 783.99, 880.00].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        const start = now + i * 0.06;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch {}
  }

  public playTabSound() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }
}

export const soundManager = new RetroSoundManager();
