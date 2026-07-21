/**
 * Folder-local, isolated UI component for raising a legal & compliance review flag.
 *
 * Designed to be presentation-only and framework-agnostic with zero dependencies
 * on core app design system or router.
 */

import React, { useState } from "react";
import type { ReviewFlagInput, ReviewFlagSeverity } from "../contract";
import type { ComplianceCategory } from "../types";
import { useReviewFlag } from "../hooks/useReviewFlag";
import type { ReviewFlagService } from "../services/review-flag-service";

export interface LegalReviewFlagFormProps {
  service: ReviewFlagService;
  reviewerId: string;
  targetResource: string;
  onSubmitted?: (flagId: string) => void;
  onCancel?: () => void;
}

export const LegalReviewFlagForm: React.FC<LegalReviewFlagFormProps> = ({
  service,
  reviewerId,
  targetResource,
  onSubmitted,
  onCancel,
}) => {
  const { state, submitFlag, resetState } = useReviewFlag(service);
  const [flagReason, setFlagReason] = useState("");
  const [severity, setSeverity] = useState<ReviewFlagSeverity>("high");
  const [category, setCategory] = useState<ComplianceCategory>("gdpr_privacy");
  const [evidenceInput, setEvidenceInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const evidenceRefs = evidenceInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const input: ReviewFlagInput = {
      reviewer: reviewerId,
      targetResource,
      flagReason,
      severity,
      evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : undefined,
    };

    const outcome = await submitFlag(input);
    if (!("code" in outcome)) {
      if (onSubmitted) {
        onSubmitted(outcome.flagId);
      }
    }
  };

  return (
    <div
      style={{
        padding: "1.5rem",
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        maxWidth: "32rem",
        fontFamily: "sans-serif",
      }}
    >
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", color: "#0f172a" }}>
        Flag for Legal & Compliance Review
      </h3>

      {state.successResult ? (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f0fdf4",
            color: "#166534",
            borderRadius: "0.375rem",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>Review Flag Raised Successfully</p>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
            Flag ID: <code>{state.successResult.flagId}</code>
          </p>
          <button
            type="button"
            onClick={resetState}
            style={{
              marginTop: "0.75rem",
              padding: "0.375rem 0.75rem",
              backgroundColor: "#166534",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            Flag Another Resource
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {state.error && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                borderRadius: "0.375rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}
            >
              {state.error}
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#334155" }}
            >
              Target Resource
            </label>
            <input
              type="text"
              value={targetResource}
              readOnly
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid #cbd5e1",
                backgroundColor: "#f8fafc",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#334155" }}
            >
              Compliance Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplianceCategory)}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid #cbd5e1",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
              }}
            >
              <option value="gdpr_privacy">GDPR / Data Privacy</option>
              <option value="financial_sec_finra">Financial / SEC & FINRA</option>
              <option value="hipaa_health">HIPAA / Health Data</option>
              <option value="ip_copyright">IP & Copyright</option>
              <option value="fraud_phishing">Fraud / Phishing Security</option>
              <option value="aml_sanctions">AML & Sanctions Screening</option>
              <option value="other">Other Regulatory Policy</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#334155" }}
            >
              Severity Level
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as ReviewFlagSeverity)}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid #cbd5e1",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
              }}
            >
              <option value="low">Low - Informational Review</option>
              <option value="medium">Medium - Standard Review Required</option>
              <option value="high">High - Urgent Compliance Flag</option>
              <option value="critical">Critical - Immediate Legal Escalation</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#334155" }}
            >
              Flag Rationale & Description *
            </label>
            <textarea
              required
              rows={4}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Detail the legal or regulatory concern prompting this review flag..."
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid #cbd5e1",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#334155" }}
            >
              Supporting Evidence References (comma-separated)
            </label>
            <input
              type="text"
              value={evidenceInput}
              onChange={(e) => setEvidenceInput(e.target.value)}
              placeholder="e.g. ticket:sec-102, scan:vt-991"
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid #cbd5e1",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={state.isSubmitting}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={state.isSubmitting}
              style={{
                padding: "0.5rem 1rem",
                border: "none",
                backgroundColor: state.isSubmitting ? "#94a3b8" : "#2563eb",
                color: "#ffffff",
                borderRadius: "0.375rem",
                cursor: state.isSubmitting ? "not-allowed" : "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              {state.isSubmitting ? "Submitting..." : "Submit Review Flag"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
