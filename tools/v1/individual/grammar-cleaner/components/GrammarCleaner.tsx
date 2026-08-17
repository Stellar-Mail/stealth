import type { JSX } from "react";
import type { GrammarState } from "../services/grammarCleaner";
import { GrammarCleanerEmpty } from "./GrammarCleanerEmpty";
import { GrammarCleanerLoading } from "./GrammarCleanerLoading";
import { GrammarCleanerError } from "./GrammarCleanerError";
import { GrammarCleanerView } from "./GrammarCleanerView";

export interface GrammarCleanerProps {
  state: GrammarState;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRetry?: () => void;
  onReset?: () => void;
}

export function GrammarCleaner({
  state,
  value,
  onChange,
  onSubmit,
  onRetry,
  onReset,
}: GrammarCleanerProps): JSX.Element {
  switch (state.status) {
    case "idle":
      return <GrammarCleanerEmpty value={value} onChange={onChange} onSubmit={onSubmit} />;
    case "loading":
      return <GrammarCleanerLoading />;
    case "error":
      return <GrammarCleanerError code={state.code} message={state.message} onRetry={onRetry} />;
    case "ready":
      return <GrammarCleanerView result={state.result} onReset={onReset ?? (() => {})} />;
  }
}
