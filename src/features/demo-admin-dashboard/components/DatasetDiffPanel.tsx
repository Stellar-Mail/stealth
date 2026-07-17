import React from "react";
import type { DatasetDiff, ItemDiff, FieldDiff } from "../types/diff";
import "./DatasetDiffPanel.css";

interface DatasetDiffPanelProps {
  diff: DatasetDiff;
  title?: string;
}

/**
 * DatasetDiffPanel provides a visual comparison between an original fixture
 * and the current draft dataset. It highlights added, removed, and changed
 * items and fields in a safe, deterministic way for demo-admin review.
 */
export const DatasetDiffPanel: React.FC<DatasetDiffPanelProps> = ({
  diff,
  title = "Dataset Changes",
}) => {
  const { messages, senders, summary } = diff;

  const hasChanges = messages.length > 0 || senders.length > 0;

  return (
    <div className="dataset-diff-panel">
      <header className="dataset-diff-panel__header">
        <h3>{title}</h3>
        <div className="dataset-diff-panel__summary">
          <span className="dataset-diff-panel__summary-item dataset-diff-panel__summary-item--added">
            +{summary.added} added
          </span>
          <span className="dataset-diff-panel__summary-item dataset-diff-panel__summary-item--removed">
            -{summary.removed} removed
          </span>
          <span className="dataset-diff-panel__summary-item dataset-diff-panel__summary-item--changed">
            {summary.changed} changed
          </span>
        </div>
      </header>

      {!hasChanges ? (
        <div className="dataset-diff-panel__empty">No changes detected.</div>
      ) : (
        <>
          {messages.length > 0 && (
            <div className="dataset-diff-panel__section">
              <h4>Messages</h4>
              {messages.map((m) => (
                <DiffItem key={m.id} item={m} />
              ))}
            </div>
          )}

          {senders.length > 0 && (
            <div className="dataset-diff-panel__section">
              <h4>Senders</h4>
              {senders.map((s) => (
                <DiffItem key={s.id} item={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const DiffItem: React.FC<{ item: ItemDiff }> = ({ item }) => {
  return (
    <div className="dataset-diff-panel__item">
      <div className="dataset-diff-panel__item-header">
        <span className={`dataset-diff-panel__badge dataset-diff-panel__badge--${item.type}`}>
          {item.type}
        </span>
        <span className="dataset-diff-panel__item-id">{item.id}</span>
      </div>
      <div className="dataset-diff-panel__fields">
        {item.fields.map((f, i) => (
          <DiffField key={`${item.id}-${f.fieldName}-${i}`} field={f} />
        ))}
      </div>
    </div>
  );
};

const DiffField: React.FC<{ field: FieldDiff }> = ({ field }) => {
  const formatValue = (val: any) => {
    if (val === undefined || val === null) return "-";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="dataset-diff-panel__field">
      <span className="dataset-diff-panel__field-name">{field.fieldName}</span>
      <span className="dataset-diff-panel__field-old">
        {field.type !== "added" ? formatValue(field.oldValue) : ""}
      </span>
      <span className="dataset-diff-panel__field-new">
        {field.type !== "removed" ? formatValue(field.newValue) : ""}
      </span>
    </div>
  );
};
