import type { AudienceSegment } from "../types/audienceSegment";
import type { DisplayToken } from "../constants/displayTokens";
import { AUDIENCE_SEGMENTS_BY_ID } from "../fixtures/audienceSegmentFixtures";
import { getAudienceToken } from "../constants/displayTokens";

export function getSegmentById(id: string): AudienceSegment | undefined {
  return AUDIENCE_SEGMENTS_BY_ID[id as keyof typeof AUDIENCE_SEGMENTS_BY_ID];
}

export function resolveSegmentLabel(id: string): string {
  return getSegmentById(id)?.label ?? id;
}

export function getSegmentToken(id: string): DisplayToken {
  return getAudienceToken(id);
}
