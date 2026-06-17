import { useRef } from "react";
import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type ResizablePanelGroupProps = Omit<
  React.ComponentProps<typeof Group>,
  "orientation" | "onLayoutChange"
> & {
  direction?: "horizontal" | "vertical";
  onLayout?: (sizes: number[]) => void;
};

type PanelLayoutSize = number | { asPercentage?: number };

const panelSizeToPercent = (size: PanelLayoutSize) =>
  typeof size === "number" ? size : size.asPercentage;

const ResizablePanelGroup = ({
  className,
  direction,
  onLayout,
  ...props
}: ResizablePanelGroupProps) => (
  <Group
    className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
    orientation={direction}
    onLayoutChange={(layout) => {
      const sizes = Object.values(layout).map((size) =>
        panelSizeToPercent(size as PanelLayoutSize),
      );
      if (sizes.every((size): size is number => Number.isFinite(size))) {
        onLayout?.(sizes);
      }
    }}
    {...props}
  />
);

type ResizablePanelProps = React.ComponentProps<typeof Panel> & {
  onCollapse?: () => void;
  onExpand?: () => void;
};

const legacyPercentSize = (size: number | string | undefined) =>
  typeof size === "number" ? `${size}%` : size;

const ResizablePanel = ({
  collapsible,
  collapsedSize = 0,
  defaultSize,
  maxSize,
  minSize,
  onCollapse,
  onExpand,
  onResize,
  ...props
}: ResizablePanelProps) => {
  const collapsedRef = useRef(false);

  return (
    <Panel
      collapsible={collapsible}
      collapsedSize={legacyPercentSize(collapsedSize)}
      defaultSize={legacyPercentSize(defaultSize)}
      maxSize={legacyPercentSize(maxSize)}
      minSize={legacyPercentSize(minSize)}
      onResize={(size, id, previousSize) => {
        const collapsedThreshold =
          typeof collapsedSize === "number" ? collapsedSize : Number.parseFloat(collapsedSize);
        const isCollapsed = !!collapsible && size.asPercentage <= collapsedThreshold + 0.5;

        if (isCollapsed && !collapsedRef.current) {
          collapsedRef.current = true;
          onCollapse?.();
        }

        if (!isCollapsed && collapsedRef.current) {
          collapsedRef.current = false;
          onExpand?.();
        }

        onResize?.(size, id, previousSize);
      }}
      {...props}
    />
  );
};

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
