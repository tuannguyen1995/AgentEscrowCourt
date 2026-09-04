export const STUDIONET_CONFIG = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
  blockExplorerUrls: ['https://genlayer-explorer.vercel.app']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0x12E7F354453382D793898F7f33a3507D558CD50C';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0xF9F6F62c8717adF41841fBfBd93B782431f26Ad3';
