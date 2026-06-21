import { useState, useCallback, useRef } from "react";
import type { InboxRule, RuleId, CreateRuleInput, UpdateRuleInput } from "../types";
import { RuleStorageService } from "../services";

interface UseRulesOptions {
  initialRules?: InboxRule[];
}

interface UseRulesState {
  rules: InboxRule[];
  isLoading: boolean;
  error: string | null;
}

export function useRules(options: UseRulesOptions = {}) {
  const serviceRef = useRef(new RuleStorageService(options.initialRules));

  const [state, setState] = useState<UseRulesState>({
    rules: options.initialRules ?? [],
    isLoading: false,
    error: null,
  });

  const fetchRules = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const rules = await serviceRef.current.getAllRules();
      setState({ rules, isLoading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch rules",
      }));
    }
  }, []);

  const addRule = useCallback(async (input: CreateRuleInput) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const rule = await serviceRef.current.addRule(input);
      setState((prev) => ({
        rules: [...prev.rules, rule].sort((a, b) => a.priority - b.priority),
        isLoading: false,
        error: null,
      }));
      return rule;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to add rule",
      }));
      return undefined;
    }
  }, []);

  const updateRule = useCallback(async (id: RuleId, input: UpdateRuleInput) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const updated = await serviceRef.current.updateRule(id, input);
      if (updated) {
        setState((prev) => ({
          rules: prev.rules
            .map((r) => (r.id === id ? updated : r))
            .sort((a, b) => a.priority - b.priority),
          isLoading: false,
          error: null,
        }));
      }
      return updated;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to update rule",
      }));
      return undefined;
    }
  }, []);

  const deleteRule = useCallback(async (id: RuleId) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await serviceRef.current.deleteRule(id);
      setState((prev) => ({
        rules: prev.rules.filter((r) => r.id !== id),
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to delete rule",
      }));
    }
  }, []);

  const toggleRule = useCallback(async (id: RuleId) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const updated = await serviceRef.current.toggleRule(id);
      if (updated) {
        setState((prev) => ({
          rules: prev.rules.map((r) => (r.id === id ? updated : r)),
          isLoading: false,
          error: null,
        }));
      }
      return updated;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to toggle rule",
      }));
      return undefined;
    }
  }, []);

  const searchRules = useCallback(async (query: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const results = await serviceRef.current.searchRules(query);
      setState({ rules: results, isLoading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to search rules",
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fetchRules,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    searchRules,
    clearError,
  };
}
