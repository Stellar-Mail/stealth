import * as React from "react";
import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { PanelSize } from "react-resizable-panels";

import { cn } from "@/lib/utils";

import type { Layout } from "react-resizable-panels";

const ResizablePanelGroup = ({
  className,
  direction,
  onLayout,
  onLayoutChanged,
  ...props
}: Omit<
  React.ComponentProps<typeof Group>,
  "orientation" | "onLayoutChange" | "onLayoutChanged"
> & {
  direction?: "horizontal" | "vertical";
  onLayout?: (sizes: number[]) => void;
  onLayoutChanged?: (sizes: number[]) => void;
}) => {
  const handleLayoutChange = (layout: Layout) => {
    onLayout?.(Object.values(layout));
  };

  const handleLayoutChanged = (layout: Layout) => {
    onLayoutChanged?.(Object.values(layout));
  };

  return (
    <Group
      orientation={direction}
      onLayoutChange={onLayout ? handleLayoutChange : undefined}
      onLayoutChanged={onLayoutChanged ? handleLayoutChanged : undefined}
      className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
      {...props}
    />
  );
};

const ResizablePanel = ({
  onCollapse,
  onExpand,
  onResize,
  ...props
}: Omit<React.ComponentProps<typeof Panel>, "onResize"> & {
  onCollapse?: () => void;
  onExpand?: () => void;
  onResize?: (
    size: PanelSize,
    id: string | number | undefined,
    prevSize: PanelSize | undefined,
  ) => void;
}) => {
  const wasCollapsedRef = React.useRef(false);

  const handleResize = (
    size: PanelSize,
    id: string | number | undefined,
    prevSize: PanelSize | undefined,
  ) => {
    onResize?.(size, id, prevSize);
    const isCollapsed = size.asPercentage === 0;
    if (isCollapsed && !wasCollapsedRef.current) {
      wasCollapsedRef.current = true;
      onCollapse?.();
    } else if (!isCollapsed && wasCollapsedRef.current) {
      wasCollapsedRef.current = false;
      onExpand?.();
    }
  };

  return <Panel onResize={handleResize} {...props} />;
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
