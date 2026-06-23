/**
 * Pilot Metrics Dashboard Component
 * 
 * Displays pilot progress, user metrics, and success signals.
 * Shows adoption rates, policy effectiveness, and triage reduction.
 */

import type { PilotMetrics, PilotCohortAnalysis } from "../types";

interface PilotMetricsDashboardProps {
  userMetrics?: PilotMetrics;
  cohortAnalysis?: PilotCohortAnalysis;
}

export function PilotMetricsDashboard({
  userMetrics,
  cohortAnalysis,
}: PilotMetricsDashboardProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Pilot Metrics</h2>

      {/* User Metrics */}
      {userMetrics && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Metrics</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Enrollment Duration */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Days in Pilot
              </div>
              <div className="text-3xl font-bold mt-1">
                {userMetrics.enrollmentDuration}
              </div>
            </div>

            {/* Policy Decisions */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Policy Decisions
              </div>
              <div className="text-3xl font-bold mt-1">
                {userMetrics.policyDecisionCount}
              </div>
            </div>

            {/* Manual Overrides */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Manual Overrides
              </div>
              <div className="text-3xl font-bold mt-1">
                {userMetrics.manualOverrideCount}
              </div>
            </div>

            {/* False Positives */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                False Positives
              </div>
              <div className="text-3xl font-bold mt-1">
                {userMetrics.falsePositiveCount}
              </div>
            </div>
          </div>

          {/* Adoption Status */}
          {userMetrics.restrictivePolicyAdopted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div className="space-y-1">
                  <div className="font-medium text-green-900">
                    Restrictive Policy Adopted
                  </div>
                  <div className="text-sm text-green-800">
                    Enabled for{" "}
                    <span className="font-semibold">
                      {userMetrics.restrictivePolicyRetention.toFixed(1)}%
                    </span>{" "}
                    of pilot duration
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Triage Effort Reduction */}
          <div className="border rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-2">
              Triage Effort Reduction
            </div>
            <div className="flex items-end gap-3">
              <div className="text-3xl font-bold">
                {userMetrics.triageEffortReduction.toFixed(1)}%
              </div>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min(100, userMetrics.triageEffortReduction)}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Based on reduced manual overrides and policy effectiveness
            </p>
          </div>

          {/* Success Signal */}
          {userMetrics.successSignalMet ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🎉</div>
                <div className="space-y-1">
                  <div className="font-bold text-green-900">
                    Success Criteria Met!
                  </div>
                  <div className="text-sm text-green-800">
                    Your metrics show restrictive policy retention of{" "}
                    <span className="font-semibold">
                      {userMetrics.restrictivePolicyRetention.toFixed(1)}%
                    </span>{" "}
                    (70%+ target) and triage effort reduction of{" "}
                    <span className="font-semibold">
                      {userMetrics.triageEffortReduction.toFixed(1)}%
                    </span>
                    . You're demonstrating that inbox controls provide real value.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-900">
                Keep using your policy configuration to help us validate the
                success criteria. We're looking for 70% retention of restrictive
                policies and measurable triage effort reduction.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cohort Analysis */}
      {cohortAnalysis && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Cohort Analysis</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Cohort Size */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Participants
              </div>
              <div className="text-3xl font-bold mt-1">
                {cohortAnalysis.cohortSize}
              </div>
            </div>

            {/* Adoption Rate */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Adoption Rate
              </div>
              <div className="text-3xl font-bold mt-1">
                {cohortAnalysis.restrictivePolicyAdoptionRate.toFixed(1)}%
              </div>
            </div>

            {/* Retention Rate */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Retention Rate
              </div>
              <div className="text-3xl font-bold mt-1">
                {cohortAnalysis.retentionRate.toFixed(1)}%
              </div>
            </div>

            {/* Avg Triage Reduction */}
            <div className="border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Avg Triage Reduction
              </div>
              <div className="text-3xl font-bold mt-1">
                {cohortAnalysis.avgTriageEffortReduction.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Cohort Success Signal */}
          {cohortAnalysis.successSignalAchieved ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">✓</div>
                <div className="space-y-1">
                  <div className="font-bold text-green-900">Pilot Successful</div>
                  <div className="text-sm text-green-800">
                    Cohort shows {cohortAnalysis.retentionRate.toFixed(1)}%
                    retention of restrictive policies and{" "}
                    {cohortAnalysis.avgTriageEffortReduction.toFixed(1)}% average
                    triage reduction. This validates observable behavior for
                    deeper infrastructure investment.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm text-yellow-900">
                Cohort is still developing patterns. Continue pilot to reach success
                threshold: 70% retention + measurable triage reduction.
              </div>
            </div>
          )}

          {/* Requirements Updates */}
          {cohortAnalysis.requirementsUpdates.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <h4 className="font-medium">Requirements Updates</h4>
              <ul className="space-y-1">
                {cohortAnalysis.requirementsUpdates.map((update, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>{update}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* No Data */}
      {!userMetrics && !cohortAnalysis && (
        <div className="text-center py-8 text-gray-500">
          <p>No metrics available yet. Complete pilot participation to see results.</p>
        </div>
      )}
    </div>
  );
}
