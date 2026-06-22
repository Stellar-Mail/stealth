export type OwnershipStatus = "unassigned" | "assigned" | "released";

export type OwnershipThread = {
  id: string;
  subject: string;
  sender: string;
  status: OwnershipStatus;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
};

export type ClaimThreadInput = {
  teammateId: string;
  teammateName: string;
  now: string;
};

export type ReleaseThreadInput = {
  teammateId: string;
  now: string;
};

export type OwnershipEventType = "claimed" | "released";

export type OwnershipEvent = {
  threadId: string;
  type: OwnershipEventType;
  teammateId: string;
  teammateName: string | null;
  occurredAt: string;
};
