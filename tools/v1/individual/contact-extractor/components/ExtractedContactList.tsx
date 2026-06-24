import type { ExtractedContact } from "../types";
import { Badge } from "../../../src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../src/components/ui/card";
import { User, AtSign, Phone, Building2 } from "lucide-react";

export interface ExtractedContactListProps {
  contacts: ExtractedContact[];
}

const sourceLabel: Record<string, string> = {
  header: "From header",
  signature: "Signature",
  body: "Body",
};

const sourceVariant: Record<string, "default" | "secondary" | "outline"> = {
  header: "default",
  signature: "secondary",
  body: "outline",
};

function ContactField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      <span className="text-foreground truncate">{value}</span>
    </div>
  );
}

export function ExtractedContactList({ contacts }: ExtractedContactListProps) {
  if (contacts.length === 0) return null;

  return (
    <div className="space-y-3" role="list" aria-label="Extracted contacts">
      <h2 className="text-lg font-semibold text-foreground">
        Extracted Contacts
        <span className="text-muted-foreground font-normal text-sm ml-2">
          ({contacts.length} found)
        </span>
      </h2>
      {contacts.map((contact) => (
        <Card key={contact.id} role="listitem" className="overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              {contact.name ?? "Unknown"}
            </CardTitle>
            <Badge variant={sourceVariant[contact.source] ?? "outline"} className="shrink-0">
              {sourceLabel[contact.source] ?? contact.source}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-1">
            <ContactField
              icon={<AtSign className="w-3.5 h-3.5" />}
              label="Email"
              value={contact.email}
            />
            <ContactField
              icon={<Phone className="w-3.5 h-3.5" />}
              label="Phone"
              value={contact.phone}
            />
            <ContactField
              icon={<Building2 className="w-3.5 h-3.5" />}
              label="Organization"
              value={contact.organization}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
