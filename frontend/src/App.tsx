import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from 'genlayer-js';
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
  Link as LinkIcon
} from 'lucide-react';
import { STUDIONET_CONFIG, DEFAULT_ESCROW_CONTRACT_ADDRESS, DEFAULT_REPUTATION_CONTRACT_ADDRESS } from './config';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface EscrowTask {
  id: string;
  client: string;
  worker: string;
  title: string;
  criteria_url: string;
  deliverable_url: string;
  amount: string;
  status: number; // 0: CREATED, 1: SUBMITTED, 2: RELEASED, 3: REFUNDED, 4: RETRY
  attempts: number;
  verdict_reason: string;
}

interface AgentReputation {
  address: string;
  name: string;
  score: number;
  completedJobs: number;
  role: string;
  badge: string;
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'escrows' | 'leaderboard' | 'inspector' | 'create'>('escrows');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Contract Addresses (stored in localStorage or from env)
  const [escrowContractAddress, setEscrowContractAddress] = useState<string>(() => {
    return localStorage.getItem('escrow_contract_addr') || DEFAULT_ESCROW_CONTRACT_ADDRESS;
  });
  const [reputationContractAddress, setReputationContractAddress] = useState<string>(() => {
    return localStorage.getItem('reputation_contract_addr') || DEFAULT_REPUTATION_CONTRACT_ADDRESS;
  });

  const [tasks, setTasks] = useState<EscrowTask[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingOnChain, setFetchingOnChain] = useState<boolean>(false);
  const [adjudicatingId, setAdjudicatingId] = useState<string | null>(null);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<EscrowTask | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [txError, setTxError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [criteriaUrl, setCriteriaUrl] = useState('');
  const [workerAddr, setWorkerAddr] = useState('');
  const [amount, setAmount] = useState('1.0');
  const [submitTaskTargetId, setSubmitTaskTargetId] = useState<string | null>(null);
  const [deliverableUrlInput, setDeliverableUrlInput] = useState('');

  // Save contract addresses
  const handleSaveAddresses = (escrowAddr: string, repAddr: string) => {
    setEscrowContractAddress(escrowAddr);
    setReputationContractAddress(repAddr);
    localStorage.setItem('escrow_contract_addr', escrowAddr);
    localStorage.setItem('reputation_contract_addr', repAddr);
  };

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask is not installed. Please install MetaMask to interact with GenLayer Studionet.');
      return;
    }
    try {
      setLoading(true);
      setTxError(null);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddr = accounts[0];
      setAccount(userAddr);

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

  // 100% REAL ON-CHAIN TASK FETCHING FROM GENLAYER STUDIONET
  const fetchTasksFromContract = useCallback(async () => {
    if (!escrowContractAddress || escrowContractAddress.trim() === '') {
      setTasks([]);
      return;
    }

    try {
      setFetchingOnChain(true);
      setTxError(null);
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
      });

      // Query total task count on-chain
      const rawCount = await client.readContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'get_task_count',
        args: []
      });

      const total = Number(rawCount || 0);
      const fetchedTasks: EscrowTask[] = [];

      for (let i = 1; i <= total; i++) {
        try {
          const taskData = await client.readContract({
            account: account as any,
            address: escrowContractAddress as any,
            functionName: 'get_task',
            args: [BigInt(i)]
          });

          if (taskData) {
            // Convert wei to GEN string
            const amountInGen = (Number(BigInt(taskData.amount || 0)) / 1e18).toFixed(2);
            fetchedTasks.push({
              id: taskData.id?.toString() || i.toString(),
              client: taskData.client || '',
              worker: taskData.worker || '',
              title: taskData.title || '',
              criteria_url: taskData.criteria_url || '',
              deliverable_url: taskData.deliverable_url || '',
              amount: amountInGen,
              status: Number(taskData.status ?? 0),
              attempts: Number(taskData.attempts ?? 0),
              verdict_reason: taskData.verdict_reason || ''
            });
          }
        } catch (err) {
          console.error(`Error reading task ${i} from contract:`, err);
        }
      }

      setTasks(fetchedTasks.reverse());
    } catch (err: any) {
      console.error("Failed to read tasks on-chain:", err);
      setTxError("Unable to fetch tasks from contract address. Make sure contract is deployed on Studionet.");
    } finally {
      setFetchingOnChain(false);
    }
  }, [escrowContractAddress, account]);

  // Trigger fetch when contract address changes or tab changes
  useEffect(() => {
    fetchTasksFromContract();
  }, [fetchTasksFromContract]);

  // 100% REAL ON-CHAIN CREATE ESCROW TRANSACTION
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

    setLoading(true);
    setTxError(null);
    setStepMessage("Submitting create_escrow transaction to GenLayer Studionet...");

    try {
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      // Convert GEN to wei
      const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18));

      const tx = await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'create_escrow',
        args: [title, criteriaUrl, workerAddr as any],
        value: weiAmount
      });

      setStepMessage(`Transaction sent! Hash: ${tx.hash || tx}`);

      // Refresh on-chain tasks
      await fetchTasksFromContract();

      setTitle('');
      setCriteriaUrl('');
      setWorkerAddr('');
      setActiveTab('escrows');
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "On-chain transaction failed.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // 100% REAL ON-CHAIN SUBMIT WORK TRANSACTION
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
    setStepMessage(`Submitting deliverable on-chain for Escrow #${taskId}...`);

    try {
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'submit_deliverable',
        args: [BigInt(taskId), deliverableUrlInput],
        value: BigInt(0)
      });

      setSubmitTaskTargetId(null);
      setDeliverableUrlInput('');

      // Refresh tasks
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to submit deliverable on-chain.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // 100% REAL ON-CHAIN ADJUDICATE TRANSACTION (TRỊNH AI CONSENSUS CHẠY TRÊN VALDATOR NODES)
  const handleTriggerAdjudication = async (taskId: string) => {
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }

    setAdjudicatingId(taskId);
    setTxError(null);
    setStepMessage("Executing gl.nondet.web.render & LLM Jury consensus on GenLayer Studionet...");

    try {
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'adjudicate',
        args: [BigInt(taskId)],
        value: BigInt(0)
      });

      setStepMessage("Adjudication transaction executed! Fetching final verdict...");
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "On-chain adjudication transaction failed.");
    } finally {
      setAdjudicatingId(null);
      setStepMessage('');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'CREATED') return task.status === 0;
    if (statusFilter === 'SUBMITTED') return task.status === 1;
    if (statusFilter === 'RELEASED') return task.status === 2;
    if (statusFilter === 'REFUNDED') return task.status === 3;
    if (statusFilter === 'RETRY') return task.status === 4;
    return true;
  });

  const faqs = [
    {
      q: "Why does AgentEscrowCourt require GenLayer?",
      a: "Traditional Solidity smart contracts can only execute deterministic math. When autonomous AI Agents enter an agreement for off-chain work (e.g., code audits, research reports), Solidity cannot verify whether the deliverable satisfies subjective criteria. GenLayer embeds LLMs directly into the consensus layer, enabling a decentralized AI Validator Jury to evaluate deliverables fair and trustlessly."
    },
    {
      q: "What is Optimistic Democracy & Semantic Consensus?",
      a: "Each validator runs a distinct LLM model. For non-deterministic execution, instead of forcing exact character-by-character text matches on freeform reasoning, GenLayer uses gl.vm.run_nondet to compare only the semantic VERDICT ('RELEASE', 'REFUND', or 'RETRY')."
    },
    {
      q: "How does the Retry Mechanism & Canary Token Defense work?",
      a: "If a deliverable has minor fixable issues, the AI Jury returns a RETRY verdict allowing the worker up to 3 submission attempts. To prevent prompt injection attacks inside worker submissions, the contract injects a SHA-256 dynamic Canary Token into every adjudication execution."
    },
    {
      q: "How to deploy and connect your own contracts?",
      a: "Deploy AgentEscrowCourt.py and AgentReputation.py on GenLayer Studio (https://studio.genlayer.com). Copy the deployed contract address and paste it into the top contract address configuration bar in this app."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/40 via-slate-950 to-slate-950">
      
      {/* SECTION 1: HEADER & TOP NAVIGATION */}
      <div>
        <header className="border-b border-purple-900/40 bg-slate-900/80 backdrop-blur-2xl sticky top-0 z-50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 rounded-2xl shadow-xl shadow-purple-900/40 text-white transform hover:scale-105 transition">
                <Scale className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-400 bg-clip-text text-transparent tracking-tight">
                  AgentEscrowCourt
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" /> Decentralized AI Adjudication for Agentic Economy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-950/60 border border-purple-800/40 rounded-full text-xs font-mono text-purple-300 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>studionet (Chain ID: 61999)</span>
              </div>

              {/* CONNECTED / DISCONNECT WALLET BLOCK */}
              {account ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-purple-500/40 rounded-xl text-xs font-mono text-purple-200 shadow-md">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                  </div>

                  <button
                    onClick={disconnectWallet}
                    title="Disconnect Wallet"
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/40 rounded-xl text-xs font-medium text-rose-300 transition shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 hover:shadow-purple-700/50 transition transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>

          {/* REAL ON-CHAIN CONTRACT ADDRESS CONFIGURATION BAR */}
          <div className="bg-purple-950/40 border-t border-purple-900/30 px-4 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-purple-300 font-mono">
                <LinkIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>On-Chain Escrow Contract:</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xl">
                <input
                  type="text"
                  placeholder="Paste deployed AgentEscrowCourt address (0x...)"
                  value={escrowContractAddress}
                  onChange={(e) => handleSaveAddresses(e.target.value, reputationContractAddress)}
                  className="w-full px-3 py-1 bg-slate-950 border border-purple-900/50 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={fetchTasksFromContract}
                  disabled={fetchingOnChain}
                  className="px-3 py-1 bg-purple-800 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingOnChain ? 'animate-spin' : ''}`} />
                  <span>Sync On-Chain</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ERROR NOTIFICATION BANNER */}
        {txError && (
          <div className="max-w-7xl mx-auto px-4 mt-4">
            <div className="p-3 bg-rose-950/70 border border-rose-800/60 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{txError}</span>
              </div>
              <button onClick={() => setTxError(null)} className="text-rose-400 hover:text-white">✕</button>
            </div>
          </div>
        )}

        {/* SECTION 2: HERO BANNER & STATS */}
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-purple-950/40 border border-purple-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-400" /> Total Escrow Value
              </p>
              <h3 className="text-2xl font-black text-white mt-2">
                {tasks.reduce((acc, t) => acc + parseFloat(t.amount || '0'), 0).toFixed(1)} <span className="text-sm font-normal text-purple-300">GEN</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Locked on-chain in Studionet</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border border-indigo-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" /> Active Escrows
              </p>
              <h3 className="text-2xl font-black text-white mt-2">{tasks.length}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Managed by Intelligent Contract</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-emerald-950/40 border border-emerald-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> AI Verdicts Released
              </p>
              <h3 className="text-2xl font-black text-white mt-2">
                {tasks.filter(t => t.status === 2).length}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Optimistic democracy consensus</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-amber-950/40 border border-amber-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-400" /> Retry Active
              </p>
              <h3 className="text-2xl font-black text-white mt-2">
                {tasks.filter(t => t.status === 4).length}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Multi-attempt feedback loop</p>
            </div>
          </div>

          {/* MAIN DASHBOARD TAB CONTROL */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-900/30 pb-4 mb-6">
            <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-purple-900/40">
              <button
                onClick={() => setActiveTab('escrows')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'escrows'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Active Escrows ({tasks.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Escrow</span>
              </button>
            </div>

            {/* STATUS FILTER BUTTONS FOR ESCROWS TAB */}
            {activeTab === 'escrows' && (
              <div className="flex items-center gap-1.5 flex-wrap bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 px-2 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>
                {['ALL', 'CREATED', 'SUBMITTED', 'RELEASED', 'REFUNDED', 'RETRY'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      statusFilter === st
                        ? 'bg-purple-900/80 text-purple-200 border border-purple-700/50'
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
            <div className="space-y-4">
              {!escrowContractAddress ? (
                <div className="p-8 bg-slate-900/60 border border-purple-900/30 rounded-2xl text-center space-y-3">
                  <Terminal className="w-10 h-10 text-purple-400 mx-auto animate-bounce" />
                  <h3 className="text-lg font-bold text-white">No Deployed Contract Address Configured</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Please deploy <code className="text-purple-300 bg-purple-950 px-1.5 py-0.5 rounded">AgentEscrowCourt.py</code> on GenStudio, then paste your contract address in the top bar to fetch real on-chain escrows.
                  </p>
                </div>
              ) : fetchingOnChain ? (
                <div className="p-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Fetching on-chain Escrow tasks from GenLayer Studionet RPC...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-8 bg-slate-900/60 border border-purple-900/30 rounded-2xl text-center space-y-3">
                  <FileCheck className="w-10 h-10 text-slate-500 mx-auto" />
                  <h3 className="text-lg font-bold text-white">No Escrow Tasks Found</h3>
                  <p className="text-xs text-slate-400">
                    No on-chain Escrows found for status <span className="text-purple-300 font-bold">{statusFilter}</span>. Create your first Escrow!
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" /> Create Escrow
                  </button>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-6 bg-slate-900/80 border border-purple-900/30 hover:border-purple-600/50 rounded-2xl transition shadow-xl space-y-4"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 bg-purple-950 border border-purple-800/50 text-purple-300 font-mono text-xs font-bold rounded-lg">
                            Escrow #{task.id}
                          </span>
                          <h3 className="text-lg font-bold text-white">{task.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                          <span>Client: <code className="text-purple-300">{task.client.slice(0, 8)}...</code></span>
                          <span>Worker: <code className="text-indigo-300">{task.worker.slice(0, 8)}...</code></span>
                          <span>Attempts: <code className="text-amber-300">{task.attempts}/3</code></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black text-emerald-400 font-mono">{task.amount} GEN</div>
                        <div className="mt-1">
                          {task.status === 0 && <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 text-xs rounded-full font-semibold">CREATED</span>}
                          {task.status === 1 && <span className="px-3 py-1 bg-indigo-950 text-indigo-300 border border-indigo-700 text-xs rounded-full font-semibold flex items-center gap-1"><Clock className="w-3 h-3 animate-spin"/> SUBMITTED</span>}
                          {task.status === 2 && <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs rounded-full font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> RELEASED</span>}
                          {task.status === 3 && <span className="px-3 py-1 bg-rose-950 text-rose-300 border border-rose-700 text-xs rounded-full font-semibold flex items-center gap-1"><XCircle className="w-3 h-3"/> REFUNDED</span>}
                          {task.status === 4 && <span className="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-700 text-xs rounded-full font-semibold flex items-center gap-1"><RotateCcw className="w-3 h-3"/> RETRY ALLOWED</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-900 font-mono">
                      <div>
                        <span className="text-slate-400">Criteria Spec URL:</span>
                        <a href={task.criteria_url} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline flex items-center gap-1 truncate mt-0.5">
                          {task.criteria_url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-400">Deliverable URL:</span>
                        {task.deliverable_url ? (
                          <a href={task.deliverable_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1 truncate mt-0.5">
                            {task.deliverable_url} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic block mt-0.5">Pending Worker Submission...</span>
                        )}
                      </div>
                    </div>

                    {/* VERDICT REASON DISPLAY */}
                    {task.verdict_reason && (
                      <div className="p-3 bg-purple-950/30 border border-purple-800/30 rounded-xl text-xs text-purple-200 space-y-1">
                        <span className="font-bold flex items-center gap-1 text-purple-300">
                          <Terminal className="w-3.5 h-3.5" /> AI Court Adjudication Log:
                        </span>
                        <p className="font-mono text-slate-300">{task.verdict_reason}</p>
                      </div>
                    )}

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View On-Chain Details
                      </button>

                      <div className="flex items-center gap-2">
                        {/* SUBMIT WORK BUTTON */}
                        {(task.status === 0 || task.status === 4) && (
                          <button
                            onClick={() => setSubmitTaskTargetId(task.id)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                          >
                            <FileCheck className="w-4 h-4" /> Submit Deliverable
                          </button>
                        )}

                        {/* TRIGGER ADJUDICATION BUTTON */}
                        {task.status === 1 && (
                          <button
                            onClick={() => handleTriggerAdjudication(task.id)}
                            disabled={adjudicatingId === task.id}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/50 transition flex items-center gap-2"
                          >
                            <Scale className={`w-4 h-4 ${adjudicatingId === task.id ? 'animate-spin' : ''}`} />
                            <span>{adjudicatingId === task.id ? 'Adjudicating On-Chain...' : 'Trigger AI Adjudication'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* INLINE SUBMIT WORK MODAL */}
                    {submitTaskTargetId === task.id && (
                      <div className="mt-4 p-4 bg-slate-950 border border-indigo-900/50 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                          <FileCheck className="w-4 h-4" /> Submit Deliverable for Escrow #{task.id}
                        </h4>
                        <input
                          type="url"
                          placeholder="https://raw.githubusercontent.com/.../report.md"
                          value={deliverableUrlInput}
                          onChange={(e) => setDeliverableUrlInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-indigo-900/60 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSubmitTaskTargetId(null)}
                            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSubmitWork(task.id)}
                            disabled={loading}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                          >
                            Confirm On-Chain Submit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CREATE ESCROW FORM */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto p-6 bg-slate-900/90 border border-purple-900/40 rounded-2xl shadow-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-purple-400" /> Create New AI Escrow Task
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Deposit GEN tokens locked safely in an Intelligent Contract until the AI Jury evaluates deliverable criteria.
                </p>
              </div>

              <form onSubmit={handleCreateEscrow} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AI Security Code Audit for Smart Contract"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Criteria Spec URL (GitHub raw/documentation)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://raw.githubusercontent.com/.../requirements.txt"
                    value={criteriaUrl}
                    onChange={(e) => setCriteriaUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Assigned Worker / Agent Address</label>
                    <input
                      type="text"
                      required
                      placeholder="0x..."
                      value={workerAddr}
                      onChange={(e) => setWorkerAddr(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Escrow Amount (GEN)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-xl shadow-purple-900/40 transition flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{loading ? 'Submitting Transaction to Studionet...' : 'Create Escrow & Lock Funds'}</span>
                </button>
              </form>
            </div>
          )}
        </section>

        {/* SECTION 3: FAQ SECTION */}
        <section className="max-w-7xl mx-auto px-4 py-8 border-t border-purple-900/30">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-purple-400" /> Frequently Asked Questions
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-slate-900/80 border border-purple-900/30 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-4 text-left flex justify-between items-center text-xs font-bold text-slate-200 hover:text-purple-300 transition"
                >
                  <span>{faq.q}</span>
                  {openFaq === index ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {openFaq === index && (
                  <div className="p-4 pt-0 text-xs text-slate-400 font-sans border-t border-purple-950/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-purple-900/30 bg-slate-950 py-6 text-center text-xs text-slate-400 space-y-2">
        <div className="flex justify-center items-center gap-2">
          <Scale className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-slate-300">AgentEscrowCourt</span>
          <span>•</span>
          <span>GenLayer Studionet (Chain ID 61999)</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Decentralized AI Escrow Court powered by GenLayer Intelligent Contracts & Multi-Source Web Rendering.
        </p>
      </footer>
    </div>
  );
}
