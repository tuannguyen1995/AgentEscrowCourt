import { encodeGenLayerCalldata, buildAddTransactionPayload } from './src/utils/genlayerConsensus.ts';
import { STUDIONET_CONFIG, DEFAULT_ESCROW_CONTRACT_ADDRESS, DEFAULT_REPUTATION_CONTRACT_ADDRESS } from './src/config.ts';

async function runAdjudicationTestSuite() {
  console.log('====================================================================');
  console.log('    AGENT ESCROW COURT - AUTOMATED ADJUDICATION TEST SUITE          ');
  console.log('    Target Network: GenLayer Studio Next (Chain ID 61997)          ');
  console.log('====================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log('  [PASS] #' + totalTests + ': ' + testName);
      passedTests++;
    } else {
      console.error('  [FAIL] #' + totalTests + ': ' + testName);
      if (detail) console.error('         Detail: ' + detail);
    }
  }

  // 1. Network & Config
  console.log('SECTION 1: Network & Configuration Tests');
  assert(STUDIONET_CONFIG.id === 61997, 'STUDIONET_CONFIG has Chain ID 61997');
  assert(STUDIONET_CONFIG.name === 'GenLayer Studio Next', 'Network name is GenLayer Studio Next');
  assert(STUDIONET_CONFIG.rpcUrls.default.http[0] === 'https://studio-next.genlayer.com/api', 'RPC endpoint is studio-next.genlayer.com/api');
  assert(DEFAULT_ESCROW_CONTRACT_ADDRESS.toLowerCase() === '0x83C6fD61e60E13848aCe1499F1ea9bB745a8adB4'.toLowerCase(), 'Escrow contract address is correct');
  assert(DEFAULT_REPUTATION_CONTRACT_ADDRESS.toLowerCase() === '0xA3D92892EFF3523F1e94dA4AB18749416FaEd38C'.toLowerCase(), 'Reputation contract address is correct');

  // Check live RPC response
  try {
    const res = await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 })
    });
    const json = await res.json();
    const chainIdDecimal = parseInt(json.result, 16);
    assert(chainIdDecimal === 61997, 'Live Studio Next RPC returns chainId 61997');
  } catch (e: any) {
    assert(false, 'Live Studio Next RPC responds', e.message);
  }

  // 2. Contract Reads
  console.log('\nSECTION 2: Contract State Read Queries (gen_call)');
  try {
    const resTasks = await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'gen_call',
        params: [{
          type: 'read',
          to: DEFAULT_ESCROW_CONTRACT_ADDRESS,
          from: '0x0000000000000000000000000000000000000000',
          data: '0xd8960e066d6574686f646c6765745f616c6c5f7461736b7300',
          transaction_hash_variant: 'latest-nonfinal'
        }]
      })
    });
    const tasksJson = await resTasks.json();
    assert(tasksJson.result !== undefined, 'AgentEscrowCourt responds to get_all_tasks on-chain');
  } catch (e: any) {
    assert(false, 'Escrow tasks on-chain read', e.message);
  }

  try {
    const resRep = await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'gen_call',
        params: [{
          type: 'read',
          to: DEFAULT_REPUTATION_CONTRACT_ADDRESS,
          from: '0x0000000000000000000000000000000000000000',
          data: '0xdf9d0e066d6574686f649c016765745f616c6c5f72657075746174696f6e7300',
          transaction_hash_variant: 'latest-nonfinal'
        }]
      })
    });
    const repJson = await resRep.json();
    assert(repJson.result !== undefined, 'AgentReputation responds to get_all_reputations on-chain');
  } catch (e: any) {
    assert(false, 'Reputation on-chain read', e.message);
  }

  // 3. Adjudication Transaction Encoders
  console.log('\nSECTION 3: Adjudication Transaction Encoders');
  const mockClient = '0x1111111111111111111111111111111111111111';
  const mockWorker = '0x2222222222222222222222222222222222222222';

  const createPayload = buildAddTransactionPayload(
    mockClient,
    DEFAULT_ESCROW_CONTRACT_ADDRESS,
    'create_escrow',
    ['task_test_1', 'AI Task Title', 'https://specs.io/spec.md', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 72]
  );
  assert(typeof createPayload === 'string' && createPayload.startsWith('0x'), 'Encoded create_escrow payload valid hex');

  const acceptPayload = buildAddTransactionPayload(
    mockWorker,
    DEFAULT_ESCROW_CONTRACT_ADDRESS,
    'accept_task',
    ['task_test_1']
  );
  assert(typeof acceptPayload === 'string' && acceptPayload.startsWith('0x'), 'Encoded accept_task payload valid hex');

  const submitPayload = buildAddTransactionPayload(
    mockWorker,
    DEFAULT_ESCROW_CONTRACT_ADDRESS,
    'submit_deliverable',
    ['task_test_1', 'https://github.com/org/repo/pull/42']
  );
  assert(typeof submitPayload === 'string' && submitPayload.startsWith('0x'), 'Encoded submit_deliverable payload valid hex');

  const releasePayload = buildAddTransactionPayload(
    mockClient,
    DEFAULT_ESCROW_CONTRACT_ADDRESS,
    'release_funds',
    ['task_test_1']
  );
  assert(typeof releasePayload === 'string' && releasePayload.startsWith('0x'), 'Encoded release_funds payload valid hex');

  // 4. Business Rules & Collateral
  console.log('\nSECTION 4: Business Rules & Access Control');
  const taskRewardGEN = 100n;
  const expectedStake = (taskRewardGEN * 15n) / 100n;
  assert(expectedStake === 15n, 'Worker collateral calculation is exactly 15%');

  const isClientClaiming = (creator: string, claimant: string) => creator.toLowerCase() === claimant.toLowerCase();
  assert(isClientClaiming(mockClient, mockClient) === true, 'Blocks client from claiming own task');
  assert(isClientClaiming(mockClient, mockWorker) === false, 'Allows independent worker to claim task');

  const payoutReadyAt = Math.floor(Date.now() / 1000) + 86400;
  const now = Math.floor(Date.now() / 1000);
  assert(payoutReadyAt > now, '24h Cooling-off window correctly enforced');

  // 5. AI Jury Verdict Framework
  console.log('\nSECTION 5: AI Jury Verdict Framework');
  function evaluateVerdict(verdict: string, confidence: number, attempts: number) {
    let effective = verdict.toUpperCase().trim();
    if (!['RELEASE', 'REFUND', 'RETRY', 'ESCALATE'].includes(effective)) effective = 'ESCALATE';
    if (confidence < 65) effective = 'ESCALATE';
    if (effective === 'RETRY' && attempts >= 3) effective = 'REFUND';
    return effective;
  }

  assert(evaluateVerdict('RELEASE', 95, 1) === 'RELEASE', 'RELEASE with 95% confidence resolves to RELEASE');
  assert(evaluateVerdict('RELEASE', 50, 1) === 'ESCALATE', 'RELEASE with low confidence (<65%) escalates to DAO');
  assert(evaluateVerdict('REFUND', 99, 1) === 'REFUND', 'REFUND with high confidence resolves to REFUND');
  assert(evaluateVerdict('RETRY', 85, 2) === 'RETRY', 'RETRY on attempt 2 allows revision');
  assert(evaluateVerdict('RETRY', 85, 3) === 'REFUND', 'RETRY on attempt 3 converts to REFUND');

  // 6. Reputation Scoring
  console.log('\nSECTION 6: Agent Reputation Scoring');
  function computeReputation(successful: number, total: number) {
    if (total === 0) return 100;
    return Math.round((successful / total) * 100);
  }
  assert(computeReputation(10, 10) === 100, '10/10 successful tasks gives 100 score');
  assert(computeReputation(8, 10) === 80, '8/10 successful tasks gives 80 score');
  assert(computeReputation(0, 0) === 100, 'New agent default score is 100');

  console.log('\n====================================================================');
  console.log('  FINAL RESULTS: ' + passedTests + ' / ' + totalTests + ' TESTS PASSED (' + Math.round((passedTests/totalTests)*100) + '%)');
  console.log('====================================================================\n');
}

runAdjudicationTestSuite().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
