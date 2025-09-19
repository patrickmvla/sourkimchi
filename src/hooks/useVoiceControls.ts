/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

/**
 * Voice controls (Web Speech API) for SourKimchi Cook Mode.
 * - Listens for simple commands: next, back, repeat, timer controls, step N, servings, units.
 * - No external deps. Gracefully degrades if SpeechRecognition is unavailable.
 *
 * Notes:
 * - Browsers require a user gesture to start mic access (call start() from a click).
 * - Best supported in Chrome/Edge. Safari support varies.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export type Units = "metric" | "imperial";

export type VoiceControlsCallbacks = {
  onNext?: () => void;
  onBack?: () => void;
  onRepeat?: () => void;

  onStartTimer?: () => void;
  onPauseTimer?: () => void;
  onResetTimer?: () => void;

  onGoToStep?: (stepNumber: number) => void; // 1-based

  onIncreaseServings?: () => void;
  onDecreaseServings?: () => void;
  onSetServings?: (n: number) => void;

  onSetUnits?: (u: Units) => void;

  onTranscript?: (text: string) => void; // optional: tap into transcripts for UI
};

export type VoiceControlsOptions = {
  enabled?: boolean; // listens automatically on mount when true (if permissions allow)
  lang?: string; // e.g., 'en-US'
  interimResults?: boolean; // emit interim results (we still parse only final)
  continuous?: boolean; // keep listening until stopped
  autoRestart?: boolean; // auto-restart on end (unless explicitly stopped)
  debug?: boolean; // console.log diagnostics
  cooldownMs?: number; // prevent duplicate triggers within this time
};

export type VoiceControlsState = {
  supported: boolean;
  listening: boolean;
  lastTranscript: string;
  lastCommand?: string;
  error?: string;

  start: () => void;
  stop: () => void;
  restart: () => void;
};

export function useVoiceControls(
  callbacks: VoiceControlsCallbacks,
  options?: VoiceControlsOptions
): VoiceControlsState {
  const {
    enabled = true,
    lang = "en-US",
    interimResults = false,
    continuous = true,
    autoRestart = true,
    debug = false,
    cooldownMs = 1000,
  } = options ?? {};

  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const [supported, SR] = useMemo(() => {
    if (typeof window === "undefined") return [false, undefined] as const;
    const C = window.SpeechRecognition || window.webkitSpeechRecognition;
    return [Boolean(C), C] as const;
  }, []);

  const recognitionRef = useRef<any | null>(null);
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const explicitlyStoppedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const autoRestartRef = useRef(autoRestart);
  autoRestartRef.current = autoRestart;

  const lastExecRef = useRef<{ cmd: string; at: number } | null>(null);

  const log = useCallback(
    (...args: any[]) => {
      if (debug) console.log("[voice]", ...args);
    },
    [debug]
  );

  const maybeExecute = useCallback(
    (cmd: string, fn?: () => void) => {
      if (!fn) return;
      const now = Date.now();
      const last = lastExecRef.current;
      if (last && last.cmd === cmd && now - last.at < cooldownMs) {
        return;
      }
      lastExecRef.current = { cmd, at: now };
      setLastCommand(cmd);
      try {
        fn();
      } catch {
        // swallow
      }
    },
    [cooldownMs]
  );

  const handleTranscript = useCallback(
    (rawText: string) => {
      const text = normalizeText(rawText);
      setLastTranscript(text);
      cbRef.current.onTranscript?.(text);
      if (!text) return;

      // Order matters: more specific patterns first
      // Step navigation
      const stepNum = extractStepNumber(text);
      if (stepNum != null) {
        maybeExecute(`goto-step-${stepNum}`, () =>
          cbRef.current.onGoToStep?.(stepNum)
        );
        return;
      }

      // Timer controls
      if (/\b(reset (the )?timer|restart timer|clear timer)\b/.test(text)) {
        return maybeExecute("reset-timer", cbRef.current.onResetTimer);
      }
      if (/\b(pause (the )?timer|stop timer|hold timer)\b/.test(text)) {
        return maybeExecute("pause-timer", cbRef.current.onPauseTimer);
      }
      if (
        /\b(start (the )?timer|resume timer|continue timer|timer start)\b/.test(
          text
        )
      ) {
        return maybeExecute("start-timer", cbRef.current.onStartTimer);
      }

      // Servings
      const servingsSet = extractServingsSet(text);
      if (servingsSet != null) {
        return maybeExecute(`set-servings-${servingsSet}`, () =>
          cbRef.current.onSetServings?.(servingsSet)
        );
      }
      if (
        /\b(increase servings|servings up|more servings|plus one)\b/.test(text)
      ) {
        return maybeExecute("inc-servings", cbRef.current.onIncreaseServings);
      }
      if (
        /\b(decrease servings|servings down|fewer servings|less servings|minus one)\b/.test(
          text
        )
      ) {
        return maybeExecute("dec-servings", cbRef.current.onDecreaseServings);
      }

      // Units
      if (/\b(use metric|metric units|metric)\b/.test(text)) {
        return maybeExecute("set-units-metric", () =>
          cbRef.current.onSetUnits?.("metric")
        );
      }
      if (/\b(use imperial|imperial units|imperial)\b/.test(text)) {
        return maybeExecute("set-units-imperial", () =>
          cbRef.current.onSetUnits?.("imperial")
        );
      }

      // Navigation
      if (/\b(next|go next|continue|forward)\b/.test(text)) {
        return maybeExecute("next", cbRef.current.onNext);
      }
      if (/\b(back|previous|go back|prev)\b/.test(text)) {
        return maybeExecute("back", cbRef.current.onBack);
      }
      if (/\b(repeat|again|say again|one more time)\b/.test(text)) {
        return maybeExecute("repeat", cbRef.current.onRepeat);
      }
    },
    [maybeExecute]
  );

  const createRecognition = useCallback(() => {
    if (!supported || !SR) return null;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = interimResults;
    rec.continuous = continuous;

    rec.onstart = () => {
      log("listening…");
      setListening(true);
      setError(undefined);
    };

    rec.onerror = (ev: any) => {
      const msg = ev?.error || "unknown-error";
      setError(msg);
      log("error", msg);
      // If mic is blocked, don't auto-restart
      if (msg === "not-allowed" || msg === "service-not-allowed") {
        explicitlyStoppedRef.current = true;
      }
    };

    rec.onend = () => {
      log("ended");
      setListening(false);
      if (
        !explicitlyStoppedRef.current &&
        enabledRef.current &&
        autoRestartRef.current
      ) {
        // brief delay to avoid rapid end/start loops
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }, 250);
      }
    };

    rec.onresult = (e: any) => {
      // Parse only final results to avoid duplicates
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript + " ";
      }
      finalText = finalText.trim();
      if (finalText) {
        log("final:", finalText);
        handleTranscript(finalText);
      }
    };

    return rec;
  }, [SR, supported, lang, interimResults, continuous, log, handleTranscript]);

  const start = useCallback(() => {
    if (!supported) return;
    explicitlyStoppedRef.current = false;
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = createRecognition();
      }
      recognitionRef.current?.start?.();
    } catch (e: any) {
      // Starting twice throws in some browsers
      log("start error (ignored if already running):", e?.message || e);
    }
  }, [supported, createRecognition, log]);

  const stop = useCallback(() => {
    explicitlyStoppedRef.current = true;
    try {
      recognitionRef.current?.stop?.();
    } catch (e: any) {
      log("stop error:", e?.message || e);
    }
  }, [log]);

  const restart = useCallback(() => {
    stop();
    setTimeout(() => start(), 100);
  }, [start, stop]);

  // Manage lifecycle & auto-start when enabled
  useEffect(() => {
    if (!supported) return;
    if (enabled) {
      // defer start until after mount to improve gesture chances
      const t = setTimeout(() => start(), 50);
      return () => clearTimeout(t);
    }
    // if disabled, stop listening
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, supported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      explicitlyStoppedRef.current = true;
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  return {
    supported,
    listening,
    lastTranscript,
    lastCommand,
    error,
    start,
    stop,
    restart,
  };
}

/* =========================
   Parsing helpers
   ========================= */

const NUM_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  for: 4, // common mis-hear
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 8, // common mis-hear
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStepNumber(text: string): number | null {
  // "go to step 3" | "step 3" | "next step 4" | "go step five"
  const direct = text.match(/\bstep\s+(\d{1,3})\b/);
  if (direct?.[1]) {
    const n = parseInt(direct[1], 10);
    if (Number.isFinite(n)) return n;
  }
  const goto = text.match(/\b(go to|goto)\s+step\s+(\d{1,3})\b/);
  if (goto?.[2]) {
    const n = parseInt(goto[2], 10);
    if (Number.isFinite(n)) return n;
  }
  // word numbers: "step five", "go to step twelve"
  const word = text.match(/\bstep\s+([a-z]+)\b/);
  if (word?.[1] && NUM_WORDS[word[1]] != null) {
    return NUM_WORDS[word[1]];
  }
  return null;
}

function extractServingsSet(text: string): number | null {
  // "set servings to 4", "servings to 6", "set to 3 servings"
  const m1 = text.match(/\bset (?:the )?servings to (\d{1,3})\b/);
  if (m1?.[1]) return parseInt(m1[1], 10);

  const m2 = text.match(/\bservings (?:to )?(\d{1,3})\b/);
  if (m2?.[1]) return parseInt(m2[1], 10);

  const m3 = text.match(/\bset to (\d{1,3}) (?:servings|people)\b/);
  if (m3?.[1]) return parseInt(m3[1], 10);

  const word = text.match(/\b(?:set )?(?:the )?servings to ([a-z]+)\b/);
  if (word?.[1] && NUM_WORDS[word[1]] != null) return NUM_WORDS[word[1]];
  return null;
}
