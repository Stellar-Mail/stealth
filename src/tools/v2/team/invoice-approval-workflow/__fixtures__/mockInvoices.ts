import { Invoice } from "../types";

export const mockPendingInvoice: Invoice = {
  id: "inv_001",
  amount: 1500.0,
  currency: "USD",
  submitterId: "usr_abc123",
  vendorName: "Acme Corp Software",
  status: "PENDING",
  createdAt: "2023-10-01T10:00:00Z",
  dueDate: "2023-10-31T23:59:59Z",
  notes: "Annual SaaS subscription",
};

export const mockApprovedInvoice: Invoice = {
  id: "inv_002",
  amount: 450.5,
  currency: "EUR",
  submitterId: "usr_def456",
  vendorName: "Global Logistics",
  status: "APPROVED",
  createdAt: "2023-09-15T08:30:00Z",
  dueDate: "2023-10-15T23:59:59Z",
  approverId: "usr_admin999",
};

export const mockRejectedInvoice: Invoice = {
  id: "inv_003",
  amount: 12000.0,
  currency: "USD",
  submitterId: "usr_ghi789",
  vendorName: "Luxury Office Chairs",
  status: "REJECTED",
  createdAt: "2023-10-05T14:20:00Z",
  dueDate: "2023-11-05T23:59:59Z",
  approverId: "usr_admin999",
  notes: "[REJECT]: Over the departmental budget limit.",
};

export const mockInvoiceList: Invoice[] = [
  mockPendingInvoice,
  mockApprovedInvoice,
  mockRejectedInvoice,
  {
    id: "inv_004",
    amount: 300.0,
    currency: "USD",
    submitterId: "usr_abc123",
    vendorName: "Cloud Hosting Services",
    status: "PENDING",
    createdAt: "2023-10-10T09:15:00Z",
    dueDate: "2023-11-10T23:59:59Z",
  },
];
