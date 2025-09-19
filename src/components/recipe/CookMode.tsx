/* eslint-disable @typescript-eslint/no-explicit-any */
// components/recipe/CookMode.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
  Volume2,
  VolumeX,
  Type as TypeIcon,
  Moon,
  Sun,
  Mic,
  MicOff,
} from "lucide-react";

import { useCookStore, type CookState } from "@/stores/cookStore";
import { useVoiceControls } from "@/hooks/useVoiceControls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Step = {
  idx: number; // 0-based
  text: string;
  durationSec?: number | null;
  imageUrl?: string | null;
};

export type CookModeProps = {
  steps: Step[];
  recipeId?: string | null;
  slug?: string | null; // for "Exit" link back to recipe page
  baseServings?: number | null;
  equipment?: string[]; // optional tools list
  enableVoice?: boolean; // default: true
};

const cookSelector = (s: CookState) =>
  [
    s.stepIdx,
    s.setStepIdx,
    s.nextStep,
    s.prevStep,
    s.setTimerFromStep,
    s.startTimer,
    s.pauseTimer,
    s.resetTimer,
    s.getTimerRemaining,
    s.timer,
    s.units,
    s.toggleUnits,
    s.baseServings,
    s.setBaseServings,
    s.servings,
    s.setServings,
    s.soundEnabled,
    s.setSoundEnabled,
    s.largeText,
    s.setLargeText,
    s.darkMode,
    s.setDarkMode,
    s.initRecipe,
    s.scale,
  ] as const;

export function CookMode({
  steps,
  recipeId,
  slug,
  baseServings = null,
  equipment = [],
  enableVoice = true,
}: CookModeProps) {
  // ===== Store bindings (typed tuple + shallow equality)
  const [
    stepIdx,
    setStepIdx,
    nextStep,
    prevStep,
    setTimerFromStep,
    startTimer,
    pauseTimer,
    resetTimer,
    getTimerRemaining,
    timer,
    units,
    toggleUnits,
    baseServingsState,
    setBaseServings,
    servings,
    setServings,
    soundEnabled,
    setSoundEnabled,
    largeText,
    setLargeText,
    darkMode,
    setDarkMode,
    initRecipe,
    scale,
  ] = useCookStore(cookSelector, shallow);

  // ===== Derive current step
  const step = useMemo(
    () =>
      steps.length
        ? steps[Math.max(0, Math.min(steps.length - 1, stepIdx))]
        : undefined,
    [steps, stepIdx]
  );

  // ===== Init
  useEffect(() => {
    initRecipe({
      recipeId,
      slug,
      stepCount: steps.length,
      baseServings: baseServings ?? baseServingsState,
      initialStepIdx: 0,
      initialStepDurationSec: steps[0]?.durationSec ?? null,
    });
    if (baseServings && !baseServingsState) setBaseServings(baseServings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, slug, steps.length]);

  // ===== Local ticking to update countdown while running
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const remaining = getTimerRemaining();
  const formattedTime = useMemo(() => formatClock(remaining), [remaining]);

  // ===== Minor UX: voice + auto-advance persistence
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return enableVoice;
    try {
      const v = sessionStorage.getItem("sourkimchi:cook:voice");
      return v == null ? enableVoice : v === "1";
    } catch {
      return enableVoice;
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "sourkimchi:cook:voice",
          voiceEnabled ? "1" : "0"
        );
      } catch {}
    }
  }, [voiceEnabled]);

  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = sessionStorage.getItem("sourkimchi:cook:autoAdvance");
      return v == null ? true : v === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "sourkimchi:cook:autoAdvance",
          autoAdvance ? "1" : "0"
        );
      } catch {}
    }
  }, [autoAdvance]);

  // ===== AudioContext (single) for beeps
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ===== Wake Lock (keep screen on while timer runs)
  const wakeLockRef = useRef<any | null>(null);
  const requestWakeLock = useCallback(async () => {
    try {
      const wl = (navigator as any).wakeLock;
      if (!wl?.request) return;
      const sentinel = await wl.request("screen");
      wakeLockRef.current = sentinel;
      wakeLockRef.current?.addEventListener?.("release", () => {});
    } catch {
      // ignore
    }
  }, []);
  const releaseWakeLock = useCallback(() => {
    try {
      wakeLockRef.current?.release?.();
    } catch {}
    wakeLockRef.current = null;
  }, []);
  useEffect(() => {
    if (timer.running) requestWakeLock();
    else releaseWakeLock();
    return () => releaseWakeLock();
  }, [timer.running, requestWakeLock, releaseWakeLock]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && timer.running)
        requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [timer.running, requestWakeLock]);

  // Auto-alert when timer hits 0 + optional auto-advance
  const prevRemainingRef = useRef(remaining);
  useEffect(() => {
    // define beep locally to avoid changing deps on every render
    const beep = async (freq = 880, durMs = 300) => {
      try {
        let ctx = audioCtxRef.current;
        if (!ctx) {
          const AC: typeof AudioContext | undefined =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          audioCtxRef.current = ctx;
        }
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
        o.stop(now + durMs / 1000 + 0.02);
      } catch {
        // ignore
      }
    };

    if (timer.running && prevRemainingRef.current > 0 && remaining === 0) {
      if (soundEnabled) beep(880, 350);
      navigator.vibrate?.(200);
      // Pause at zero to avoid negative counts
      pauseTimer();

      if (autoAdvance) {
        const ni = clamp(stepIdx + 1, 0, steps.length - 1);
        if (ni !== stepIdx) {
          setStepIdx(ni, steps[ni]?.durationSec ?? null);
          window?.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    }
    prevRemainingRef.current = remaining;
  }, [
    remaining,
    timer.running,
    soundEnabled,
    pauseTimer,
    autoAdvance,
    stepIdx,
    steps,
    setStepIdx,
  ]);

  // ===== Voice controls
  const onGoToStep = useCallback(
    (n: number) => {
      const idx = clamp(n - 1, 0, steps.length - 1);
      setStepIdx(idx, steps[idx]?.durationSec ?? null);
    },
    [setStepIdx, steps]
  );
  const onNext = useCallback(() => {
    const ni = clamp(stepIdx + 1, 0, steps.length - 1);
    nextStep(steps[ni]?.durationSec ?? null);
  }, [stepIdx, steps, nextStep]);
  const onBack = useCallback(() => {
    const pi = clamp(stepIdx - 1, 0, steps.length - 1);
    prevStep(steps[pi]?.durationSec ?? null);
  }, [stepIdx, steps, prevStep]);

  const voice = useVoiceControls(
    {
      onNext,
      onBack,
      onRepeat: () => window?.scrollTo({ top: 0, behavior: "smooth" }),
      onStartTimer: () => startTimer(),
      onPauseTimer: () => pauseTimer(),
      onResetTimer: () => resetTimer(),
      onGoToStep,
      onIncreaseServings: () =>
        servings != null && setServings(Math.min(12, (servings ?? 1) + 1)),
      onDecreaseServings: () =>
        servings != null && setServings(Math.max(1, (servings ?? 1) - 1)),
      onSetServings: (n) => setServings(clamp(n, 1, 20)),
      onSetUnits: (u) => {
        if (u !== units) toggleUnits();
      },
    },
    { enabled: voiceEnabled, debug: false, cooldownMs: 800 }
  );

  // ===== Handlers (memoized)
  const handlePrev = useCallback(() => {
    const pi = clamp(stepIdx - 1, 0, steps.length - 1);
    prevStep(steps[pi]?.durationSec ?? null);
  }, [stepIdx, steps, prevStep]);

  const handleNext = useCallback(() => {
    const ni = clamp(stepIdx + 1, 0, steps.length - 1);
    nextStep(steps[ni]?.durationSec ?? null);
  }, [stepIdx, steps, nextStep]);

  const handlePlayPause = useCallback(() => {
    if (timer.running) pauseTimer();
    else startTimer();
  }, [timer.running, pauseTimer, startTimer]);

  // Keyboard shortcuts (ignore when focus is on interactive elements)
  useEffect(() => {
    const isInteractive = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      if (n.isContentEditable) return true;
      const tag = n.tagName?.toLowerCase?.();
      if (["input", "textarea", "select", "button"].includes(tag)) return true;
      if (n.closest?.('[role="slider"], [role="switch"], [role="button"]'))
        return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isInteractive(e.target)) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === " ") {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        resetTimer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, handlePlayPause, resetTimer]);

  // Ensure step timer matches the displayed step (if steps prop changes dynamically)
  useEffect(() => {
    if (!timer.running) setTimerFromStep(step?.durationSec ?? null);
  }, [step?.durationSec, timer.running, setTimerFromStep]);

  // A11y: focus the step text on step change
  const stepTextRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    stepTextRef.current?.focus({ preventScroll: true });
  }, [stepIdx]);

  // ===== UI
  if (!steps.length) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-lg text-muted-foreground">No steps available.</p>
        {slug && (
          <div className="mt-4">
            <Link href={`/recipes/${slug}`}>
              <Button variant="secondary">Back to recipe</Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen w-full",
        darkMode ? "bg-neutral-950 text-neutral-50" : "bg-background"
      )}
    >
      {/* Top bar */}
      <div
        className={cn(
          "sticky top-0 z-30 border-b",
          darkMode
            ? "border-neutral-800 bg-neutral-950/90"
            : "bg-background/80 backdrop-blur"
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {slug ? (
            <Link href={`/recipes/${slug}`}>
              <Button
                variant={darkMode ? "secondary" : "ghost"}
                size="sm"
                aria-label="Exit cook mode"
              >
                Exit
              </Button>
            </Link>
          ) : null}

          <div className="ml-1 flex items-center gap-2 text-sm">
            <Badge variant="secondary">
              Step {stepIdx + 1} / {steps.length}
            </Badge>
            <div className="w-44 sm:w-64">
              <Progress
                value={
                  steps.length > 1
                    ? Math.round(((stepIdx + 1) / steps.length) * 100)
                    : 100
                }
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Voice */}
            <div className="flex items-center gap-2">
              <MicIcon listening={voice.listening} />
              <Switch
                checked={voiceEnabled}
                onCheckedChange={(v) => {
                  setVoiceEnabled(Boolean(v));
                }}
                aria-label="Voice control"
              />
            </div>

            {/* Sound */}
            <div className="flex items-center gap-2">
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <Switch
                checked={soundEnabled}
                onCheckedChange={(v) => setSoundEnabled(!!v)}
                aria-label="Sound"
              />
            </div>

            {/* Large text */}
            <div className="hidden items-center gap-2 sm:flex">
              <TypeIcon className="h-4 w-4" />
              <Switch
                checked={largeText}
                onCheckedChange={(v) => setLargeText(!!v)}
                aria-label="Large text"
              />
            </div>

            {/* Auto-advance */}
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-muted-foreground">
                Auto-advance
              </span>
              <Switch
                checked={autoAdvance}
                onCheckedChange={(v) => setAutoAdvance(!!v)}
                aria-label="Auto-advance on timer end"
              />
            </div>

            {/* Theme */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle cook theme"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:pt-6">
        {/* Step media */}
        {step && step.imageUrl ? (
          <div className="mb-4 overflow-hidden rounded-xl border">
            <Image
              src={step.imageUrl}
              alt={`Step ${step.idx + 1}`}
              width={1200}
              height={675}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        ) : null}

        {/* Step text */}
        <article
          ref={stepTextRef}
          tabIndex={-1}
          className={cn(
            "leading-relaxed",
            largeText ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          )}
        >
          {step?.text}
        </article>

        {/* Equipment (optional) */}
        {equipment?.length ? (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Tools:</span>
            {equipment.map((e) => (
              <Badge key={e} variant="outline">
                {e}
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Timer block */}
        <div className="mt-6 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TimerIcon className="h-4 w-4" />
              {typeof step?.durationSec === "number" &&
              (step.durationSec ?? 0) > 0 ? (
                <span>Step timer: {formatClock(step.durationSec!)}</span>
              ) : (
                <span>No timer for this step</span>
              )}
            </div>

            <div
              className="text-3xl font-mono tabular-nums"
              role="timer"
              aria-live="polite"
              aria-atomic="true"
            >
              {formattedTime}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handlePlayPause}
              disabled={!step?.durationSec}
            >
              {timer.running ? (
                <>
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Start
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resetTimer()}
              disabled={!step?.durationSec}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        {/* Controls: navigation + servings/units */}
        <div className="mt-6 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Prev / Next */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrev}
              variant="secondary"
              disabled={stepIdx === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={handleNext} disabled={stepIdx >= steps.length - 1}>
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Servings + Units */}
          <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-none sm:flex-row sm:items-center">
            <div className="sm:min-w-[260px]">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Servings</span>
                <span className="font-medium text-foreground">
                  {servings ?? baseServings ?? 1}
                  {baseServings ? (
                    <span className="ml-1 text-muted-foreground">
                      × {scale().toFixed(2)}
                    </span>
                  ) : null}
                </span>
              </div>
              <Slider
                value={[clamp(servings ?? baseServings ?? 1, 1, 20)]}
                onValueChange={(v) => setServings(clamp(v[0] ?? 1, 1, 20))}
                min={1}
                max={20}
                step={1}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Units</span>
              <div className="inline-flex rounded-md border p-0.5">
                <Button
                  variant={units === "metric" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-sm"
                  onClick={() => units !== "metric" && toggleUnits()}
                >
                  Metric
                </Button>
                <Button
                  variant={units === "imperial" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-sm"
                  onClick={() => units !== "imperial" && toggleUnits()}
                >
                  Imperial
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Voice transcript (debug/feedback) */}
        {voiceEnabled && voice.supported && (
          <div className="mt-4 text-xs text-muted-foreground">
            {voice.listening ? "Listening…" : "Voice paused."}
            {voice.lastCommand ? (
              <span className="ml-2">
                Last command:{" "}
                <span className="font-medium text-foreground">
                  {voice.lastCommand}
                </span>
              </span>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

/* ============ helpers ============ */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function MicIcon({ listening }: { listening: boolean }) {
  return listening ? (
    <Mic className="h-4 w-4 text-emerald-600" />
  ) : (
    <MicOff className="h-4 w-4 text-muted-foreground" />
  );
}

export default CookMode;
