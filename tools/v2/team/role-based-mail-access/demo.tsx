import React from "react";
import { AccessConsole } from "./components/AccessConsole";

export function RoleBasedMailAccessDemo() {
  return (
    <div className="w-full min-h-screen bg-zinc-950 p-6 md:p-12 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        <AccessConsole />
      </div>
    </div>
  );
}

export default RoleBasedMailAccessDemo;
