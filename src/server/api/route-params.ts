import { stellarAddressSchema } from "./domain";

export function parsePolicyOwnerRouteParam(owner: unknown): string {
  return stellarAddressSchema.parse(owner);
}

export function parsePolicySenderRouteParam(sender: unknown): string {
  return stellarAddressSchema.parse(sender);
}
