export const STUDIONET_CONFIG = {
  id: 61997,
  name: 'GenLayer Studio Next',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
  blockExplorerUrls: ['https://explorer-studio.genlayer.com']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0x89b75f160ea2F30DE1218f2210BD1c35b4E092a1';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0x8472FD8F3c286892a360fB7F9b0650C50733B869';
