import React from "react";
import { AssignmentConsole } from "./components/AssignmentConsole";

export function MultiAgentAssignmentDemo() {
  return (
    <div className="w-full min-h-screen bg-surface-panel p-6 md:p-12 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        <AssignmentConsole />
      </div>
    </div>
  );
}

export default MultiAgentAssignmentDemo;
