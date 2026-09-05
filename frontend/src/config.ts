export const STUDIONET_CONFIG = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
  blockExplorerUrls: ['https://genlayer-explorer.vercel.app']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0xA54F3a19A737212c838e0fF4ADD5A1ecC721EEd8';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0x072e90DFD02e0716695133C7d772250B81735183';
