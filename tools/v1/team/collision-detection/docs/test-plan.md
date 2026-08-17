# Collision Detection Test Plan

## Unit Scenarios

1. Detects a collision when two teammates reply to the same thread.
2. Marks three or more replies as critical severity.
3. Returns no events when all replies target different threads.
4. Returns no events from a single reply.
5. Returns no events from an empty reply list.
6. Returns error for invalid replies input (null, undefined).
7. Returns error for negative monitored thread count.
8. Produces deterministic output for repeated scans of the same fixture.

## Component Scenarios

1. Shows the empty state before a scan is requested.
2. Shows a loading indicator with aria-busy during scan.
3. Displays error message and retry button when a scan fails.
4. Displays collision events grouped by thread in the results view.
5. Shows "all clear" message when no collisions are detected.
6. Provides keyboard focus and ARIA labels on all interactive elements.

## Non-Goals for This Folder

- End-to-end inbox reply monitoring.
- Database persistence of collision history.
- Real-time WebSocket or polling integration.
- Integration with the main app shell or routing.
