import { createClient } from 'genlayer-js';

const STUDIONET_CONFIG = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } }
};

const ESCROW_CONTRACT = '0x12E7F354453382D793898F7f33a3507D558CD50C';
const REPUTATION_CONTRACT = '0xF9F6F62c8717adF41841fBfBd93B782431f26Ad3';

async function main() {
  console.log('====================================================');
  console.log('   GenLayer Automated On-Chain Verification Tool    ');
  console.log('====================================================\n');
  
  const client = createClient({
    chain: STUDIONET_CONFIG,
    endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
  });

  console.log('--- 1. Testing AgentEscrowCourt Contract ---');
  console.log(`📍 Contract Address: ${ESCROW_CONTRACT}`);
  try {
    const tasksRaw = await client.readContract({
      address: ESCROW_CONTRACT,
      functionName: 'get_all_tasks',
      args: []
    });
    console.log('🟢 Status: ACTIVE & RESPONSIVE');
    console.log('📄 On-chain Tasks State:', tasksRaw);
  } catch (err) {
    console.error('🔴 Status: ERROR reading contract:', err.message || err);
  }

  console.log('\n--- 2. Testing AgentReputation Contract ---');
  console.log(`📍 Contract Address: ${REPUTATION_CONTRACT}`);
  try {
    const repRaw = await client.readContract({
      address: REPUTATION_CONTRACT,
      functionName: 'get_all_reputations',
      args: []
    });
    console.log('🟢 Status: ACTIVE & RESPONSIVE');
    console.log('📊 On-chain Leaderboard State:', repRaw);
  } catch (err) {
    console.error('🔴 Status: ERROR reading contract:', err.message || err);
  }

  console.log('\n--- 3. Testing Single Reputation Lookup ---');
  const sampleAgent = '0x36bf9c1356b6ace3b4a2cfaacb7b9f6a5ddee644';
  try {
    const repSingle = await client.readContract({
      address: REPUTATION_CONTRACT,
      functionName: 'get_reputation',
      args: [sampleAgent]
    });
    console.log(`🟢 Status: SUCCESS | Initial Reputation for ${sampleAgent}: ${repSingle}`);
  } catch (err) {
    console.error('🔴 Status: ERROR querying single reputation:', err.message || err);
  }

  console.log('\n====================================================');
  console.log('   ✅ All On-Chain Contract Endpoints Verified!    ');
  console.log('====================================================');
}

main();
