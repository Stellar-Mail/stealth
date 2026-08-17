import type { Persona } from "../types/persona";
import type { EditableSegment } from "../types/segmentEditorState";

export function filterPersonas(personas: Persona[], query: string): Persona[] {
  const q = query.trim().toLowerCase();
  if (!q) return personas;
  return personas.filter(
    (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
  );
}

export function isPersonaAssigned(segment: EditableSegment, personaId: string): boolean {
  return segment.personaIds.includes(personaId);
}

export function assignPersonaToSegment(
  segment: EditableSegment,
  personaId: string,
): EditableSegment {
  if (isPersonaAssigned(segment, personaId)) return segment;
  return { ...segment, personaIds: [...segment.personaIds, personaId] };
}

export function removePersonaFromSegment(
  segment: EditableSegment,
  personaId: string,
): EditableSegment {
  return { ...segment, personaIds: segment.personaIds.filter((id) => id !== personaId) };
}

export function getPersonasForSegment(segment: EditableSegment, pool: Persona[]): Persona[] {
  return segment.personaIds
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is Persona => p !== undefined);
}
