import { Receipt } from "./types";

export const mockReceipts: Receipt[] = [
  {
    id: "r1",
    merchant: "Uber",
    date: "2023-10-01T10:00:00Z",
    totalAmount: 25.5,
    currency: "USD",
    items: [{ id: "i1", description: "Ride to airport", amount: 25.5 }],
  },
  {
    id: "r2",
    merchant: "GitHub",
    date: "2023-10-02T12:00:00Z",
    totalAmount: 4.0,
    currency: "USD",
    items: [{ id: "i2", description: "Copilot Subscription", amount: 4.0 }],
  },
  {
    id: "r3",
    merchant: "Local Cafe",
    date: "2023-10-03T08:30:00Z",
    totalAmount: 12.0,
    currency: "USD",
    items: [{ id: "i3", description: "Coffee and bagel", amount: 12.0 }],
  },
];
