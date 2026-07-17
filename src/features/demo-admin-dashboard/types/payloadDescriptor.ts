export type PayloadDescriptorKind = "pdf" | "image" | "text" | "key" | "encrypted";

export interface PayloadDescriptor {
  id: string;
  kind: PayloadDescriptorKind;
  label: string;
  fileName: string;
  contentType: string;
  sizeLabel: string;
  summary: string;
  samplePreview: string;
  tags: string[];
}
