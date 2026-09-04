export const STUDIONET_CONFIG = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
  blockExplorerUrls: ['https://genlayer-explorer.vercel.app']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0x07FFc61032e60E5E709bf087C3312C658A64e2b2';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0x8Ff84b5bDf60b6406736c825518B1c726F70168a';
