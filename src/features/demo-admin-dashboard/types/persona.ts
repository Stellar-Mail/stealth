export interface Persona {
  id: string;
  name: string;
  email: string;
  stellarAddress: string;
  avatar: string;
}

export interface PersonaFilters {
  searchQuery?: string;
  name?: string;
  email?: string;
  stellarAddress?: string;
}
