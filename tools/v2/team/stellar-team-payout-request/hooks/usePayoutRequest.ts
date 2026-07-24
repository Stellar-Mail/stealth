import { useState } from "react";

type State =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      recipient: string;
      amount: string;
      memo: string;
    }
  | { status: "form" };

export function usePayoutRequest() {
  const [state, setState] = useState<State>({
    status: "empty",
  });

  function create() {
    setState({
      status: "form",
    });
  }

  function retry() {
    setState({
      status: "form",
    });
  }

  function reset() {
    setState({
      status: "empty",
    });
  }

  return {
    state,
    create,
    retry,
    reset,
  };
}
