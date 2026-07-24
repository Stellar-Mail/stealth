import { useState } from "react";
import { GitMerge, PenLine, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Draft } from "./types/draft";
import { CampaignMessageAssignmentPanel } from "./components/CampaignMessageAssignmentPanel";
import { CampaignSnapshots } from "./components/CampaignSnapshots";
import { CampaignEditorPanel } from "./components/CampaignEditorPanel";
import { defaultCampaignSnapshots } from "./fixtures/campaignSnapshotFixtures";

export function CampaignsContent() {
  const [campaignSubView, setCampaignSubView] = useState<"assignments" | "snapshots" | "editor">(
    "assignments",
  );
  const [campaignDraftDataset, setCampaignDraftDataset] = useState<Draft[]>(
    () => defaultCampaignSnapshots[0]?.drafts ?? [],
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] p-1 border border-white/[0.06] w-fit">
        {(
          [
            { key: "assignments" as const, label: "Assignments", icon: Target },
            { key: "snapshots" as const, label: "Merge & Snapshots", icon: GitMerge },
            { key: "editor" as const, label: "Editor", icon: PenLine },
          ] as const
        ).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = campaignSubView === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => setCampaignSubView(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                isActive
                  ? "bg-white/[0.08] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {campaignSubView === "assignments" && <CampaignMessageAssignmentPanel />}
      {campaignSubView === "snapshots" && (
        <CampaignSnapshots
          currentDataset={campaignDraftDataset}
          onRestoreDataset={setCampaignDraftDataset}
        />
      )}
      {campaignSubView === "editor" && <CampaignEditorPanel />}
    </div>
  );
}
