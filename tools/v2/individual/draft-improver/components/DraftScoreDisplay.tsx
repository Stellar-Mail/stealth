import type { DraftScore } from "../types";

interface DraftScoreDisplayProps {
  score: DraftScore;
  summary: string;
}

function scoreColor(value: number): string {
  if (value >= 90) return "bg-emerald-500";
  if (value >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(value: number): string {
  if (value >= 90) return "text-emerald-800";
  if (value >= 70) return "text-amber-800";
  return "text-red-800";
}

const scoreItems: Array<{ key: keyof DraftScore; label: string }> = [
  { key: "overall", label: "Overall" },
  { key: "subject", label: "Subject" },
  { key: "body", label: "Body" },
  { key: "clarity", label: "Clarity" },
  { key: "tone", label: "Tone" },
  { key: "structure", label: "Structure" },
];

export function DraftScoreDisplay({ score, summary }: DraftScoreDisplayProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-4 text-sm font-medium text-slate-700">{summary}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {scoreItems.map(({ key, label }) => (
          <div key={key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 flex items-center gap-2">
              <div className="h-2 w-full max-w-24 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${scoreColor(score[key])}`}
                  style={{ width: `${score[key]}%` }}
                />
              </div>
              <span className={`text-sm font-semibold ${scoreTextColor(score[key])}`}>
                {score[key]}
              </span>
            </dd>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { DraftScoreDisplayProps };
