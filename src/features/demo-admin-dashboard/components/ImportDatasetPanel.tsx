import React, { useState } from "react";
import type { ImportResult } from "../types/import";
import { parseDatasetJson } from "../utils/importHelpers";
import "./ImportDatasetPanel.css";

interface ImportDatasetPanelProps {
  onImportSuccess: (result: ImportResult) => void;
  title?: string;
}

/**
 * ImportDatasetPanel allows maintainers to paste a JSON dataset and import it
 * into the current draft state. It includes a validation pipeline that ensures
 * the data is safe and deterministic for the demo UI.
 */
export const ImportDatasetPanel: React.FC<ImportDatasetPanelProps> = ({
  onImportSuccess,
  title = "Import Dataset JSON",
}) => {
  const [jsonInput, setJsonInput] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = () => {
    setIsProcessing(true);
    // Use setTimeout to allow UI to update if the JSON is very large
    setTimeout(() => {
      const importResult = parseDatasetJson(jsonInput);
      setResult(importResult);
      setIsProcessing(false);

      if (importResult.success) {
        onImportSuccess(importResult);
        setJsonInput(""); // Clear input on success
      }
    }, 100);
  };

  return (
    <div className="import-dataset-panel">
      <header className="import-dataset-panel__header">
        <h3>{title}</h3>
      </header>

      <div className="import-dataset-panel__content">
        <p className="import-dataset-panel__description">
          Paste a dataset JSON below to update the current draft. All data will be validated for
          demo safety before being applied.
        </p>

        <textarea
          className="import-dataset-panel__textarea"
          placeholder='{ "id": "demo-v1", "name": "...", "messages": [...] }'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          disabled={isProcessing}
        />

        {result && !result.success && (
          <div className="import-dataset-panel__errors">
            <h4>Import Errors ({result.errors.length})</h4>
            {result.errors.map((err, i) => (
              <div key={i} className="import-dataset-panel__error-item">
                <span className="import-dataset-panel__error-path">{err.path}:</span>
                {err.message}
              </div>
            ))}
          </div>
        )}

        {result && result.success && (
          <div className="import-dataset-panel__success">
            ✓ Dataset imported successfully into draft state.
          </div>
        )}

        <div className="import-dataset-panel__actions">
          <button
            className="import-dataset-panel__button"
            onClick={handleImport}
            disabled={isProcessing || !jsonInput.trim()}
          >
            {isProcessing ? "Validating..." : "Validate & Import"}
          </button>
        </div>
      </div>
    </div>
  );
};
