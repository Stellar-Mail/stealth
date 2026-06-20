import { Campaign } from "./campaignQuality";

export const demoCampaigns: Campaign[] = [
  {
    id: "camp-1",
    name: "Welcome flow — short",
    subject: "Welcome!",
    body: "Hi there. Welcome to our service. Click here to get started.",
    cta: "Click here",
    audience: ["all"],
    startDate: "2026-01-01",
    endDate: "2026-02-01",
  },
  {
    id: "camp-2",
    name: "Placeholder copy",
    subject: "Lorem ipsum dolor",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet.",
    cta: "Learn more",
    audience: [],
  },
  {
    id: "camp-3",
    name: "Duplicate of camp-1 body",
    subject: "Welcome!",
    body: "Hi there. Welcome to our service. Click here to get started.",
    cta: "Read more",
    audience: ["subscribers"],
  },
  {
    id: "camp-4",
    name: "Bad dates",
    subject: "Ends before start",
    body: "This campaign has an end date before the start date.",
    startDate: "2026-06-10",
    endDate: "2026-06-01",
    audience: ["test-group"],
  },
];
import type { Campaign, Persona } from "./types";

export const fakePersonas: Persona[] = [
  {
    id: "pers-001",
    name: "Ava Morgan",
    email: "ava@demo.org",
    stellarAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=ava",
  },
  {
    id: "pers-002",
    name: "Liam Chen",
    email: "liam@demo.org",
    stellarAddress: "GHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=liam",
  },
  {
    id: "pers-003",
    name: "Sophia Rodriguez",
    email: "sophia@demo.org",
    stellarAddress: "G1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=sophia",
  },
];

export const fakeCampaigns: Campaign[] = [
  {
    id: "camp-001",
    name: "Community Newsletter Q3",
    description: "Quarterly update for community members",
    tags: ["newsletter", "community"],
    createdAt: "2026-07-01T09:00:00Z",
    updatedAt: "2026-07-05T14:22:00Z",
    owner: fakePersonas[0],
    reviewer: fakePersonas[1],
    lastEditor: fakePersonas[2],
  },
  {
    id: "camp-002",
    name: "Protocol Upgrade Announcement",
    description: "Inform users about upcoming network changes",
    tags: ["announcement", "protocol"],
    createdAt: "2026-06-15T10:30:00Z",
    updatedAt: "2026-06-20T08:15:00Z",
    owner: fakePersonas[1],
    reviewer: fakePersonas[0],
    lastEditor: fakePersonas[1],
  },
];
