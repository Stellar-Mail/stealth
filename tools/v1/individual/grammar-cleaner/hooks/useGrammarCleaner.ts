import { useState, useCallback } from "react";
import type { GrammarInput, GrammarState } from "../services/grammarCleaner";
import { toReadyState } from "../services/grammarCleaner";
import { safeCleanGrammar } from "../services/guards";

export interface UseGrammarCleanerReturn {
  state: GrammarState;
  value: string;
  setValue: (value: string) => void;
  check: (input?: GrammarInput) => void;
  reset: () => void;
}

export function useGrammarCleaner(): UseGrammarCleanerReturn {
  const [state, setState] = useState<GrammarState>({ status: "idle" });
  const [value, setValue] = useState("");

  const check = useCallback(
    (input?: GrammarInput) => {
      setState({ status: "loading" });
      const payload = input ?? { bodyText: value };
      const result = safeCleanGrammar(payload);
      setState(toReadyState(result));
    },
    [value],
  );

  const reset = useCallback(() => {
    setValue("");
    setState({ status: "idle" });
  }, []);

  return { state, value, setValue, check, reset };
}
