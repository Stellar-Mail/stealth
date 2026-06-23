export const EXPLORER_URLS = {
  mainnet: "https://stellar.expert/explorer/public/tx/",
  testnet: "https://stellar.expert/explorer/testnet/tx/",
};

export const getExplorerUrl = (txHash: string, network: "mainnet" | "testnet" = "mainnet") => {
  const base = EXPLORER_URLS[network];
  return `${base}${txHash}`;
};
