/**
 * Pilot Enrollment Form Component
 * 
 * Collects user consent and enrolls them in the pilot program.
 * Displays pilot protocol and consent language before enrollment.
 */

import { useState } from "react";

interface PilotEnrollmentFormProps {
  onEnroll: (consentGiven: boolean) => void;
  isLoading?: boolean;
}

export function PilotEnrollmentForm({
  onEnroll,
  isLoading = false,
}: PilotEnrollmentFormProps) {
  const [agreedToConsent, setAgreedToConsent] = useState(false);
  const [agreedToRetention, setAgreedToRetention] = useState(false);
  const [agreedToAnalytics, setAgreedToAnalytics] = useState(false);
  const [showFullConsent, setShowFullConsent] = useState(false);

  const allConsentsGiven = agreedToConsent && agreedToRetention && agreedToAnalytics;

  const handleEnroll = () => {
    if (allConsentsGiven) {
      onEnroll(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Join the Concierge Pilot</h2>
        <p className="text-gray-600">
          Help us build better inbox controls through a two-week pilot program.
        </p>
      </div>

      {/* Pilot Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-blue-900">What is this?</h3>
        <ul className="space-y-2 text-sm text-blue-900">
          <li>
            <span className="font-medium">Two-week pilot:</span> You'll configure
            and test your inbox access policies during a focused period.
          </li>
          <li>
            <span className="font-medium">Your policies:</span> Allow, request
            approval, block, or require postage payment for unknown senders.
          </li>
          <li>
            <span className="font-medium">We measure:</span> Policy decisions,
            your manual overrides, and false positives—without storing your
            messages.
          </li>
          <li>
            <span className="font-medium">Your feedback:</span> Helps us refine
            inbox control requirements before building larger infrastructure.
          </li>
        </ul>
      </div>

      {/* Consent Sections */}
      <div className="space-y-3">
        {/* Core Consent */}
        <div className="border rounded-lg p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToConsent}
              onChange={(e) => setAgreedToConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded"
            />
            <span className="text-sm">
              <span className="font-medium">Participation Consent:</span> I
              understand I'm joining a pilot program to test inbox policy controls,
              and I agree to configure policies and provide feedback on their
              effectiveness.
            </span>
          </label>
        </div>

        {/* Data Retention Consent */}
        <div className="border rounded-lg p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToRetention}
              onChange={(e) => setAgreedToRetention(e.target.checked)}
              className="mt-1 w-4 h-4 rounded"
            />
            <span className="text-sm">
              <span className="font-medium">Data Retention:</span> I understand
              that pilot measurements (policy decisions, overrides, false positives)
              will be retained for two weeks after the pilot ends for analysis
              purposes.
            </span>
          </label>
        </div>

        {/* Analytics Consent */}
        <div className="border rounded-lg p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToAnalytics}
              onChange={(e) => setAgreedToAnalytics(e.target.checked)}
              className="mt-1 w-4 h-4 rounded"
            />
            <span className="text-sm">
              <span className="font-medium">Privacy-Safe Analytics:</span> I
              consent to privacy-focused measurement where message bodies are never
              stored, sender identifiers are hashed, and only policy decisions and
              override patterns are tracked to measure pilot success.
            </span>
          </label>
        </div>
      </div>

      {/* Full Consent Details */}
      <div className="space-y-2">
        <button
          onClick={() => setShowFullConsent(!showFullConsent)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showFullConsent ? "Hide" : "Show"} Full Consent Details
        </button>

        {showFullConsent && (
          <div className="bg-gray-50 border rounded-lg p-4 space-y-3 text-xs text-gray-700">
            <h4 className="font-semibold text-gray-900">Pilot Protocol Details</h4>
            <div className="space-y-2">
              <div>
                <h5 className="font-medium text-gray-900">Duration</h5>
                <p>
                  This pilot runs for two weeks (14 days) from your enrollment
                  date.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Participant Cohort</h5>
                <p>
                  We're enrolling 8-12 users with diverse email workflows to test
                  real communication scenarios.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">
                  Policy Configuration
                </h5>
                <p>
                  You'll configure rules across four categories: allow (trusted
                  senders), request (approval required), block (no delivery), and
                  paid-access (postage required).
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Measurement</h5>
                <p>
                  We measure policy effectiveness through: (1) policy decision
                  counts, (2) your manual overrides, (3) false positive reports, and
                  (4) triage effort reduction.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Privacy Protection</h5>
                <p>
                  Message bodies are never stored. Sender identifiers are hashed.
                  Only policy decisions and behavioral patterns are tracked under a
                  privacy budget to ensure no PII leakage.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Success Metrics</h5>
                <p>
                  The pilot succeeds if 70% of participants keep a restrictive
                  policy enabled and report lower triage effort.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">
                  Requirements Updates
                </h5>
                <p>
                  Based on observed behavior, we'll update system requirements
                  before deeper infrastructure investment.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900">Data Retention</h5>
                <p>
                  Pilot measurements will be kept for two weeks after pilot
                  completion for analysis, then archived or deleted per your
                  request.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleEnroll}
          disabled={!allConsentsGiven || isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Enrolling..." : "Enroll in Pilot"}
        </button>
      </div>

      {/* Consent Summary */}
      {allConsentsGiven && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <span className="font-medium">✓ All consents confirmed.</span> You're
          ready to join the pilot. Your contribution will help shape inbox control
          design.
        </div>
      )}
    </div>
  );
}
