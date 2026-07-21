import { Receipt, ReceiptCategory, OrganizeResult } from "./types";

/**
 * Classifies a receipt based on merchant name.
 */
export function classifyReceipt(receipt: Receipt): ReceiptCategory {
  const merchantLower = receipt.merchant.toLowerCase();

  if (
    merchantLower.includes("uber") ||
    merchantLower.includes("lyft") ||
    merchantLower.includes("airlines")
  ) {
    return "Travel";
  }

  if (
    merchantLower.includes("github") ||
    merchantLower.includes("aws") ||
    merchantLower.includes("vercel")
  ) {
    return "Software";
  }

  if (
    merchantLower.includes("cafe") ||
    merchantLower.includes("restaurant") ||
    merchantLower.includes("coffee")
  ) {
    return "Food";
  }

  return "Other";
}

/**
 * Organizes an array of receipts, categorizes them, and calculates totals.
 */
export function organizeReceipts(receipts: Receipt[]): OrganizeResult {
  let totalAmount = 0;
  const totalByCategory: Record<ReceiptCategory, number> = {
    Food: 0,
    Travel: 0,
    Supplies: 0,
    Software: 0,
    Other: 0,
  };

  const processedReceipts = receipts.map((receipt) => {
    const category = receipt.category || classifyReceipt(receipt);
    totalAmount += receipt.totalAmount;
    if (totalByCategory[category] !== undefined) {
      totalByCategory[category] += receipt.totalAmount;
    }

    return {
      ...receipt,
      category,
    };
  });

  return {
    receipts: processedReceipts,
    totalByCategory,
    totalAmount,
  };
}
