/**
 * useTonePresets — React hook for managing tone presets.
 *
 * Provides a set of predefined tone presets that bundle a tone with
 * configuration options like maxWords and custom openers. Users can
 * select a preset and the hook applies its configuration to the draft.
 */

import { useState, useCallback, useMemo } from "react";
import type { ToneId } from "../services/emailToneRewriter";

export interface TonePreset {
  /** Unique identifier for this preset. */
  id: string;
  /** Display label shown in the UI. */
  label: string;
  /** Short description of when to use this preset. */
  description: string;
  /** The tone to apply. */
  tone: ToneId;
  /** Optional word cap for the rewrite. */
  maxWords?: number;
  /** Whether this preset prefers a shorter rewrite. */
  preferShort: boolean;
  /** Whether this preset adds an apology prefix. */
  includesApology: boolean;
}

export interface CustomPresetInput {
  label: string;
  description: string;
  tone: ToneId;
  maxWords?: number;
  preferShort: boolean;
  includesApology: boolean;
}

export interface UseTonePresetsReturn {
  /** Built-in presets that ship with the tool. */
  builtInPresets: TonePreset[];
  /** User-defined custom presets. */
  customPresets: TonePreset[];
  /** All available presets (built-in + custom). */
  allPresets: TonePreset[];
  /** Finds a preset by its id. */
  findById: (id: string) => TonePreset | undefined;
  /** Registers a new custom preset. */
  addPreset: (input: CustomPresetInput) => TonePreset;
  /** Removes a custom preset by its id. Built-in presets cannot be removed. */
  removePreset: (id: string) => void;
  /** Updates a custom preset. */
  updatePreset: (id: string, input: Partial<CustomPresetInput>) => void;
  /** Resets custom presets to the default set. */
  resetCustom: () => void;
  /** Returns the preset that best matches a given tone and options. */
  bestMatch: (tone: ToneId, maxWords?: number) => TonePreset;
}

let customCounter = 0;

function nextCustomId(): string {
  customCounter += 1;
  return `custom-${customCounter}`;
}

const BUILT_IN_PRESETS: TonePreset[] = [
  {
    id: "preset-concise-quick",
    label: "Quick & Concise",
    description: "Short, direct, and to the point. Best for busy recipients.",
    tone: "concise",
    maxWords: 50,
    preferShort: true,
    includesApology: false,
  },
  {
    id: "preset-concise-standard",
    label: "Concise",
    description: "Removes filler words while preserving all key points.",
    tone: "concise",
    preferShort: true,
    includesApology: false,
  },
  {
    id: "preset-friendly-warm",
    label: "Warm & Friendly",
    description: "A warm, approachable tone for colleagues and partners.",
    tone: "friendly",
    preferShort: false,
    includesApology: false,
  },
  {
    id: "preset-formal-business",
    label: "Formal Business",
    description: "Professional language for clients and stakeholders.",
    tone: "formal",
    preferShort: false,
    includesApology: false,
  },
  {
    id: "preset-formal-executive",
    label: "Executive Summary",
    description: "Very formal, expanded language for executive communication.",
    tone: "formal",
    maxWords: 30,
    preferShort: true,
    includesApology: false,
  },
  {
    id: "preset-apologetic-standard",
    label: "Apologetic",
    description: "Adds an apology prefix and softens the language.",
    tone: "apologetic",
    preferShort: false,
    includesApology: true,
  },
  {
    id: "preset-apologetic-brief",
    label: "Brief Apology",
    description: "A short, sincere apology without over-explaining.",
    tone: "apologetic",
    maxWords: 40,
    preferShort: true,
    includesApology: true,
  },
];

function presetFromInput(input: CustomPresetInput, id: string): TonePreset {
  return {
    id,
    label: input.label,
    description: input.description,
    tone: input.tone,
    maxWords: input.maxWords,
    preferShort: input.preferShort,
    includesApology: input.includesApology,
  };
}

export function useTonePresets(): UseTonePresetsReturn {
  const [customPresets, setCustomPresets] = useState<TonePreset[]>([]);

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  const findById = useCallback(
    (id: string): TonePreset | undefined => {
      return allPresets.find((p) => p.id === id);
    },
    [allPresets],
  );

  const addPreset = useCallback((input: CustomPresetInput): TonePreset => {
    const id = nextCustomId();
    const preset = presetFromInput(input, id);
    setCustomPresets((prev) => [...prev, preset]);
    return preset;
  }, []);

  const removePreset = useCallback((id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePreset = useCallback((id: string, input: Partial<CustomPresetInput>) => {
    setCustomPresets((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...input,
              id,
            }
          : p,
      ),
    );
  }, []);

  const resetCustom = useCallback(() => {
    setCustomPresets([]);
  }, []);

  const bestMatch = useCallback(
    (tone: ToneId, maxWords?: number): TonePreset => {
      const candidates = allPresets.filter((p) => p.tone === tone);
      if (candidates.length === 0) {
        return allPresets[0];
      }
      if (maxWords !== undefined) {
        const exact = candidates.find(
          (c) => c.maxWords !== undefined && Math.abs(c.maxWords - maxWords) <= 10,
        );
        if (exact) return exact;
      }
      return candidates[0];
    },
    [allPresets],
  );

  return {
    builtInPresets: BUILT_IN_PRESETS,
    customPresets,
    allPresets,
    findById,
    addPreset,
    removePreset,
    updatePreset,
    resetCustom,
    bestMatch,
  };
}
