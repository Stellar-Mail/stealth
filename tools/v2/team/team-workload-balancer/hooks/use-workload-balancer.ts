import { useCallback, useMemo, useState } from "react";

const sampleMembers = [
  {
    id: "1",
    name: "Alice",
    workload: 4,
    capacity: 8,
  },
  {
    id: "2",
    name: "Brian",
    workload: 6,
    capacity: 8,
  },
];

export function useWorkloadBalancer() {
  const [selectedId, setSelectedId] = useState<string>();
  const [state, setState] = useState<"loading" | "success" | "error">("success");

  const retry = useCallback(() => {
    setState("success");
  }, []);

  const members = useMemo(() => sampleMembers, []);

  return {
    state,
    members,
    selectedId,
    selectMember: setSelectedId,
    retry,
  };
}
