/**
 * VendorMailTrackerPreview — isolated dev harness.
 *
 * This file renders the tool standalone so it can be reviewed and
 * tested without any main-app wiring. It is NOT imported by the main
 * application routes or shell.
 *
 * Usage (manual dev test):
 *   1. Temporarily import this in a dev-only route or test page.
 *   2. Run `npm run dev` and navigate to that route.
 *   3. Remove the temporary import when done reviewing.
 *
 * A permanent route for this tool will be added in a follow-up issue
 * once the integration with the main app is approved.
 */

import { VendorMailTracker } from "./VendorMailTracker";

/**
 * Standalone preview wrapper — sets up the ambient background used
 * throughout the main app so the tool looks correct in isolation.
 */
export function VendorMailTrackerPreview() {
  return (
    <div className="ambient-bg min-h-screen">
      <VendorMailTracker />
    </div>
  );
}

export default VendorMailTrackerPreview;
