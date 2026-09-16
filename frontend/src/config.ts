export const STUDIONET_CONFIG = {
  id: 61997,
  name: 'GenLayer Studio Next',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
  blockExplorerUrls: ['https://explorer-studio.genlayer.com']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0xFAD28fb892F51c2491DD991D50E909dAda8Ec5aD';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0xc1557D0ed400e88dAFC7d8A6263FADC9B29D3577';
