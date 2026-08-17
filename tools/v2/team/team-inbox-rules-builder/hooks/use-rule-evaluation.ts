import { useState, useCallback, useRef } from "react";
import type { InboxRule, MailContext, RuleEvaluationResult } from "../types";
import { RuleEngineService } from "../services";

interface UseRuleEvaluationState {
  results: RuleEvaluationResult[];
  isEvaluating: boolean;
  error: string | null;
}

export function useRuleEvaluation() {
  const engineRef = useRef(new RuleEngineService());

  const [state, setState] = useState<UseRuleEvaluationState>({
    results: [],
    isEvaluating: false,
    error: null,
  });

  const evaluate = useCallback(async (rules: InboxRule[], mailContext: MailContext) => {
    setState((prev) => ({ ...prev, isEvaluating: true, error: null }));
    try {
      const results = engineRef.current.evaluateAll(rules, mailContext);
      setState({ results, isEvaluating: false, error: null });
      return results;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isEvaluating: false,
        error: err instanceof Error ? err.message : "Evaluation failed",
      }));
      return [];
    }
  }, []);

  const clearResults = useCallback(() => {
    setState({ results: [], isEvaluating: false, error: null });
  }, []);

  return {
    ...state,
    evaluate,
    clearResults,
  };
}
