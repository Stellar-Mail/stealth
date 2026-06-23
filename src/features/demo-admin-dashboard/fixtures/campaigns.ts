export type DemoCampaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  cta?: string;
  senderName?: string;
};

// Deterministic, fake demo campaigns for admin-dashboard previews and tests.
export const demoCampaigns: DemoCampaign[] = [
  {
    id: "c-001",
    name: "Welcome Series — Friendly",
    subject: "Welcome to ExampleMail!",
    body: "Hi there — welcome to ExampleMail. We help you stay private and productive. Click to learn more.",
    cta: "Get started",
    senderName: "Example Mail Team",
  },
  {
    id: "c-002",
    name: "Low Quality — Lorem",
    subject: "Lorem ipsum",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    cta: "Learn more",
    senderName: "Acme",
  },
  {
    id: "c-003",
    name: "Duplicate Subject A",
    subject: "Limited time offer — 50% OFF",
    body: "We have an offer for you. Redeem it with the code in your account. This is a demo campaign.",
    cta: "Redeem",
    senderName: "Acme Promotions",
  },
  {
    id: "c-004",
    name: "Duplicate Subject B",
    subject: "Limited time offer — 50% OFF",
    body: "Another variation but same subject line — used to test duplicate detection in demo linting.",
    cta: "Shop now",
    senderName: "Promo Bot",
  },
  {
    id: "c-005",
    name: "Unrealistic Placeholders",
    subject: "YOUR PRODUCT NAME HERE!!!",
    body: "Hello {{firstName}}, please replace this placeholder with your real body content.",
    cta: "Button Text",
    senderName: "SENDER NAME",
  },
];
