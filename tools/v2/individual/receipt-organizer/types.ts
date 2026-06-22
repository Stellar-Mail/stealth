export type ReceiptCategory = "Food" | "Travel" | "Supplies" | "Software" | "Other";

export interface ReceiptItem {
  id: string;
  description: string;
  amount: number;
}

export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  totalAmount: number;
  currency: string;
  category?: ReceiptCategory;
  items: ReceiptItem[];
}

export interface OrganizeResult {
  receipts: Receipt[];
  totalByCategory: Record<ReceiptCategory, number>;
  totalAmount: number;
}
