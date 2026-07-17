import type { JSX } from "react";
import type { CollisionDetectionState } from "../services/collisionDetection";
import { CollisionDetectionEmpty } from "./CollisionDetectionEmpty";
import { CollisionDetectionLoading } from "./CollisionDetectionLoading";
import { CollisionDetectionError } from "./CollisionDetectionError";
import { CollisionDetectedView } from "./CollisionDetectedView";

export interface CollisionDetectionViewProps {
  state: CollisionDetectionState;
  onRetry?: () => void;
}

export function CollisionDetectionView({
  state,
  onRetry,
}: CollisionDetectionViewProps): JSX.Element {
  switch (state.status) {
    case "idle":
      return <CollisionDetectionEmpty />;
    case "loading":
      return <CollisionDetectionLoading />;
    case "error":
      return (
        <CollisionDetectionError code={state.code} message={state.message} onRetry={onRetry} />
      );
    case "ready":
      return (
        <CollisionDetectedView events={state.events} monitoredThreads={state.monitoredThreads} />
      );
  }
}
