import React from "react";
import { MemberCard } from "./MemberCard";

export interface TeamMember {
  id: string;
  name: string;
  workload: number;
  capacity: number;
}

interface WorkloadListProps {
  members: TeamMember[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function WorkloadList({ members, selectedId, onSelect }: WorkloadListProps) {
  return (
    <section aria-labelledby="team-members-title">
      <h2 id="team-members-title" className="mb-4 text-base font-semibold">
        Team Members
      </h2>

      <ul className="space-y-3">
        {members.map((member) => (
          <li key={member.id}>
            <MemberCard
              {...member}
              selected={member.id === selectedId}
              onSelect={() => onSelect?.(member.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
