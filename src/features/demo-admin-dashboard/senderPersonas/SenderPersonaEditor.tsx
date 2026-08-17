import React, { useState, useEffect } from "react";
import type { SenderPersona, SenderPolicy } from "./types";

export interface SenderPersonaEditorProps {
  persona: SenderPersona;
  onChange: (updatedPersona: SenderPersona) => void;
  onSave?: () => void;
}

export function SenderPersonaEditor({ persona, onChange, onSave }: SenderPersonaEditorProps) {
  const [localPersona, setLocalPersona] = useState<SenderPersona>(persona);

  useEffect(() => {
    setLocalPersona(persona);
  }, [persona]);

  const handleChange = (field: keyof SenderPersona, value: string | boolean) => {
    const updated = { ...localPersona, [field]: value };
    setLocalPersona(updated);
    onChange(updated);
  };

  return (
    <div className="p-4 border rounded-md flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Edit Sender Persona</h3>

      <div className="flex flex-col gap-1">
        <label htmlFor="name-input" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name-input"
          type="text"
          value={localPersona.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="p-2 border rounded-md"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email-input" className="text-sm font-medium">
          Email (Must be safe domain)
        </label>
        <input
          id="email-input"
          type="text"
          value={localPersona.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className="p-2 border rounded-md"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="policy-select" className="text-sm font-medium">
          Sender Policy
        </label>
        <select
          id="policy-select"
          value={localPersona.policy}
          onChange={(e) => handleChange("policy", e.target.value as SenderPolicy)}
          className="p-2 border rounded-md"
        >
          <option value="none">None</option>
          <option value="allow">Allow</option>
          <option value="block">Block</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="trusted-checkbox"
          type="checkbox"
          checked={localPersona.isTrusted}
          onChange={(e) => handleChange("isTrusted", e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="trusted-checkbox" className="text-sm font-medium">
          Is Trusted
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="relay-input" className="text-sm font-medium">
          Relay Node (Optional)
        </label>
        <input
          id="relay-input"
          type="text"
          value={localPersona.relayNode || ""}
          onChange={(e) => handleChange("relayNode", e.target.value)}
          className="p-2 border rounded-md"
          placeholder="e.g. relay.stealth.demo"
        />
      </div>

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          className="mt-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Persona
        </button>
      )}
    </div>
  );
}
