import React from "react";
import type { SenderPersona } from "./types";

export interface SenderPersonaSelectorProps {
  personas: SenderPersona[];
  selectedId?: string;
  onSelect: (persona: SenderPersona) => void;
}

export function SenderPersonaSelector({
  personas,
  selectedId,
  onSelect,
}: SenderPersonaSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="persona-selector" className="text-sm font-medium">
        Select Sender Persona
      </label>
      <select
        id="persona-selector"
        value={selectedId || ""}
        onChange={(e) => {
          const found = personas.find((p) => p.id === e.target.value);
          if (found) onSelect(found);
        }}
        className="p-2 border rounded-md"
      >
        <option value="" disabled>
          -- Choose a persona --
        </option>
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.name} ({persona.email})
          </option>
        ))}
      </select>
    </div>
  );
}
