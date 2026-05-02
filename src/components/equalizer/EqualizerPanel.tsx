import { useCallback, useRef, useState, useEffect } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { EQ_FREQUENCIES, EQ_PRESETS, type EqPresetName } from "../../types";
import { SlidersHorizontal, Play, Square, Volume2 } from "lucide-react";

export function EqualizerPanel() {
  const { eqBands, updateEqBand, applyEqPreset, tracks } = useProjectStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  const presets: { key: EqPresetName; label: string }[] = [
    { key: "flat", label: "Flat" },
    { key: "bass_boost", label: "Bass Boost" },
    { key: "treble_boost", label: "Treble" },
    { key: "lofi", label: "Lo-fi" },
    { key: "warm", label: "Warm" },
    { key: "vocal", label: "Vocal" },
  ];

  // Setup Web Audio API filters
  const setupAudioFilters = useCallback((ctx: AudioContext, source: AudioNode) => {
    const freqValues = [60, 170, 310, 600, 1000, 3000, 6000, 14000];
    const filters: BiquadFilterNode[] = [];

    freqValues.forEach((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      const key = EQ_FREQUENCIES[i].key;
      filter.gain.value = eqBands[key] || 0;
      filters.push(filter);
    });

    // Chain: source → filter[0] → filter[1] → ... → gain → destination
    const gain = ctx.createGain();
    gain.gain.value = 0.8;
    gainNodeRef.current = gain;

    let prev: AudioNode = source;
    filters.forEach((f) => {
      prev.connect(f);
      prev = f;
    });
    prev.connect(gain);
    gain.connect(ctx.destination);

    filtersRef.current = filters;
  }, [eqBands]);

  // Update filter gains when EQ bands change
  useEffect(() => {
    filtersRef.current.forEach((filter, i) => {
      const key = EQ_FREQUENCIES[i].key;
      const targetGain = eqBands[key] || 0;
      filter.gain.setValueAtTime(targetGain, audioContextRef.current?.currentTime || 0);
    });
  }, [eqBands]);

  // Toggle audio preview
  const togglePreview = useCallback(async () => {
    if (isPlaying) {
      audioSourceRef.current?.stop();
      audioContextRef.current?.close();
      audioContextRef.current = null;
      audioSourceRef.current = null;
      filtersRef.current = [];
      setIsPlaying(false);
      return;
    }

    if (tracks.length === 0) return;

    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // Fetch first track for preview
      const firstTrack = tracks[0];
      const response = await fetch(`asset://localhost/${firstTrack.path}`).catch(() => null);

      if (!response || !response.ok) {
        // Fallback: generate a test tone
        const oscillator = ctx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = 440;
        setupAudioFilters(ctx, oscillator);
        oscillator.start();
        audioSourceRef.current = oscillator as unknown as AudioBufferSourceNode;
        setIsPlaying(true);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      audioSourceRef.current = source;

      setupAudioFilters(ctx, source);
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio preview error:", err);
      // Fallback: generate a test tone
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = 440;
      setupAudioFilters(ctx, oscillator);
      oscillator.start();
      audioSourceRef.current = oscillator as unknown as AudioBufferSourceNode;
      setIsPlaying(true);
    }
  }, [isPlaying, tracks, setupAudioFilters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioSourceRef.current?.stop();
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-[var(--color-accent)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Equalizer
          </span>
        </div>
        <button
          className={`btn btn-sm ${isPlaying ? "btn-accent" : "btn-ghost"}`}
          onClick={togglePreview}
          title={isPlaying ? "Stop Preview" : "Preview with EQ"}
        >
          {isPlaying ? <Square size={12} /> : <Play size={12} />}
          {isPlaying ? "Stop" : "Preview"}
        </button>
      </div>

      {/* EQ Presets */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-[var(--color-border)]">
        {presets.map((preset) => {
          const isActive = Object.keys(EQ_PRESETS[preset.key]).every(
            (key) => eqBands[key] === EQ_PRESETS[preset.key][key]
          );
          return (
            <button
              key={preset.key}
              className={`btn btn-sm ${isActive ? "btn-accent" : "btn-ghost"}`}
              onClick={() => applyEqPreset(preset.key)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* EQ Sliders */}
      <div className="eq-container">
        {EQ_FREQUENCIES.map(({ key, label }) => {
          const value = eqBands[key] || 0;
          return (
            <div key={key} className="eq-band">
              <span className="eq-value">
                {value > 0 ? `+${value}` : value}dB
              </span>
              <div className="eq-slider-wrapper">
                <input
                  type="range"
                  className="eq-slider"
                  min={-12}
                  max={12}
                  step={1}
                  value={value}
                  onChange={(e) => updateEqBand(key, parseInt(e.target.value))}
                  title={`${label}: ${value}dB`}
                />
              </div>
              <span className="eq-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Volume indicator */}
      {isPlaying && (
        <div className="flex items-center gap-2 px-4 pb-3 animate-pulse">
          <Volume2 size={14} className="text-[var(--color-accent)]" />
          <span className="text-[11px] text-[var(--color-accent-light)]">
            Audio preview active — adjust sliders in realtime
          </span>
        </div>
      )}
    </div>
  );
}
