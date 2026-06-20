import React from "react";
import { AccessPolicy } from "../types";
import { LIMITS } from "../guards/access-guards.mjs";

interface PolicyMatrixProps {
  policy: AccessPolicy;
  onPolicyChange: (role: string, accessLevels: string[]) => void;
}

export function PolicyMatrix({ policy, onPolicyChange }: PolicyMatrixProps) {
  const roles = LIMITS.ALLOWED_ROLES;
  const accessLevels = LIMITS.ALLOWED_ACCESS_LEVELS;

  const handleToggle = (role: string, level: string, isChecked: boolean) => {
    const currentLevels = policy[role] || [];
    let newLevels: string[];

    if (isChecked) {
      newLevels = [...currentLevels, level];
    } else {
      newLevels = currentLevels.filter((l) => l !== level);
    }

    onPolicyChange(role, newLevels);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Access Level Control Matrix
        </h3>
        <p className="text-xs text-zinc-500">
          Dynamically configure access policies by role. Checkboxes automatically update checking
          rules in real-time.
        </p>
      </div>

      <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-900/10">
        <table
          className="w-full text-left border-collapse"
          role="grid"
          aria-label="Role Access Levels Matrix"
        >
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/40 text-[10px] uppercase tracking-wider text-zinc-400">
              <th className="p-3 font-semibold">Role Name</th>
              {accessLevels.map((level) => (
                <th key={level} className="p-3 text-center font-semibold">
                  {level}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850/60 text-xs">
            {roles.map((role) => {
              const assignedLevels = policy[role] || [];

              return (
                <tr key={role} className="hover:bg-zinc-900/30 transition duration-150" role="row">
                  <td className="p-3 font-semibold text-zinc-200 capitalize">{role}</td>
                  {accessLevels.map((level) => {
                    const hasAccess = assignedLevels.includes(level);
                    const checkboxId = `policy-${role}-${level}`;

                    return (
                      <td key={level} className="p-3 text-center" role="gridcell">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            id={checkboxId}
                            checked={hasAccess}
                            onChange={(e) => handleToggle(role, level, e.target.checked)}
                            aria-label={`Allow ${level} permission for role ${role}`}
                            className="w-4.5 h-4.5 rounded border-zinc-800 text-sky-600 bg-zinc-950 focus:ring-1 focus:ring-sky-500 focus:outline-none focus:ring-offset-0 transition cursor-pointer"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default PolicyMatrix;
