/**
 * Attachment Extractor - Demo Component
 * Demonstrates all features in a single page
 */

import React, { useState } from "react";
import { useExtractor } from "./hooks";
import { MOCK_ATTACHMENTS, MOCK_ERRORS } from "./fixtures";
import { formatFileSize } from "./services";
import "./styles.css";

/**
 * Demo component showcasing all Attachment Extractor features
 */
export function AttachmentExtractorDemo() {
  const [demoMode, setDemoMode] = useState<"empty" | "loading" | "success" | "error">("empty");
  const { state, extract, selectAll, deselectAll, removeAttachment, clearAll } = useExtractor();

  // Simulate different states for demo
  const simulateExtraction = async (mode: typeof demoMode) => {
    setDemoMode("loading");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (mode === "success") {
      // Simulate successful extraction
      const mockFiles = MOCK_ATTACHMENTS.map(
        (att) => new File(["data"], att.name, { type: att.mimeType }),
      );
      await extract(mockFiles);
    } else if (mode === "error") {
      // Simulate partial failure
      const mockFiles = [
        new File(["data"], "valid.jpg", { type: "image/jpeg" }),
        new File(["data"], "toolargeimage.bin", { type: "application/octet-stream" }),
      ];
      await extract(mockFiles, {
        allowedMimeTypes: ["image/jpeg"],
        maxFileSize: 1024,
      });
    }

    setDemoMode(mode);
  };

  return (
    <div className="attachment-extractor">
      {/* Header */}
      <div className="extractor-header">
        <h2>Attachment Extractor - Demo</h2>
        <p className="extractor-description">
          Explore all features: extraction, categorization, validation, and state management
        </p>
      </div>

      {/* Demo Controls */}
      <div className="demo-controls">
        <button className="demo-button" onClick={() => simulateExtraction("success")}>
          Simulate Successful Extraction
        </button>
        <button className="demo-button" onClick={() => simulateExtraction("error")}>
          Simulate Extraction with Errors
        </button>
        <button className="demo-button secondary" onClick={clearAll}>
          Clear All
        </button>
      </div>

      {/* Current State Display */}
      <div className="state-display">
        <h3>Current State</h3>
        <div className="state-info">
          <p>
            <strong>Loading State:</strong> <code>{state.loadingState}</code>
          </p>
          <p>
            <strong>Files Extracted:</strong> <code>{state.files.length}</code>
          </p>
          <p>
            <strong>Selected:</strong> <code>{state.selectedIds.size}</code>
          </p>
          <p>
            <strong>Total Size:</strong> <code>{formatFileSize(state.stats.totalSize)}</code>
          </p>
        </div>
      </div>

      {/* Loading State Demo */}
      {state.loadingState === "loading" && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Extracting attachments...</p>
        </div>
      )}

      {/* Error State Demo */}
      {state.error && (
        <div className="error-state">
          <p className="error-message">{state.error}</p>
          <p className="error-detail">Some files failed validation or extraction</p>
        </div>
      )}

      {/* Statistics */}
      {state.files.length > 0 && (
        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">Total Files</span>
            <span className="stat-value">{state.stats.successfulExtractions}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Size</span>
            <span className="stat-value">{formatFileSize(state.stats.totalSize)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Images</span>
            <span className="stat-value">{state.stats.byCategory.image}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Documents</span>
            <span className="stat-value">{state.stats.byCategory.document}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Archives</span>
            <span className="stat-value">{state.stats.byCategory.archive}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Videos</span>
            <span className="stat-value">{state.stats.byCategory.video}</span>
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      {state.files.length > 0 && (
        <div className="toolbar">
          <button className="toolbar-button" onClick={selectAll}>
            Select All ({state.files.length})
          </button>
          <button className="toolbar-button" onClick={deselectAll}>
            Clear Selection
          </button>
          <span className="selection-count">
            {state.selectedIds.size > 0 ? `${state.selectedIds.size} selected` : "No selection"}
          </span>
        </div>
      )}

      {/* File List */}
      {state.files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <div className="file-name-col">Name</div>
            <div className="file-size-col">Size</div>
            <div className="file-type-col">Category</div>
            <div className="file-actions-col">Metadata</div>
          </div>
          {state.files.map((attachment) => (
            <div key={attachment.id} className="file-item">
              <div className="file-name-col">
                <span className="file-icon">{getCategoryIcon(attachment.category)}</span>
                <span className="file-name">{attachment.name}</span>
              </div>
              <div className="file-size-col">{formatFileSize(attachment.size)}</div>
              <div className="file-type-col">
                <span className="category-badge">{attachment.category}</span>
              </div>
              <div className="file-actions-col">
                <button
                  className="action-button delete"
                  onClick={() => removeAttachment(attachment.id)}
                  title="Remove this file"
                >
                  ✕
                </button>
              </div>
              {attachment.metadata && (
                <div className="metadata-display">
                  {attachment.metadata.width && (
                    <span>
                      {attachment.metadata.width}×{attachment.metadata.height}px
                    </span>
                  )}
                  {attachment.metadata.duration && (
                    <span>{Math.round(attachment.metadata.duration)}s</span>
                  )}
                  {attachment.metadata.pages && <span>{attachment.metadata.pages} pages</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Features Showcase */}
      <div className="features-showcase">
        <h3>✨ Features</h3>
        <ul className="feature-list">
          <li>📁 **File Categorization** - Automatic classification into 6 categories</li>
          <li>✅ **Validation** - File size and MIME type whitelisting</li>
          <li>📊 **Statistics** - Real-time extraction stats and category breakdown</li>
          <li>🎨 **State Management** - Clean loading, success, and error states</li>
          <li>📸 **Metadata** - Optional extraction of image/video dimensions, duration</li>
          <li>🔒 **Isolated** - No main app dependencies, folder-local architecture</li>
          <li>🧪 **Testable** - Comprehensive mock fixtures and unit tests</li>
          <li>🎯 **Performant** - Parallel file processing, efficient API usage</li>
        </ul>
      </div>

      {/* API Documentation */}
      <div className="api-docs">
        <h3>📚 API Surface</h3>
        <div className="api-section">
          <h4>useExtractor(options?)</h4>
          <p>Main hook for extraction operations</p>
          <pre>
            {`const {
  state,                  // Current state
  extract,                // Extract files
  selectAttachment,       // Select file
  selectAll,              // Select all
  removeAttachment,       // Remove file
  downloadAttachment,     // Download
} = useExtractor();`}
          </pre>
        </div>

        <div className="api-section">
          <h4>extractAttachments(files, options?)</h4>
          <p>Core extraction function</p>
          <pre>
            {`const result = await extractAttachments(files, {
  maxFileSize: 50MB,
  allowedMimeTypes: [...],
  extractMetadata: true,
});`}
          </pre>
        </div>
      </div>

      {/* Empty State Message */}
      {state.files.length === 0 && state.loadingState === "idle" && !state.error && (
        <div className="empty-state">
          <p>No attachments yet</p>
          <p className="empty-hint">Click a button above to simulate extraction</p>
        </div>
      )}
    </div>
  );
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    image: "🖼️",
    document: "📄",
    archive: "📦",
    video: "🎬",
    audio: "🎵",
    other: "📎",
  };
  return icons[category] || "📎";
}

/* Demo-specific styles */
const demoStyles = `
.demo-controls {
  display: flex;
  gap: 10px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.demo-button {
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #3b82f6;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.demo-button:hover {
  background-color: #2563eb;
}

.demo-button.secondary {
  background-color: #ef4444;
}

.demo-button.secondary:hover {
  background-color: #dc2626;
}

.state-display {
  padding: 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin: 20px 0;
}

.state-info p {
  margin: 8px 0;
  font-size: 14px;
}

.state-info code {
  background-color: #e5e7eb;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.features-showcase {
  margin-top: 40px;
  padding: 20px;
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0 0;
}

.feature-list li {
  padding: 8px 0;
  font-size: 14px;
  color: #166534;
}

.api-docs {
  margin-top: 40px;
  padding: 20px;
  background-color: #fdf2f8;
  border: 1px solid #fbcfe8;
  border-radius: 6px;
}

.api-section {
  margin: 16px 0;
  padding: 12px;
  background-color: white;
  border: 1px solid #fbcfe8;
  border-radius: 4px;
}

.api-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #be123c;
}

.api-section pre {
  margin: 12px 0 0 0;
  padding: 12px;
  background-color: #fafafa;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}

.metadata-display {
  padding: 8px 0;
  font-size: 12px;
  color: #6b7280;
}

.metadata-display span {
  margin-right: 12px;
}

.selection-count {
  padding: 8px 12px;
  background-color: #e5e7eb;
  border-radius: 4px;
  font-size: 13px;
  color: #374151;
}
`;
