export const STUDIONET_CONFIG = {
  id: 61997,
  name: 'GenLayer Studio Next',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
  blockExplorerUrls: ['https://explorer-studio.genlayer.com']
};

export const DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '0x83C6fD61e60E13848aCe1499F1ea9bB745a8adB4';
export const DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '0xA3D92892EFF3523F1e94dA4AB18749416FaEd38C';
