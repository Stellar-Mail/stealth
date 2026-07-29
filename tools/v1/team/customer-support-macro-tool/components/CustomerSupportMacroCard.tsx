import type { KeyboardEvent } from "react";
import type { Macro } from "../types";

export interface CustomerSupportMacroCardProps {
  macro: Macro;
  onSelect?: (macro: Macro) => void;
}

export function CustomerSupportMacroCard({ macro, onSelect }: CustomerSupportMacroCardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onSelect) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(macro);
    }
  }

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`Macro ${macro.title}`}
      onClick={() => onSelect?.(macro)}
      onKeyDown={handleKeyDown}
    >
      <header>
        <h3>{macro.title}</h3>
      </header>

      <p>{macro.body}</p>

      <dl>
        <dt>Category</dt>
        <dd>{macro.category}</dd>

        <dt>Usage</dt>
        <dd>{macro.usageCount}</dd>
      </dl>

      {macro.tags.length > 0 ? (
        <ul aria-label="Macro tags">
          {macro.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}

      {macro.isFavorite ? <span aria-label="Favorite macro">★ Favorite</span> : null}
    </article>
  );
}
