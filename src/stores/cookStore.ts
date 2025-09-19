// stores/cookStore.ts
import { createWithEqualityFn } from "zustand/traditional";
import { persist, createJSONStorage } from "zustand/middleware";

export type UnitSystem = "metric" | "imperial";

type TimerState = {
  // Config for the current step's timer
  durationSec: number | null; // original step duration (seconds)
  // Runtime
  running: boolean; // is the timer counting down?
  deadlineMs: number | null; // epoch ms when timer will hit 0 (while running)
  pausedRemainingSec: number | null; // remaining seconds when paused/stopped
};

export type CookState = {
  // Recipe context (for isolation; changing recipe resets state)
  recipeId?: string | null;
  slug?: string | null;
  stepCount: number;

  // Progress
  stepIdx: number; // 0-based
  units: UnitSystem; // display preference
  baseServings: number | null; // as-authored servings
  servings: number | null; // current target servings

  // Timer for the current step
  timer: TimerState;

  // UI prefs
  soundEnabled: boolean; // beep/vibrate on timer end (handled in component)
  largeText: boolean; // accessibility toggle for cook mode
  darkMode: boolean; // cook-mode theme preference

  // Computed helpers
  scale: () => number; // servings / baseServings (1 if not set)
  getTimerRemaining: () => number; // remaining seconds (floored, >= 0)

  // Init / context
  initRecipe: (ctx: {
    recipeId?: string | null;
    slug?: string | null;
    stepCount: number;
    baseServings?: number | null;
    initialStepIdx?: number;
    initialStepDurationSec?: number | null;
  }) => void;

  // Navigation
  setStepIdx: (idx: number, nextStepDurationSec?: number | null) => void;
  nextStep: (nextStepDurationSec?: number | null) => void;
  prevStep: (prevStepDurationSec?: number | null) => void;
  resetSteps: () => void;

  // Servings & units
  setUnits: (u: UnitSystem) => void;
  toggleUnits: () => void;
  setBaseServings: (n: number | null) => void;
  setServings: (n: number | null) => void;

  // Timer controls
  setTimerFromStep: (durationSec: number | null) => void; // load step duration
  startTimer: (durationOverrideSec?: number | null) => void;
  pauseTimer: () => void;
  resetTimer: () => void;

  // UI prefs
  setSoundEnabled: (v: boolean) => void;
  setLargeText: (v: boolean) => void;
  setDarkMode: (v: boolean) => void;

  // Reset everything (e.g., leaving cook mode)
  resetAll: () => void;
};

const initialTimer = (): TimerState => ({
  durationSec: null,
  running: false,
  deadlineMs: null,
  pausedRemainingSec: null,
});

export const useCookStore = createWithEqualityFn<CookState>()(
  persist(
    (set, get) => ({
      recipeId: null,
      slug: null,
      stepCount: 0,

      stepIdx: 0,
      units: "metric",
      baseServings: null,
      servings: null,

      timer: initialTimer(),

      soundEnabled: true,
      largeText: false,
      darkMode: false,

      scale: () => {
        const { baseServings, servings } = get();
        if (!baseServings || !servings || baseServings <= 0) return 1;
        return servings / baseServings;
      },

      getTimerRemaining: () => {
        const { timer } = get();
        if (timer.running && timer.deadlineMs) {
          const ms = timer.deadlineMs - Date.now();
          return Math.max(0, Math.floor(ms / 1000));
        }
        // paused or not started
        return Math.max(
          0,
          Math.floor(timer.pausedRemainingSec ?? timer.durationSec ?? 0)
        );
      },

      initRecipe: ({
        recipeId,
        slug,
        stepCount,
        baseServings = null,
        initialStepIdx = 0,
        initialStepDurationSec = null,
      }) => {
        const prev = get();
        const isSameRecipe =
          prev.recipeId && recipeId && prev.recipeId === recipeId
            ? true
            : prev.slug && slug && prev.slug === slug;

        // If switching to a new recipe, reset everything
        set(() => {
          if (!isSameRecipe) {
            return {
              recipeId: recipeId ?? null,
              slug: slug ?? null,
              stepCount: Math.max(0, stepCount),
              stepIdx: Math.min(
                Math.max(0, initialStepIdx),
                Math.max(0, stepCount - 1)
              ),
              baseServings: baseServings,
              servings: baseServings,
              timer: {
                durationSec: initialStepDurationSec ?? null,
                running: false,
                deadlineMs: null,
                pausedRemainingSec: initialStepDurationSec ?? null,
              },
            };
          }
          // Same recipe: only update safe fields
          return {
            stepCount: Math.max(0, stepCount),
            baseServings: baseServings ?? prev.baseServings,
            // keep current servings and stepIdx
          } as Partial<CookState>;
        });
      },

      setStepIdx: (idx, nextStepDurationSec) =>
        set((s) => {
          const clamped = clamp(idx, 0, Math.max(0, s.stepCount - 1));
          const timer =
            nextStepDurationSec !== undefined
              ? {
                  durationSec: nextStepDurationSec,
                  running: false,
                  deadlineMs: null,
                  pausedRemainingSec: nextStepDurationSec ?? null,
                }
              : s.timer;
          return { stepIdx: clamped, timer };
        }),

      nextStep: (nextStepDurationSec) =>
        set((s) => {
          const clamped = clamp(s.stepIdx + 1, 0, Math.max(0, s.stepCount - 1));
          const timer =
            nextStepDurationSec !== undefined
              ? {
                  durationSec: nextStepDurationSec,
                  running: false,
                  deadlineMs: null,
                  pausedRemainingSec: nextStepDurationSec ?? null,
                }
              : s.timer;
          return { stepIdx: clamped, timer };
        }),

      prevStep: (prevStepDurationSec) =>
        set((s) => {
          const clamped = clamp(s.stepIdx - 1, 0, Math.max(0, s.stepCount - 1));
          const timer =
            prevStepDurationSec !== undefined
              ? {
                  durationSec: prevStepDurationSec,
                  running: false,
                  deadlineMs: null,
                  pausedRemainingSec: prevStepDurationSec ?? null,
                }
              : s.timer;
          return { stepIdx: clamped, timer };
        }),

      resetSteps: () =>
        set((s) => ({
          stepIdx: 0,
          timer: {
            durationSec: s.timer.durationSec,
            running: false,
            deadlineMs: null,
            pausedRemainingSec: s.timer.durationSec ?? null,
          },
        })),

      setUnits: (u) => set({ units: u }),
      toggleUnits: () =>
        set((s) => ({ units: s.units === "metric" ? "imperial" : "metric" })),

      setBaseServings: (n) => set({ baseServings: n }),
      setServings: (n) => set({ servings: n }),

      setTimerFromStep: (durationSec) =>
        set(() => ({
          timer: {
            durationSec: durationSec ?? null,
            running: false,
            deadlineMs: null,
            pausedRemainingSec: durationSec ?? null,
          },
        })),

      startTimer: (durationOverrideSec) =>
        set((s) => {
          const duration =
            durationOverrideSec ??
            s.timer.durationSec ??
            s.timer.pausedRemainingSec ??
            null;
          if (!duration || duration <= 0) {
            // Nothing to start
            return {
              timer: {
                durationSec: duration,
                running: false,
                deadlineMs: null,
                pausedRemainingSec: duration ?? null,
              },
            };
          }
          const now = Date.now();
          const remaining = Math.max(
            0,
            durationOverrideSec ??
              (s.timer.running
                ? s.getTimerRemaining()
                : s.timer.pausedRemainingSec ?? duration)
          );
          return {
            timer: {
              durationSec: duration,
              running: true,
              deadlineMs: now + remaining * 1000,
              pausedRemainingSec: remaining,
            },
          };
        }),

      pauseTimer: () =>
        set((s) => {
          if (!s.timer.running) return {};
          const remaining = s.getTimerRemaining();
          return {
            timer: {
              durationSec: s.timer.durationSec,
              running: false,
              deadlineMs: null,
              pausedRemainingSec: remaining,
            },
          };
        }),

      resetTimer: () =>
        set((s) => ({
          timer: {
            durationSec: s.timer.durationSec,
            running: false,
            deadlineMs: null,
            pausedRemainingSec: s.timer.durationSec ?? null,
          },
        })),

      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setLargeText: (v) => set({ largeText: v }),
      setDarkMode: (v) => set({ darkMode: v }),

      resetAll: () =>
        set(() => ({
          recipeId: null,
          slug: null,
          stepCount: 0,
          stepIdx: 0,
          baseServings: null,
          servings: null,
          timer: initialTimer(),
        })),
    }),
    {
      name: "sourkimchi:cook",
      version: 1,
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => sessionStorage)
          : undefined,
      // Only persist stable, non-ephemeral fields
      partialize: (s) => ({
        recipeId: s.recipeId,
        slug: s.slug,
        stepCount: s.stepCount,
        stepIdx: s.stepIdx,
        units: s.units,
        baseServings: s.baseServings,
        servings: s.servings,
        soundEnabled: s.soundEnabled,
        largeText: s.largeText,
        darkMode: s.darkMode,
        timer: {
          durationSec: s.timer.durationSec,
          running: false, // never rehydrate as running
          deadlineMs: null,
          pausedRemainingSec: s.timer.running
            ? s.getTimerRemaining()
            : s.timer.pausedRemainingSec,
        },
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure timers aren't "running" after hydration
        if (!state) return;
        state.timer.running = false;
        state.timer.deadlineMs = null;
      },
    }
  )
);

// Utils
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}