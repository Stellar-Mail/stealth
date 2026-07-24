import { PayoutRequest, TeamMemberQuota } from "../types/payout";

export const MOCK_TEAM_MEMBERS: Record<string, TeamMemberQuota> = {
  tm_1: {
    teamMemberId: "tm_1",
    allowedCurrencies: ["USDC", "XLM"],
    maxAmountPerPayout: {
      USDC: 5000,
      XLM: 10000,
    },
  },
  tm_2: {
    teamMemberId: "tm_2",
    allowedCurrencies: ["USDC"],
    maxAmountPerPayout: {
      USDC: 1000,
      XLM: 0,
    },
  },
};

export const MOCK_STELLAR_ADDRESSES = {
  valid: "GAGX67F33UFBDBJ2Q232XY4J6WDEZ4YNDT3KRYDIPOU3T2O6Z4HZZL3U",
  valid2: "GCXKG6RN4ONIEPCMNFB732A436Z5IGOUB4E7V432G6M3NMMZNZ3O6S4R",
  invalidFormat: "G_INVALID_ADDRESS_FORMAT",
  invalidChecksum: "GAGX67F33UFBDBJ2Q232XY4J6WDEZ4YNDT3KRYDIPOU3T2O6Z4HZZL3V",
};

export const MOCK_PAYOUT_HISTORY: PayoutRequest[] = [
  {
    id: "req_1",
    teamMemberId: "tm_1",
    amount: 500,
    currency: "USDC",
    destinationAddress: MOCK_STELLAR_ADDRESSES.valid,
    status: "COMPLETED",
    createdAt: "2026-07-01T10:00:00Z",
    networkFeeEstimate: 0.01,
  },
  {
    id: "req_2",
    teamMemberId: "tm_2",
    amount: 1500,
    currency: "USDC",
    destinationAddress: MOCK_STELLAR_ADDRESSES.valid2,
    status: "REJECTED",
    createdAt: "2026-07-02T11:00:00Z",
    errorMessage: "Amount exceeds allowed quota.",
  },
];
