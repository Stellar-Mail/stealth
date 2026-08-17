/**
 * Attachment Extractor - UI Component
 * Local component for attachment extraction interface
 */

import React, { useRef } from "react";
import { FileUp, Trash2, Download, CheckSquare, Square } from "lucide-react";
import { useExtractor } from "./hooks";
import type { ExtractionOptions } from "./types";
import { formatFileSize } from "./services";
import "./styles.css";

interface AttachmentExtractorUIProps {
  options?: ExtractionOptions;
  onFilesExtracted?: (count: number) => void;
}

/**
 * Main component for attachment extraction
 */
export function AttachmentExtractorUI({ options, onFilesExtracted }: AttachmentExtractorUIProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    state,
    extract,
    selectAttachment,
    deselectAttachment,
    selectAll,
    deselectAll,
    removeAttachment,
    clearAll,
    downloadSelected,
  } = useExtractor(options);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const result = await extract(files, options);
      onFilesExtracted?.(result.attachments.length);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isAllSelected = state.files.length > 0 && state.selectedIds.size === state.files.length;
  const isSomeSelected = state.selectedIds.size > 0 && state.selectedIds.size < state.files.length;

  return (
    <div className="attachment-extractor">
      {/* Header */}
      <div className="extractor-header">
        <h2>Attachment Extractor</h2>
        <p className="extractor-description">Extract and manage attachments from your messages</p>
      </div>

      {/* Upload Area */}
      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="file-input"
          disabled={state.loadingState === "loading"}
        />
        <div className="upload-content">
          <FileUp className="upload-icon" />
          <p className="upload-title">Drag files here or click to select</p>
          <p className="upload-hint">Supports images, documents, archives, video, and audio</p>
        </div>
      </div>

      {/* Loading State */}
      {state.loadingState === "loading" && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Extracting attachments...</p>
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <div className="error-state">
          <p className="error-message">{state.error}</p>
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
        </div>
      )}

      {/* Toolbar */}
      {state.files.length > 0 && (
        <div className="toolbar">
          <div className="toolbar-left">
            <button
              className={`toolbar-button ${isAllSelected ? "active" : ""} ${
                isSomeSelected ? "indeterminate" : ""
              }`}
              onClick={() => (isAllSelected ? deselectAll() : selectAll())}
              title={isAllSelected ? "Deselect all" : "Select all"}
            >
              {isAllSelected || isSomeSelected ? (
                <CheckSquare className="icon" />
              ) : (
                <Square className="icon" />
              )}
              <span>
                {state.selectedIds.size > 0 ? `${state.selectedIds.size} selected` : "Select all"}
              </span>
            </button>
          </div>
          <div className="toolbar-right">
            <button
              className="toolbar-button"
              onClick={downloadSelected}
              disabled={state.selectedIds.size === 0}
              title="Download selected"
            >
              <Download className="icon" />
              <span>Download</span>
            </button>
            <button
              className="toolbar-button danger"
              onClick={clearAll}
              title="Remove all attachments"
            >
              <Trash2 className="icon" />
              <span>Clear All</span>
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      {state.files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <div className="file-name-col">Name</div>
            <div className="file-size-col">Size</div>
            <div className="file-type-col">Type</div>
            <div className="file-actions-col">Actions</div>
          </div>
          {state.files.map((attachment) => (
            <div key={attachment.id} className="file-item">
              <div className="file-checkbox">
                <input
                  type="checkbox"
                  checked={state.selectedIds.has(attachment.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAttachment(attachment.id);
                    } else {
                      deselectAttachment(attachment.id);
                    }
                  }}
                />
              </div>
              <div className="file-name-col">
                <span className="file-icon">{getCategoryIcon(attachment.category)}</span>
                <span className="file-name">{attachment.name}</span>
              </div>
              <div className="file-size-col">{formatFileSize(attachment.size)}</div>
              <div className="file-type-col">
                <span className="category-badge">{attachment.category}</span>
              </div>
              <div className="file-actions-col">
                <button className="action-button download" title={`Download ${attachment.name}`}>
                  <Download className="icon-sm" />
                </button>
                <button
                  className="action-button delete"
                  onClick={() => removeAttachment(attachment.id)}
                  title={`Remove ${attachment.name}`}
                >
                  <Trash2 className="icon-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {state.files.length === 0 && state.loadingState === "idle" && !state.error && (
        <div className="empty-state">
          <p>No attachments extracted yet</p>
          <p className="empty-hint">Upload files to get started</p>
        </div>
      )}
    </div>
  );
}

/**
 * Get icon for attachment category
 */
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
