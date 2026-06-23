/**
 * Vendor Mail Tracker — public surface.
 *
 * Only export the root component and its preview harness. Internal
 * components, hooks, types, and fixtures are not part of the public
 * surface and should not be imported outside this folder.
 *
 * The main app MUST NOT import from this file until the integration
 * follow-up issue is complete.
 */

export { VendorMailTracker } from "./VendorMailTracker";
export { VendorMailTrackerPreview } from "./VendorMailTrackerPreview";
