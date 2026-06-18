import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Loader2, Mail, UserPlus } from "lucide-react";
import { sampleContactRequests } from "./fixtures";
import { extractContacts, summarizeContacts } from "./services";
import type { ContactExtractionRequest, ExtractedContact, ExtractionStatus } from "./types";
import "./styles.css";

interface ContactExtractorUIProps {
  initialRequest?: ContactExtractionRequest;
  onSelectionChange?: (contacts: ExtractedContact[]) => void;
}

export function ContactExtractorUI({ initialRequest, onSelectionChange }: ContactExtractorUIProps) {
  const [sourceText, setSourceText] = useState(formatRequest(initialRequest ?? sampleContactRequests[0]));
  const [status, setStatus] = useState<ExtractionStatus>("idle");
  const [contacts, setContacts] = useState<ExtractedContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  const summary = useMemo(() => summarizeContacts(contacts), [contacts]);
  const selectedContacts = contacts.filter((contact) => selectedContactIds.includes(contact.id));

  const runExtraction = () => {
    setStatus("loading");
    setError(undefined);

    window.setTimeout(() => {
      const result = extractContacts({
        id: "manual-review",
        sourceLabel: "Manual review text",
        subject: "",
        from: "",
        body: sourceText,
      });

      if (result.status === "error") {
        setContacts([]);
        setSelectedContactIds([]);
        setError(result.error);
        setStatus("error");
        onSelectionChange?.([]);
        return;
      }

      setContacts(result.contacts);
      setSelectedContactIds(result.contacts.map((contact) => contact.id));
      setStatus("success");
      onSelectionChange?.(result.contacts);
    }, 180);
  };

  const loadSample = (request: ContactExtractionRequest) => {
    setSourceText(formatRequest(request));
    setContacts([]);
    setSelectedContactIds([]);
    setError(undefined);
    setStatus("idle");
    onSelectionChange?.([]);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((current) => {
      const next = current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId];
      onSelectionChange?.(contacts.filter((contact) => next.includes(contact.id)));
      return next;
    });
  };

  const selectAll = () => {
    const next = contacts.map((contact) => contact.id);
    setSelectedContactIds(next);
    onSelectionChange?.(contacts);
  };

  const clearSelection = () => {
    setSelectedContactIds([]);
    onSelectionChange?.([]);
  };

  const isLoading = status === "loading";
  const isEmpty = contacts.length === 0 && !error;

  return (
    <section className="contact-extractor" aria-labelledby="contact-extractor-title">
      <header className="contact-extractor__header">
        <div>
          <p className="contact-extractor__eyebrow">V1 individual tool</p>
          <h2 id="contact-extractor-title">Contact Extractor</h2>
          <p className="contact-extractor__description">
            Review contact details found in email text before a future save or export step.
          </p>
        </div>
        <UserPlus aria-hidden="true" className="contact-extractor__header-icon" />
      </header>

      <div className="contact-extractor__samples" aria-label="Sample email text">
        {sampleContactRequests.map((request) => (
          <button
            key={request.id}
            type="button"
            className="contact-extractor__sample-button"
            onClick={() => loadSample(request)}
            disabled={isLoading}
          >
            <Mail aria-hidden="true" />
            <span>{request.sourceLabel}</span>
          </button>
        ))}
      </div>

      <div className="contact-extractor__input-panel">
        <label htmlFor="contact-extractor-source">Email text</label>
        <p id="contact-extractor-source-help">
          Paste synthetic or user-provided email text. This isolated tool does not read mailboxes.
        </p>
        <textarea
          id="contact-extractor-source"
          aria-describedby="contact-extractor-source-help"
          value={sourceText}
          onChange={(event) => {
            setSourceText(event.target.value);
            if (status === "error") {
              setStatus("idle");
              setError(undefined);
            }
          }}
          disabled={isLoading}
          rows={8}
        />
        <div className="contact-extractor__actions">
          <button
            type="button"
            className="contact-extractor__primary"
            onClick={runExtraction}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 aria-hidden="true" className="contact-extractor__spin" />
            ) : (
              <ClipboardList aria-hidden="true" />
            )}
            <span>{isLoading ? "Extracting contacts" : "Extract contacts"}</span>
          </button>
          <button
            type="button"
            className="contact-extractor__secondary"
            onClick={() => setSourceText("")}
            disabled={isLoading}
          >
            Clear text
          </button>
        </div>
      </div>

      <div className="contact-extractor__status" aria-live="polite" aria-busy={isLoading}>
        {isLoading && (
          <div className="contact-extractor__state contact-extractor__state--loading">
            <Loader2 aria-hidden="true" className="contact-extractor__spin" />
            <span>Scanning email text for contact details.</span>
          </div>
        )}

        {error && (
          <div className="contact-extractor__state contact-extractor__state--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {isEmpty && !isLoading && (
          <div className="contact-extractor__state">
            <ClipboardList aria-hidden="true" />
            <span>No contacts extracted yet. Load a sample or paste email text to begin.</span>
          </div>
        )}

        {contacts.length > 0 && !isLoading && (
          <div className="contact-extractor__state contact-extractor__state--success">
            <CheckCircle2 aria-hidden="true" />
            <span>
              Found {summary.total} contacts, {summary.complete} complete records, and{" "}
              {summary.needsReview} needing review.
            </span>
          </div>
        )}
      </div>

      {contacts.length > 0 && (
        <section className="contact-extractor__results" aria-labelledby="contact-results-title">
          <div className="contact-extractor__results-header">
            <div>
              <h3 id="contact-results-title">Review contacts</h3>
              <p>{selectedContacts.length} selected for future save or export.</p>
            </div>
            <div className="contact-extractor__selection-actions">
              <button type="button" onClick={selectAll}>
                Select all
              </button>
              <button type="button" onClick={clearSelection}>
                Clear selection
              </button>
            </div>
          </div>

          <ul className="contact-extractor__list">
            {contacts.map((contact) => (
              <li key={contact.id} className="contact-extractor__contact-card">
                <label className="contact-extractor__checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.includes(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                  />
                  <span>{contact.displayName}</span>
                </label>
                <dl>
                  <div>
                    <dt>Email</dt>
                    <dd>{contact.email ?? "Missing"}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{contact.phone ?? "Missing"}</dd>
                  </div>
                  <div>
                    <dt>Organization</dt>
                    <dd>{contact.organization ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>
                      <span
                        className={`contact-extractor__confidence contact-extractor__confidence--${contact.confidence}`}
                      >
                        {contact.confidence}
                      </span>
                    </dd>
                  </div>
                </dl>
                {contact.warnings.length > 0 && (
                  <p className="contact-extractor__warnings">Review: {contact.warnings.join(", ")}</p>
                )}
                <p className="contact-extractor__evidence">{contact.evidence}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function formatRequest(request: ContactExtractionRequest) {
  return `Subject: ${request.subject}
From: ${request.from}

${request.body}`;
}
