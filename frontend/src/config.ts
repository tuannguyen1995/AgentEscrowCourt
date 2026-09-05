export const STUDIONET_CONFIG = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
  blockExplorerUrls: ['https://genlayer-explorer.vercel.app']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0xFB056E2973dd4004BD6054Bda82D1C3b2485900B';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0x0b58784eACfC8e16c487DbA7AB7DB9Ee325FF2D6';
