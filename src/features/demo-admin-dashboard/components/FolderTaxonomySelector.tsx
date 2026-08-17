import type { ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { DEMO_FOLDERS, FOLDER_DEFINITIONS, type DemoFolder } from "../constants/folderTaxonomy";

export interface FolderTaxonomySelectorProps {
  /** Currently selected demo folder. */
  value: DemoFolder;
  /** Called with the newly selected folder. */
  onChange: (folder: DemoFolder) => void;
  /** Optional id for the select element. */
  id?: string;
  /** Optional extra class names for the wrapper. */
  className?: string;
}

export function FolderTaxonomySelector({
  value,
  onChange,
  id = "demo-folder",
  className,
}: FolderTaxonomySelectorProps) {
  const definition = FOLDER_DEFINITIONS[value];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Folder
      </label>
      <select
        id={id}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value as DemoFolder)
        }
        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-muted-foreground"
      >
        {DEMO_FOLDERS.map((folder) => (
          <option key={folder} value={folder}>
            {FOLDER_DEFINITIONS[folder].label}
          </option>
        ))}
      </select>
      <p className="text-sm text-muted-foreground">{definition.description}</p>
      <p className="text-sm text-muted-foreground">Group: {definition.group}</p>
    </div>
  );
}
