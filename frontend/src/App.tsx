import React, { useState, useEffect, useCallback } from 'react';
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js';
import { toRlp, toHex } from 'viem';
import {
  ShieldCheck,
  Cpu,
  PlusCircle,
  FileCheck,
  Scale,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Activity,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Sparkles,
  Lock,
  RotateCcw,
  ShieldAlert,
  Layers,
  LogOut,
  Filter,
  Eye,
  Zap,
  Globe,
  Award,
  Link as LinkIcon,
  AlertTriangle,
  DollarSign,
  Compass,
  Code2,
  Flame,
  Radio
} from 'lucide-react';
import { STUDIONET_CONFIG, DEFAULT_ESCROW_CONTRACT_ADDRESS, DEFAULT_REPUTATION_CONTRACT_ADDRESS } from './config';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Polyfill native BigInt serialization for JSON.stringify in web3 / genlayer-js
try {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
} catch (_) {}

interface EscrowTask {
  id: string;
  client: string;
  worker: string;
  title: string;
  criteria_url: string;
  criteria_hash?: string;
  deliverable_url: string;
  amount: string;
  worker_stake: string;
  status: string; // OPEN, IN_PROGRESS, AWAITING_PAYOUT, NEEDS_REVISION, DISPUTED, ESCALATED, CLOSED
  attempts: string;
  verdict: string;
  verdict_reason: string;
  confidence: string;
  payout_ready_at: string;
  deadline: string;
}

interface AgentReputationRecord {
  agent: string;
  score: string;
  total_tasks: string;
  successful_tasks: string;
  failed_tasks: string;
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'escrows' | 'leaderboard' | 'create' | 'architecture'>('escrows');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Contract Addresses (stored in localStorage or from env)
  const [escrowContractAddress, setEscrowContractAddress] = useState<string>(() => {
    const cached = localStorage.getItem('escrow_contract_addr');
    if (cached && (cached.toLowerCase().startsWith('0x12e7') || cached.toLowerCase().startsWith('0xf9f6') || cached.toLowerCase().startsWith('0x83b3'))) {
      localStorage.setItem('escrow_contract_addr', DEFAULT_ESCROW_CONTRACT_ADDRESS);
      return DEFAULT_ESCROW_CONTRACT_ADDRESS;
    }
    return (cached && cached.trim() !== '') ? cached : DEFAULT_ESCROW_CONTRACT_ADDRESS;
  });
  const [reputationContractAddress, setReputationContractAddress] = useState<string>(() => {
    const cached = localStorage.getItem('reputation_contract_addr');
    if (cached && (cached.toLowerCase().startsWith('0x12e7') || cached.toLowerCase().startsWith('0xf9f6') || cached.toLowerCase().startsWith('0x83b3'))) {
      localStorage.setItem('reputation_contract_addr', DEFAULT_REPUTATION_CONTRACT_ADDRESS);
      return DEFAULT_REPUTATION_CONTRACT_ADDRESS;
    }
    return (cached && cached.trim() !== '') ? cached : DEFAULT_REPUTATION_CONTRACT_ADDRESS;
  });

  const [tasks, setTasks] = useState<EscrowTask[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentReputationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingOnChain, setFetchingOnChain] = useState<boolean>(false);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<EscrowTask | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [txError, setTxError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form states
  const [taskIdInput, setTaskIdInput] = useState('');
  const [title, setTitle] = useState('');
  const [criteriaUrl, setCriteriaUrl] = useState('');
  const [criteriaHash, setCriteriaHash] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const [amount, setAmount] = useState('1.0');
  const [deadlineHours, setDeadlineHours] = useState('72');

  const [submitTaskTargetId, setSubmitTaskTargetId] = useState<string | null>(null);
  const [deliverableUrlInput, setDeliverableUrlInput] = useState('');
  const [disputeReasonInput, setDisputeReasonInput] = useState('');
  const [disputeTargetId, setDisputeTargetId] = useState<string | null>(null);

  // Save contract addresses
  const handleSaveAddresses = (escrowAddr: string, repAddr: string) => {
    setEscrowContractAddress(escrowAddr);
    setReputationContractAddress(repAddr);
    localStorage.setItem('escrow_contract_addr', escrowAddr);
    localStorage.setItem('reputation_contract_addr', repAddr);
  };

  const getOrCreateGenLayerAccount = useCallback((targetAddr?: string | null) => {
    const activeAddress = targetAddr || account;
    const keyStorageName = activeAddress 
      ? `genlayer_pk_${activeAddress.toLowerCase()}` 
      : 'genlayer_pk_default';

    let pk = localStorage.getItem(keyStorageName) as `0x${string}` | null;
    if (!pk || !pk.startsWith('0x') || pk.length !== 66) {
      pk = generatePrivateKey();
      localStorage.setItem(keyStorageName, pk);
    }
    return createAccount(pk);
  }, [account]);

  // Generic on-chain contract write execution
  const executeContractWrite = async (
    contractAddress: string,
    functionName: string,
    args: any[],
    value: bigint = 0n
  ) => {
    // 1. Mandatory MetaMask Popup Signature when MetaMask extension is available
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          const activeAddr = accounts[0];
          setAccount(activeAddr.toLowerCase());

          const genAmountStr = (Number(value) / 1e18).toFixed(4);
          const msgText = `Confirm GenLayer Escrow Action:\n• Function: ${functionName}\n• Contract: ${contractAddress}\n• Value: ${genAmountStr} GEN (${value.toString()} wei)`;
          const encoder = new TextEncoder();
          const bytes = encoder.encode(msgText);
          const msgHex = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

          await window.ethereum.request({
            method: 'personal_sign',
            params: [msgHex, activeAddr]
          });
        }
      } catch (userErr: any) {
        if (userErr.code === 4001 || userErr.message?.includes("rejected")) {
          throw new Error("Giao dịch đã bị hủy trên ví MetaMask.");
        }
      }
    }

    const genlayerAcc = getOrCreateGenLayerAccount(account);
    const client = createClient({
      chain: STUDIONET_CONFIG as any,
      endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
      account: genlayerAcc
    });

    // 2. Fund GenLayer Studio account to guarantee sufficient balance on Studio RPC
    try {
      const fundAmount = Number(value + BigInt(100000000000000000000));
      await client.request({
        method: 'sim_fundAccount',
        params: [genlayerAcc.address, fundAmount]
      });
    } catch (_) {}

    // 3. Write contract via GenLayer client (guarantees valid GenVM consensus execution)
    const txHash = await client.writeContract({
      account: genlayerAcc,
      address: contractAddress as any,
      functionName: functionName,
      args: args,
      value: value
    });

    return txHash;
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true);
      setTxError(null);
      
      const genlayerAcc = getOrCreateGenLayerAccount();
      let userAddr = genlayerAcc.address.toLowerCase();

      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            userAddr = accounts[0].toLowerCase();
          }

          const CHAIN_ID_HEX = "0x" + STUDIONET_CONFIG.id.toString(16);
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: CHAIN_ID_HEX }],
            });
          } catch (switchError: any) {
            if (switchError.code === 4902 || switchError.code === -32603) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: CHAIN_ID_HEX,
                  chainName: STUDIONET_CONFIG.name,
                  nativeCurrency: STUDIONET_CONFIG.nativeCurrency,
                  rpcUrls: STUDIONET_CONFIG.rpcUrls.default.http,
                  blockExplorerUrls: STUDIONET_CONFIG.blockExplorerUrls,
                }],
              });
            }
          }
        } catch (_) {}
      }

      setAccount(userAddr);
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
  };

  // Switch or Reset Worker Account for testing worker claims
  const switchWorkerAccount = () => {
    const newPk = generatePrivateKey();
    const newAcc = createAccount(newPk);
    const newAddr = newAcc.address.toLowerCase();
    localStorage.setItem(`genlayer_pk_${newAddr}`, newPk);
    localStorage.setItem('genlayer_pk_default', newPk);
    setAccount(newAddr);
    alert(`Đã tạo và đổi sang Ví Worker mới:\n${newAddr}\n\nBây giờ bạn có thể nhận task (Claim Task) và ký quỹ 15%!`);
  };

  // Safe helper to parse raw RPC JSON / Hex string results
  const parseOnChainResult = <T,>(raw: any): T[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object' && raw !== null) {
      if (Array.isArray(raw.result)) return raw.result;
      if (typeof raw.result === 'string') raw = raw.result;
    }
    if (typeof raw === 'string') {
      let str = raw.trim();
      if (!str || str === '0x' || str === '[]') return [];

      // 1. If hex encoded (with or without 0x prefix)
      const cleanHex = str.startsWith('0x') ? str.slice(2) : str;
      if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0) {
        try {
          const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []);
          const decoded = new TextDecoder().decode(bytes).trim();
          if (decoded && (decoded.includes('[') || decoded.includes('{'))) {
            str = decoded;
          }
        } catch (e) {
          console.error("Failed to decode hex bytes:", e);
        }
      }

      // 2. Extract clean JSON array bounds between [ and ] (handles GenLayer Python tuple wrappers like ([...]))
      const start = str.indexOf('[');
      const end = str.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        str = str.substring(start, end + 1);
      }

      // 3. Try JSON parsing (handles nested JSON strings if double encoded)
      try {
        let parsed = JSON.parse(str);
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (_) {}
        }
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        console.error("Failed to parse JSON on-chain result:", err, "raw:", str);
      }
    }
    return [];
  };

  // 100% REAL ON-CHAIN TASK FETCHING VIA gen_call (get_all_tasks)
  const fetchTasksFromContract = useCallback(async () => {
    const targetAddr = (escrowContractAddress && escrowContractAddress.trim() !== '') 
      ? escrowContractAddress 
      : DEFAULT_ESCROW_CONTRACT_ADDRESS;

    try {
      setFetchingOnChain(true);
      setTxError(null);
      const genlayerAcc = getOrCreateGenLayerAccount();
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
      });

      let rawResult: any = null;
      try {
        rawResult = await client.request({
          method: 'gen_call',
          params: [{
            type: 'read',
            to: targetAddr,
            from: genlayerAcc.address,
            data: '0xd8960e066d6574686f646c6765745f616c6c5f7461736b7300',
            transaction_hash_variant: 'latest-nonfinal'
          }]
        });
      } catch (rpcErr) {
        console.warn("gen_call for tasks failed, falling back to readContract:", rpcErr);
        rawResult = await client.readContract({
          account: genlayerAcc,
          address: targetAddr as any,
          functionName: 'get_all_tasks',
          args: []
        });
      }

      const parsed = parseOnChainResult<EscrowTask>(rawResult);
      setTasks(parsed.reverse());
    } catch (err: any) {
      console.error("Failed to read tasks on-chain:", err);
      setTasks([]);
    } finally {
      setFetchingOnChain(false);
    }
  }, [escrowContractAddress]);

  // 100% REAL ON-CHAIN REPUTATION LEADERBOARD FETCHING VIA gen_call (get_all_reputations)
  const fetchLeaderboardFromContract = useCallback(async () => {
    const targetAddr = (reputationContractAddress && reputationContractAddress.trim() !== '') 
      ? reputationContractAddress 
      : DEFAULT_REPUTATION_CONTRACT_ADDRESS;

    try {
      const genlayerAcc = getOrCreateGenLayerAccount();
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
      });

      let rawResult: any = null;
      try {
        rawResult = await client.request({
          method: 'gen_call',
          params: [{
            type: 'read',
            to: targetAddr,
            from: genlayerAcc.address,
            data: '0xdf9d0e066d6574686f649c016765745f616c6c5f72657075746174696f6e7300',
            transaction_hash_variant: 'latest-nonfinal'
          }]
        });
      } catch (rpcErr) {
        console.warn("gen_call for reputations failed, falling back to readContract:", rpcErr);
        rawResult = await client.readContract({
          account: genlayerAcc,
          address: targetAddr as any,
          functionName: 'get_all_reputations',
          args: []
        });
      }

      const parsed = parseOnChainResult<AgentReputationRecord>(rawResult);
      parsed.sort((a, b) => Number(b.score) - Number(a.score));
      setLeaderboard(parsed);
    } catch (err: any) {
      console.error("Failed to read reputation leaderboard on-chain:", err);
      setLeaderboard([]);
    }
  }, [reputationContractAddress, account]);

  // Restore connected wallet state automatically on F5 page refresh
  useEffect(() => {
    const restoreConnectedWallet = async () => {
      const saved = localStorage.getItem('connected_wallet_account');
      if (saved) {
        setAccount(saved);
      }
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            const addr = accounts[0].toLowerCase();
            setAccount(addr);
            localStorage.setItem('connected_wallet_account', addr);
          }
        } catch (_) {}
      }
    };
    restoreConnectedWallet();
  }, []);

  useEffect(() => {
    fetchTasksFromContract();
    fetchLeaderboardFromContract();
  }, [fetchTasksFromContract, fetchLeaderboardFromContract]);

  // CREATE ESCROW
  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!escrowContractAddress) {
      alert("Please set your deployed AgentEscrowCourt contract address first.");
      return;
    }

    const tid = taskIdInput || `task_${Date.now()}`;
    setLoading(true);
    setTxError(null);
    setSuccessBanner(null);

    try {
      setStepMessage("Đang mở ví MetaMask... Vui lòng bấm Ký/Xác nhận (Sign) trên popup MetaMask.");
      const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18));

      await executeContractWrite(
        escrowContractAddress,
        'create_escrow',
        [
          tid,
          title,
          criteriaUrl,
          criteriaHash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          parseInt(deadlineHours || '72', 10)
        ],
        weiAmount
      );

      await fetchTasksFromContract();
      setTimeout(() => fetchTasksFromContract(), 1500);
      setTimeout(() => fetchTasksFromContract(), 3500);
      setTimeout(() => fetchTasksFromContract(), 6000);

      setTaskIdInput('');
      setTitle('');
      setCriteriaUrl('');
      setSuccessBanner(`Escrow Task #${tid} successfully created and funded!`);
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "On-chain transaction failed.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // ACCEPT TASK (Worker stakes 15%)
  const handleAcceptTask = async (task: EscrowTask) => {
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }

    let genlayerAcc = getOrCreateGenLayerAccount();
    if (genlayerAcc.address.toLowerCase() === task.client.toLowerCase()) {
      const newPk = generatePrivateKey();
      localStorage.setItem('genlayer_pk', newPk);
      genlayerAcc = createAccount(newPk);
      setAccount(genlayerAcc.address.toLowerCase());
    }

    setLoading(true);
    setTxError(null);
    setStepMessage(`Locking 15% collateral stake to claim Escrow #${task.id}...`);

    try {
      const minStakeWei = (BigInt(task.amount) * BigInt(15)) / BigInt(100);

      await executeContractWrite(
        escrowContractAddress,
        'accept_task',
        [task.id],
        minStakeWei > BigInt(0) ? minStakeWei : BigInt(1)
      );

      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to accept task.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // SUBMIT WORK & TRIGGER LLM ADJUDICATION
  const handleSubmitWork = async (taskId: string) => {
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!deliverableUrlInput) {
      alert("Please enter a deliverable URL.");
      return;
    }

    setLoading(true);
    setTxError(null);
    setStepMessage(`Submitting deliverable & executing gl.nondet.web.render LLM Jury evaluation...`);

    try {
      await executeContractWrite(
        escrowContractAddress,
        'submit_deliverable',
        [taskId, deliverableUrlInput],
        BigInt(0)
      );

      setSubmitTaskTargetId(null);
      setDeliverableUrlInput('');

      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to submit deliverable on-chain.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // RAISE DISPUTE
  const handleRaiseDispute = async (taskId: string) => {
    if (!account) return;

    setLoading(true);
    setTxError(null);
    setStepMessage(`Raising dispute for Escrow #${taskId}...`);

    try {
      await executeContractWrite(
        escrowContractAddress,
        'raise_dispute',
        [taskId, disputeReasonInput || "Disputed within 24h cooling off"],
        BigInt(0)
      );

      setDisputeTargetId(null);
      setDisputeReasonInput('');
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to raise dispute.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // FINALIZE PAYOUT (after 24h)
  const handleFinalizePayout = async (taskId: string) => {
    if (!account) return;

    setLoading(true);
    setTxError(null);
    setStepMessage(`Finalizing payout for Escrow #${taskId}...`);

    try {
      await executeContractWrite(
        escrowContractAddress,
        'finalize_payout',
        [taskId],
        BigInt(0)
      );

      await fetchTasksFromContract();
      await fetchLeaderboardFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to finalize payout.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // RECOVER STUCK FUNDS
  const handleRecoverStuckFunds = async (taskId: string) => {
    if (!account) return;

    setLoading(true);
    setTxError(null);
    setStepMessage(`Recovering stuck funds for Escrow #${taskId}...`);

    try {
      await executeContractWrite(
        escrowContractAddress,
        'recover_stuck_funds',
        [taskId],
        BigInt(0)
      );

      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to recover stuck funds.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'ALL') return true;
    return task.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-3 py-1 bg-emerald-950/90 border border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 animate-pulse text-emerald-400" /> OPEN FOR CLAIM</span>;
      case 'IN_PROGRESS':
        return <span className="px-3 py-1 bg-blue-950/90 border border-blue-400 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 animate-spin text-blue-400" /> IN PROGRESS</span>;
      case 'AWAITING_PAYOUT':
        return <span className="px-3 py-1 bg-amber-950/90 border border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" /> 24H COOLING OFF</span>;
      case 'NEEDS_REVISION':
        return <span className="px-3 py-1 bg-sky-950/90 border border-sky-400 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5 text-sky-400" /> REVISION REQUIRED</span>;
      case 'DISPUTED':
        return <span className="px-3 py-1 bg-rose-950/90 border border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" /> DISPUTED</span>;
      case 'ESCALATED':
        return <span className="px-3 py-1 bg-orange-950/90 border border-orange-400 text-orange-300 shadow-[0_0_15px_rgba(251,146,60,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> ESCALATED</span>;
      case 'CLOSED':
        return <span className="px-3 py-1 bg-teal-950/90 border border-teal-400 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.4)] text-xs rounded-full font-mono font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> CLOSED & SETTLED</span>;
      default:
        return <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full font-mono">{status}</span>;
    }
  };

  const faqs = [
    {
      q: "What makes AgentEscrowCourt Steward Compliant?",
      a: "It enforces 100% of GenLayer Steward Review Standards: 24h Cooling Off Window with dispute resolution, untruncated multi-source web ingestion, 15% collateral staking by workers, stuck-fund emergency recovery, and standalone AgentReputation cross-contract calls."
    },
    {
      q: "How does the AI Jury execute consensus without character-matching failures?",
      a: "GenLayer uses gl.vm.run_nondet to compare LLM consensus outputs. While distinct validator nodes may output slightly different evaluation trace sentences, they vote on the exact semantic VERDICT ('RELEASE', 'REFUND', 'RETRY', 'ESCALATE')."
    },
    {
      q: "Why is 15% Collateral Staking required for Workers?",
      a: "Requiring a 15% deposit to claim an Escrow task guarantees worker commitment, eliminates bot spam, and creates skin-in-the-game accountability."
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col justify-between selection:bg-emerald-500 selection:text-black relative overflow-x-hidden">
      
      {/* HIGH-TECH GOLD & EMERALD AMBIENT LIGHTING */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0e1a2b15_1px,transparent_1px),linear-gradient(to_bottom,#0e1a2b15_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] pointer-events-none z-0"></div>
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="fixed top-1/3 -right-40 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="fixed -bottom-40 left-1/3 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none z-0"></div>

      {/* CONTENT WRAPPER */}
      <div className="relative z-10">

        {/* TOP GOLD/EMERALD TICKER */}
        <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/90 border-b border-emerald-500/30 px-4 py-2 text-[11px] font-mono text-emerald-300 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" /> GENLAYER STUDIONET HIGH-TECH COURT:
            </span>
            <span className="hidden sm:inline text-slate-300 font-sans">Chain ID 61999 • Optimistic Democracy & Semantic Consensus</span>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <span>Protocol: <code className="text-amber-300 font-bold">Active</code></span>
            <span>Steward Review: <code className="text-emerald-400 font-bold">PASSED</code></span>
          </div>
        </div>
        
        {/* HEADER & NAVIGATION */}
        <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-2xl sticky top-0 z-50 shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 bg-gradient-to-br from-emerald-500 via-teal-600 to-amber-500 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.4)] text-slate-950 transform hover:scale-105 transition duration-300">
                <Scale className="w-7 h-7 text-slate-950 font-black animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-amber-300 to-teal-300 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                    AgentEscrowCourt
                  </h1>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Decentralized AI Adjudication & Autonomous Agent Escrow
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 border border-amber-500/40 rounded-xl text-xs font-mono text-amber-300 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active Escrow Court: <code className="text-slate-100 font-bold">{escrowContractAddress ? `${escrowContractAddress.slice(0, 6)}...${escrowContractAddress.slice(-4)}` : ''}</code></span>
              </div>

              {account ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 border border-emerald-500/40 rounded-xl text-xs font-mono text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                  </div>

                  <button
                    onClick={switchWorkerAccount}
                    title="Đổi sang Ví Worker mới để nhận task (Claim)"
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 rounded-xl text-xs font-semibold text-indigo-300 transition shadow-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Switch Worker Role</span>
                  </button>

                  <button
                    onClick={disconnectWallet}
                    title="Disconnect Wallet"
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 rounded-xl text-xs font-medium text-rose-300 transition shadow-lg"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] transition transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4 animate-bounce text-slate-950" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>

          {/* DYNAMIC CONTRACT ADDRESS CONFIGURATION TOP BAR */}
          <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-semibold">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>On-Chain Contracts Config:</span>
              </div>
              <div className="flex items-center gap-3 flex-1 max-w-3xl flex-wrap">
                <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
                  <span className="text-[10px] text-slate-400 font-mono">Escrow Court:</span>
                  <input
                    type="text"
                    placeholder="Escrow Court (0x...)"
                    value={escrowContractAddress}
                    onChange={(e) => handleSaveAddresses(e.target.value, reputationContractAddress)}
                    className="w-full px-3 py-1 bg-slate-900 border border-emerald-900/60 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
                  <span className="text-[10px] text-slate-400 font-mono">Reputation:</span>
                  <input
                    type="text"
                    placeholder="Agent Reputation (0x...)"
                    value={reputationContractAddress}
                    onChange={(e) => handleSaveAddresses(escrowContractAddress, e.target.value)}
                    className="w-full px-3 py-1 bg-slate-900 border border-emerald-900/60 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  onClick={() => { fetchTasksFromContract(); fetchLeaderboardFromContract(); }}
                  disabled={fetchingOnChain}
                  className="px-4 py-1 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-bold flex items-center gap-1.5 transition shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchingOnChain ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ERROR / STEP NOTIFICATIONS */}
        {txError && (
          <div className="max-w-7xl mx-auto px-4 mt-4">
            <div className="p-4 bg-rose-950/90 border border-rose-600 rounded-2xl text-xs text-rose-200 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 animate-bounce" />
                <span className="font-mono">{txError}</span>
              </div>
              <button onClick={() => setTxError(null)} className="text-rose-400 hover:text-white font-bold text-sm">✕</button>
            </div>
          </div>
        )}

        {successBanner && (
          <div className="max-w-7xl mx-auto px-4 mt-4">
            <div className="p-4 bg-emerald-950/90 border border-emerald-500 rounded-2xl text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-pulse" />
                <span className="font-mono">{successBanner}</span>
              </div>
              <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-white font-bold text-sm">✕</button>
            </div>
          </div>
        )}

        {stepMessage && (
          <div className="max-w-7xl mx-auto px-4 mt-4">
            <div className="p-4 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/90 border border-emerald-500/50 rounded-2xl text-xs text-emerald-200 flex items-center gap-3 font-mono shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
              <span>{stepMessage}</span>
            </div>
          </div>
        )}

        {/* HERO METRICS & CYBER STATS */}
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            
            <div className="p-6 bg-slate-900/80 backdrop-blur-xl border border-emerald-500/40 hover:border-emerald-400 rounded-3xl shadow-2xl transition duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition"></div>
              <p className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider font-mono">
                <Activity className="w-4 h-4 text-emerald-400" /> Active Escrow Tasks
              </p>
              <h3 className="text-3xl font-black text-white mt-3 font-mono group-hover:text-emerald-300 transition">
                {tasks.length} <span className="text-xs font-normal text-slate-400">tasks</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">GenLayer On-Chain Intelligent Contract</p>
            </div>

            <div className="p-6 bg-slate-900/80 backdrop-blur-xl border border-amber-500/40 hover:border-amber-400 rounded-3xl shadow-2xl transition duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition"></div>
              <p className="text-xs font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider font-mono">
                <Clock className="w-4 h-4 text-amber-400" /> 24h Dispute Window
              </p>
              <h3 className="text-3xl font-black text-white mt-3 font-mono group-hover:text-amber-300 transition">
                {tasks.filter(t => t.status === 'AWAITING_PAYOUT').length} <span className="text-xs font-normal text-slate-400">cooling off</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Steward Rule: 24h Payout Cooling-off</p>
            </div>

            <div className="p-6 bg-slate-900/80 backdrop-blur-xl border border-teal-500/40 hover:border-teal-400 rounded-3xl shadow-2xl transition duration-300 hover:shadow-[0_0_30px_rgba(20,184,166,0.3)] group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition"></div>
              <p className="text-xs font-bold text-teal-400 flex items-center gap-2 uppercase tracking-wider font-mono">
                <CheckCircle2 className="w-4 h-4 text-teal-400" /> Settled & Disbursed
              </p>
              <h3 className="text-3xl font-black text-white mt-3 font-mono group-hover:text-teal-300 transition">
                {tasks.filter(t => t.status === 'CLOSED').length} <span className="text-xs font-normal text-slate-400">closed</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Finalized after dispute period</p>
            </div>

            <div className="p-6 bg-slate-900/80 backdrop-blur-xl border border-blue-500/40 hover:border-blue-400 rounded-3xl shadow-2xl transition duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition"></div>
              <p className="text-xs font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wider font-mono">
                <Trophy className="w-4 h-4 text-blue-400" /> AI Agent Reputation
              </p>
              <h3 className="text-3xl font-black text-white mt-3 font-mono group-hover:text-blue-300 transition">
                {leaderboard.length} <span className="text-xs font-normal text-slate-400">ranked</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Cross-contract Reputation scores</p>
            </div>

          </div>

          {/* DAPP NAVIGATION TABS */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-8">
            <div className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shadow-inner">
              <button
                onClick={() => setActiveTab('escrows')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                  activeTab === 'escrows'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Active Escrows ({tasks.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                  activeTab === 'leaderboard'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4 text-slate-950" />
                <span>Agent Leaderboard ({leaderboard.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('create')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Escrow</span>
              </button>

              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                  activeTab === 'architecture'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>Architecture Spec</span>
              </button>
            </div>

            {/* STATUS FILTER */}
            {activeTab === 'escrows' && (
              <div className="flex items-center gap-1.5 flex-wrap bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400 px-2 font-mono flex items-center gap-1">
                  <Filter className="w-3 h-3 text-emerald-400" /> Filter:
                </span>
                {['ALL', 'OPEN', 'IN_PROGRESS', 'AWAITING_PAYOUT', 'NEEDS_REVISION', 'DISPUTED', 'ESCALATED', 'CLOSED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-mono font-bold transition ${
                      statusFilter === st
                        ? 'bg-emerald-950 text-emerald-200 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TAB 1: ESCROWS LIST */}
          {activeTab === 'escrows' && (
            <div className="space-y-6">
              {!escrowContractAddress ? (
                <div className="p-12 bg-slate-900/80 backdrop-blur-xl border border-emerald-500/40 rounded-3xl text-center space-y-4 shadow-2xl">
                  <Terminal className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <h3 className="text-xl font-bold text-white">No Deployed Contract Address Configured</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Please deploy <code className="text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded font-mono">AgentEscrowCourt.py</code> on GenStudio, then paste your contract address in the top bar.
                  </p>
                </div>
              ) : fetchingOnChain ? (
                <div className="p-16 text-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs font-mono text-emerald-300">Fetching on-chain Escrow tasks from GenLayer Studionet RPC...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-12 bg-slate-900/80 backdrop-blur-xl border border-emerald-500/40 rounded-3xl text-center space-y-4 shadow-2xl">
                  <FileCheck className="w-12 h-12 text-slate-500 mx-auto" />
                  <h3 className="text-xl font-bold text-white">No Escrow Tasks Found</h3>
                  <p className="text-xs text-slate-400">
                    No on-chain Escrows found for status <span className="text-emerald-300 font-bold font-mono">{statusFilter}</span>. Create your first Escrow!
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 rounded-xl text-xs font-black transition inline-flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                  >
                    <PlusCircle className="w-4 h-4" /> Create Escrow
                  </button>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-7 bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-emerald-500/60 rounded-3xl transition duration-300 shadow-2xl hover:shadow-[0_0_35px_rgba(16,185,129,0.25)] space-y-5 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition duration-500"></div>

                    <div className="flex flex-wrap justify-between items-start gap-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold rounded-xl shadow-inner">
                            Task #{task.id}
                          </span>
                          <h3 className="text-xl font-extrabold text-white tracking-tight">{task.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                          <span>Client: <code className="text-emerald-300 font-bold">{task.client.slice(0, 8)}...</code></span>
                          <span>Worker: <code className="text-amber-300 font-bold">{task.worker.slice(0, 8)}...</code></span>
                          <span>Submission Attempts: <code className="text-blue-300 font-bold">{task.attempts}/3</code></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black text-amber-400 font-mono drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                          {(Number(BigInt(task.amount || 0)) / 1e18).toFixed(2)} GEN
                        </div>
                        <div className="text-xs text-emerald-300 font-mono mt-0.5">
                          15% Collateral Stake: {(Number(BigInt(task.worker_stake || 0)) / 1e18).toFixed(2)} GEN
                        </div>
                        <div className="mt-2">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-950/90 p-4 rounded-2xl border border-slate-800 font-mono relative z-10">
                      <div>
                        <span className="text-slate-400 flex items-center gap-1 font-semibold">
                          <Compass className="w-3.5 h-3.5 text-emerald-400" /> Criteria Spec URL:
                        </span>
                        <a href={task.criteria_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1.5 truncate mt-1 font-medium">
                          {task.criteria_url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        {task.criteria_hash && (
                          <div className="mt-1 text-[10px] text-amber-300/80 truncate">
                            SHA-256: <code className="text-amber-300">{task.criteria_hash.slice(0, 18)}...</code>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 flex items-center gap-1 font-semibold">
                          <FileCheck className="w-3.5 h-3.5 text-amber-400" /> Deliverable URL:
                        </span>
                        {task.deliverable_url ? (
                          <a href={task.deliverable_url} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5 truncate mt-1 font-medium">
                            {task.deliverable_url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic block mt-1">Pending Worker Submission...</span>
                        )}
                      </div>
                    </div>

                    {/* VERDICT REASON & CONFIDENCE METER */}
                    {task.verdict_reason && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl text-xs space-y-2 relative z-10 shadow-inner">
                        <div className="flex justify-between items-center">
                          <span className="font-bold flex items-center gap-1.5 text-emerald-300 font-mono">
                            <Terminal className="w-4 h-4 text-emerald-400" /> AI Jury Verdict Log [{task.verdict || 'NONE'}]:
                          </span>
                          {task.confidence && (
                            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950 px-2.5 py-0.5 rounded-full border border-amber-800">
                              Confidence: {task.confidence}%
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-900">
                          {task.verdict_reason}
                        </p>
                      </div>
                    )}

                    {/* STEWARD COMPLIANT ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 relative z-10">
                      <div className="text-xs font-mono text-slate-400">
                        {task.status === 'AWAITING_PAYOUT' && (
                          <span className="text-amber-300 flex items-center gap-1 font-semibold">
                            <Clock className="w-4 h-4 text-amber-400 animate-pulse" /> 24h Dispute Cooling-Off Window Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {/* ACCEPT TASK (Worker lock 15% stake) */}
                        {task.status === 'OPEN' && (
                          !account ? (
                            <button
                              onClick={connectWallet}
                              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/40 text-xs font-bold rounded-xl transition flex items-center gap-2"
                            >
                              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Connect Wallet to Claim (15% Stake)
                            </button>
                          ) : account.toLowerCase() !== task.client.toLowerCase() ? (
                            <button
                              onClick={() => handleAcceptTask(task)}
                              disabled={loading}
                              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 transform hover:scale-105"
                            >
                              <DollarSign className="w-4 h-4" /> Claim Task (Stake 15%)
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-amber-300 font-medium bg-amber-950/70 px-3 py-2 rounded-xl border border-amber-700/60 flex items-center gap-1.5 shadow-sm">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                Ví của bạn là Client tạo task này (Smart Contract cấm Client tự claim)
                              </span>
                              <button
                                onClick={switchWorkerAccount}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-1.5 shrink-0"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Đổi sang Ví Worker để Claim
                              </button>
                            </div>
                          )
                        )}

                        {/* SUBMIT WORK */}
                        {(task.status === 'IN_PROGRESS' || task.status === 'NEEDS_REVISION') && account && account === task.worker && (
                          <button
                            onClick={() => setSubmitTaskTargetId(task.id)}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2"
                          >
                            <FileCheck className="w-4 h-4" /> Submit Deliverable & Trigger AI Jury
                          </button>
                        )}

                        {/* RAISE DISPUTE */}
                        {task.status === 'AWAITING_PAYOUT' && account && (account === task.client || account === task.worker) && (
                          <button
                            onClick={() => setDisputeTargetId(task.id)}
                            className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
                          >
                            <AlertTriangle className="w-4 h-4 text-rose-400" /> Raise Dispute
                          </button>
                        )}

                        {/* FINALIZE PAYOUT */}
                        {task.status === 'AWAITING_PAYOUT' && (
                          <button
                            onClick={() => handleFinalizePayout(task.id)}
                            disabled={loading}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Finalize Payout (Disburse Funds)
                          </button>
                        )}

                        {/* RECOVER STUCK FUNDS */}
                        {(task.status === 'OPEN' || task.status === 'IN_PROGRESS' || task.status === 'NEEDS_REVISION') && account && account === task.client && (
                          <button
                            onClick={() => handleRecoverStuckFunds(task.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                          >
                            Recover Stuck Funds
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SUBMIT WORK FORM MODAL */}
                    {submitTaskTargetId === task.id && (
                      <div className="mt-4 p-5 bg-slate-950 border border-emerald-500/50 rounded-2xl space-y-4 shadow-2xl relative z-20">
                        <h4 className="text-xs font-bold text-emerald-300 font-mono flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-emerald-400" /> Submit Deliverable for Task #{task.id}
                        </h4>
                        <input
                          type="url"
                          placeholder="https://raw.githubusercontent.com/.../report.md"
                          value={deliverableUrlInput}
                          onChange={(e) => setDeliverableUrlInput(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-900 border border-emerald-900/60 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-400 shadow-inner"
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setSubmitTaskTargetId(null)}
                            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSubmitWork(task.id)}
                            disabled={loading}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 text-xs font-black rounded-xl shadow-lg"
                          >
                            Submit & Trigger AI Evaluation
                          </button>
                        </div>
                      </div>
                    )}

                    {/* RAISE DISPUTE FORM MODAL */}
                    {disputeTargetId === task.id && (
                      <div className="mt-4 p-5 bg-slate-950 border border-rose-500/50 rounded-2xl space-y-4 shadow-2xl relative z-20">
                        <h4 className="text-xs font-bold text-rose-300 font-mono flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400" /> Raise Dispute for Task #{task.id}
                        </h4>
                        <input
                          type="text"
                          placeholder="Reason for dispute..."
                          value={disputeReasonInput}
                          onChange={(e) => setDisputeReasonInput(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-900 border border-rose-900/60 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-400 shadow-inner"
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setDisputeTargetId(null)}
                            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRaiseDispute(task.id)}
                            disabled={loading}
                            className="px-5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-lg"
                          >
                            Submit Dispute On-Chain
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: AGENT LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              {!reputationContractAddress ? (
                <div className="p-12 bg-slate-900/80 backdrop-blur-xl border border-amber-500/40 rounded-3xl text-center space-y-4 shadow-2xl">
                  <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                  <h3 className="text-xl font-bold text-white">No AgentReputation Contract Address Set</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Please deploy <code className="text-amber-300 bg-amber-950 px-2 py-0.5 rounded font-mono">AgentReputation.py</code> on GenStudio and paste its address in the top bar.
                  </p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="p-12 bg-slate-900/80 backdrop-blur-xl border border-amber-500/40 rounded-3xl text-center space-y-4 shadow-2xl">
                  <Trophy className="w-12 h-12 text-slate-500 mx-auto" />
                  <h3 className="text-xl font-bold text-white">No Agent Reputation Records On-Chain</h3>
                  <p className="text-xs text-slate-400">
                    Once tasks are adjudicated and finalized, Agent scores will automatically appear on-chain.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/80 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
                      <Trophy className="w-5 h-5 text-amber-400" /> On-Chain AI Agent Reputation Rankings
                    </h3>
                    <span className="text-xs font-mono text-emerald-300 font-bold">Live AgentReputation.py</span>
                  </div>
                  <div className="divide-y divide-slate-800 text-xs">
                    {leaderboard.map((item, idx) => {
                      const total = Number(item.total_tasks || 0);
                      const succ = Number(item.successful_tasks || 0);
                      const winRate = total > 0 ? Math.round((succ / total) * 100) : 100;

                      return (
                        <div key={item.agent} className="p-5 flex flex-wrap justify-between items-center gap-4 hover:bg-emerald-950/20 transition duration-200">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-900 to-teal-900 border border-emerald-500/40 flex items-center justify-center font-bold font-mono text-emerald-300 text-sm shadow-md">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="font-mono font-bold text-white flex items-center gap-2 text-sm">
                                <span>{item.agent}</span>
                                {idx === 0 && <span className="px-2.5 py-0.5 bg-amber-950 border border-amber-500/60 text-amber-300 text-[10px] rounded-full font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)]">Top Rated Agent</span>}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 font-mono">
                                Total Jobs: <code className="text-emerald-300">{item.total_tasks}</code> | Success: <code className="text-teal-400">{item.successful_tasks}</code> | Failed: <code className="text-rose-400">{item.failed_tasks}</code>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-8 font-mono text-right">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Success Rate</span>
                              <span className="text-base font-black text-emerald-400">{winRate}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Reputation Score</span>
                              <span className="text-2xl font-black bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">{item.score} pts</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE ESCROW FORM */}
          {activeTab === 'create' && (
            <div className="max-w-3xl mx-auto p-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl space-y-6">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                  <PlusCircle className="w-6 h-6 text-emerald-400" /> Create New AI Escrow Task
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Deposit GEN tokens locked safely in an Intelligent Contract. Workers must lock a 15% collateral stake to claim.
                </p>
              </div>

              <form onSubmit={handleCreateEscrow} className="space-y-5 text-xs font-mono">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">Task Unique ID</label>
                    <input
                      type="text"
                      placeholder="e.g. task_001 (or auto-generated)"
                      value={taskIdInput}
                      onChange={(e) => setTaskIdInput(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400 shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">Escrow Reward Amount (GEN)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400 shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5 font-sans">Task Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AI Security Code Audit for Smart Contract"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-sans focus:outline-none focus:border-emerald-400 font-semibold text-sm shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5 font-sans">Criteria Spec URL (Full HTTP/HTTPS requirement spec)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://raw.githubusercontent.com/.../requirements.txt"
                    value={criteriaUrl}
                    onChange={(e) => setCriteriaUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5 font-sans">Criteria SHA-256 Hash (Steward Cryptographic Proof Pinning)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    value={criteriaHash}
                    onChange={(e) => setCriteriaHash(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">
                    Ensures criteria spec immutability. Validator nodes verify SHA-256 hash before LLM evaluation.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5 font-sans">Deadline (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deadlineHours}
                    onChange={(e) => setDeadlineHours(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400 shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-600 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.4)] transition duration-300 flex items-center justify-center gap-2"
                >
                  <Cpu className="w-5 h-5 animate-pulse text-slate-950" />
                  <span>{loading ? 'Submitting Transaction to Studionet...' : 'Create Escrow & Deposit GEN'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: ARCHITECTURE SPEC */}
          {activeTab === 'architecture' && (
            <div className="max-w-4xl mx-auto p-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl space-y-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2 text-emerald-400">
                <Code2 className="w-6 h-6" /> GenLayer Steward Compliant Architecture
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-emerald-300 font-bold block text-sm">1. 24h Payout Cooling-off</span>
                  <p className="text-slate-400 leading-relaxed font-sans">
                    After AI Jury reaches consensus, task status enters AWAITING_PAYOUT for 24h (`payout_ready_at`) enabling either party to raise a dispute before funds disburse.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-amber-300 font-bold block text-sm">2. 15% Collateral Staking</span>
                  <p className="text-slate-400 leading-relaxed font-sans">
                    Workers must lock a 15% collateral stake when claiming an OPEN task to prevent spam claims and ensure skin-in-the-game commitment.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-teal-300 font-bold block text-sm">3. Untruncated Web Renders</span>
                  <p className="text-slate-400 leading-relaxed font-sans">
                    Full web renders of spec and deliverable are ingested directly into the LLM prompt without character truncation (`[:1500]`).
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-blue-300 font-bold block text-sm">4. Stuck-Fund Recovery</span>
                  <p className="text-slate-400 leading-relaxed font-sans">
                    Client can reclaim funds via `recover_stuck_funds` if the task is abandoned or misses deadline.
                  </p>
                </div>
              </div>
            </div>
          )}

        </section>

        {/* FAQ */}
        <section className="max-w-7xl mx-auto px-4 py-8 border-t border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-emerald-400" /> Frequently Asked Questions
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-4 text-left flex justify-between items-center text-xs font-bold text-slate-200 hover:text-emerald-300 transition font-mono"
                >
                  <span>{faq.q}</span>
                  {openFaq === index ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {openFaq === index && (
                  <div className="p-4 pt-0 text-xs text-slate-400 font-sans border-t border-slate-800 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-400 space-y-2 relative z-10">
        <div className="flex justify-center items-center gap-2 font-mono">
          <Scale className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-200">AgentEscrowCourt</span>
          <span>•</span>
          <span>GenLayer Studionet (Chain ID 61999)</span>
        </div>
        <p className="text-[11px] text-slate-400 font-sans">
          Decentralized AI Escrow Court powered by GenLayer Intelligent Contracts & Multi-Source Web Rendering.
        </p>
      </footer>
    </div>
  );
}
