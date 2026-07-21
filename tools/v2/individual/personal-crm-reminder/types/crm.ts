export interface Contact {
  id: string;
  name: string;
  email?: string;
  notes?: string;
}

export interface Reminder {
  id: string;
  contactId: string;
  action: string;
  dueDate: Date;
  status: "PENDING" | "COMPLETED" | "SNOOZED";
}
