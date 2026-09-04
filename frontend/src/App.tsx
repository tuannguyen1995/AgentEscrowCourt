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
  Link as LinkIcon,
  AlertTriangle,
  DollarSign
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
  worker_stake: string;
  status: string; // OPEN, IN_PROGRESS, AWAITING_PAYOUT, NEEDS_REVISION, DISPUTED, ESCALATED, CLOSED
  attempts: string;
  verdict: string;
  verdict_reason: string;
  confidence: string;
  payout_ready_at: string;
  deadline: string;
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'escrows' | 'create'>('escrows');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Contract Addresses (stored in localStorage or from env)
  const [escrowContractAddress, setEscrowContractAddress] = useState<string>(() => {
    return localStorage.getItem('escrow_contract_addr') || DEFAULT_ESCROW_CONTRACT_ADDRESS;
  });
  const [reputationContractAddress, setReputationContractAddress] = useState<string>(() => {
    return localStorage.getItem('reputation_contract_addr') || DEFAULT_REPUTATION_CONTRACT_ADDRESS;
  });

  const [tasks, setTasks] = useState<EscrowTask[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingOnChain, setFetchingOnChain] = useState<boolean>(false);
  const [adjudicatingId, setAdjudicatingId] = useState<string | null>(null);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<EscrowTask | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [txError, setTxError] = useState<string | null>(null);

  // Form states
  const [taskIdInput, setTaskIdInput] = useState('');
  const [title, setTitle] = useState('');
  const [criteriaUrl, setCriteriaUrl] = useState('');
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
      setAccount(userAddr.toLowerCase());

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

  // 100% REAL ON-CHAIN TASK FETCHING VIA get_all_tasks()
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

      const rawJsonString = await client.readContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'get_all_tasks',
        args: []
      });

      if (rawJsonString) {
        const parsed: EscrowTask[] = typeof rawJsonString === 'string' ? JSON.parse(rawJsonString) : rawJsonString;
        setTasks(parsed.reverse());
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      console.error("Failed to read tasks on-chain:", err);
      setTxError("Unable to fetch tasks from contract address. Make sure contract is deployed on Studionet.");
    } finally {
      setFetchingOnChain(false);
    }
  }, [escrowContractAddress, account]);

  useEffect(() => {
    fetchTasksFromContract();
  }, [fetchTasksFromContract]);

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
    setStepMessage("Submitting create_escrow transaction on GenLayer Studionet...");

    try {
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18));

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'create_escrow',
        args: [tid, title, criteriaUrl, BigInt(deadlineHours)],
        value: weiAmount
      });

      await fetchTasksFromContract();

      setTaskIdInput('');
      setTitle('');
      setCriteriaUrl('');
      setActiveTab('escrows');
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

    setLoading(true);
    setTxError(null);
    setStepMessage(`Locking 15% collateral stake to claim Escrow #${task.id}...`);

    try {
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      // 15% of task amount
      const minStakeWei = (BigInt(task.amount) * BigInt(15)) / BigInt(100);

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'accept_task',
        args: [task.id],
        value: minStakeWei > BigInt(0) ? minStakeWei : BigInt(1)
      });

      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || "Failed to accept task.");
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // SUBMIT WORK
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
    setStepMessage(`Submitting deliverable and triggering AI Jury evaluation...`);

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
        args: [taskId, deliverableUrlInput],
        value: BigInt(0)
      });

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
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'raise_dispute',
        args: [taskId, disputeReasonInput || "Disputed within 24h cooling off"],
        value: BigInt(0)
      });

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
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'finalize_payout',
        args: [taskId],
        value: BigInt(0)
      });

      await fetchTasksFromContract();
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
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0],
        account: account as any
      });

      await client.writeContract({
        account: account as any,
        address: escrowContractAddress as any,
        functionName: 'recover_stuck_funds',
        args: [taskId],
        value: BigInt(0)
      });

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

  const faqs = [
    {
      q: "Why 24-hour Cooling-off & Dispute Window?",
      a: "To strictly satisfy GenLayer Steward rules, after AI Jury returns a RELEASE verdict, funds enter AWAITING_PAYOUT for 24h allowing either client or worker to raise a dispute before funds disburse."
    },
    {
      q: "How does 15% Collateral Staking work?",
      a: "Workers must lock a 15% collateral stake when claiming an OPEN task. This prevents spam job claims and ensures skin-in-the-game commitment."
    },
    {
      q: "How does Untruncated Evidence Ingestion work?",
      a: "The contract ingests full specification and deliverable web renders directly into the AI Jury prompt without character truncation, preventing premature evaluation failures."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/40 via-slate-950 to-slate-950">
      
      {/* HEADER */}
      <div>
        <header className="border-b border-purple-900/40 bg-slate-900/80 backdrop-blur-2xl sticky top-0 z-50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 rounded-2xl shadow-xl shadow-purple-900/40 text-white transform hover:scale-105 transition">
                <Scale className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-400 bg-clip-text text-transparent tracking-tight">
                  AgentEscrowCourt v0.2.18
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" /> GenLayer Steward Compliant AI Escrow Architecture
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-950/60 border border-purple-800/40 rounded-full text-xs font-mono text-purple-300 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>studionet (Chain ID: 61999)</span>
              </div>

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
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 transition flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>

          {/* CONTRACT ADDRESS CONFIGURATION BAR */}
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

        {stepMessage && (
          <div className="max-w-7xl mx-auto px-4 mt-4">
            <div className="p-3 bg-purple-950/80 border border-purple-700/60 rounded-xl text-xs text-purple-200 flex items-center gap-2 font-mono">
              <RefreshCw className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
              <span>{stepMessage}</span>
            </div>
          </div>
        )}

        {/* HERO METRICS */}
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-purple-950/40 border border-purple-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-400" /> Total Tasks
              </p>
              <h3 className="text-2xl font-black text-white mt-2">{tasks.length}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Steward Compliant v0.2.18</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border border-indigo-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" /> Awaiting 24h Payout
              </p>
              <h3 className="text-2xl font-black text-white mt-2">
                {tasks.filter(t => t.status === 'AWAITING_PAYOUT').length}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">24h cooling-off dispute window</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-emerald-950/40 border border-emerald-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Closed & Settled
              </p>
              <h3 className="text-2xl font-black text-white mt-2">
                {tasks.filter(t => t.status === 'CLOSED').length}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Finalized on-chain</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900/90 to-rose-950/40 border border-rose-900/30 rounded-2xl shadow-xl">
              <p className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Disputed / Escalated
              </p>
              <h3 className="text-2xl font-black text-white mt-2">
                {tasks.filter(t => t.status === 'DISPUTED' || t.status === 'ESCALATED').length}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Arbitration protection</p>
            </div>
          </div>

          {/* TAB NAV */}
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

            {/* STATUS FILTER */}
            {activeTab === 'escrows' && (
              <div className="flex items-center gap-1.5 flex-wrap bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 px-2 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>
                {['ALL', 'OPEN', 'IN_PROGRESS', 'AWAITING_PAYOUT', 'NEEDS_REVISION', 'DISPUTED', 'ESCALATED', 'CLOSED'].map(st => (
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
                    Please deploy <code className="text-purple-300 bg-purple-950 px-1.5 py-0.5 rounded">AgentEscrowCourt.py v0.2.18</code> on GenStudio, then paste your contract address in the top bar.
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
                            Task #{task.id}
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
                        <div className="text-xl font-black text-emerald-400 font-mono">
                          {(Number(BigInt(task.amount || 0)) / 1e18).toFixed(2)} GEN
                        </div>
                        <div className="text-xs text-indigo-300 font-mono mt-0.5">
                          15% Stake: {(Number(BigInt(task.worker_stake || 0)) / 1e18).toFixed(2)} GEN
                        </div>
                        <div className="mt-2">
                          <span className="px-3 py-1 bg-purple-950 text-purple-200 border border-purple-700 text-xs rounded-full font-bold">
                            {task.status}
                          </span>
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

                    {/* VERDICT REASON LOG */}
                    {task.verdict_reason && (
                      <div className="p-3 bg-purple-950/30 border border-purple-800/30 rounded-xl text-xs text-purple-200 space-y-1">
                        <span className="font-bold flex items-center gap-1 text-purple-300">
                          <Terminal className="w-3.5 h-3.5" /> AI Jury Trace & Verdict [{task.verdict || 'NONE'}]:
                        </span>
                        <p className="font-mono text-slate-300">{task.verdict_reason}</p>
                      </div>
                    )}

                    {/* STEWARD COMPLIANT ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs font-mono text-slate-400">
                        {task.status === 'AWAITING_PAYOUT' && (
                          <span className="text-indigo-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> 24h Cooling-Off Window Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* ACCEPT TASK (Worker lock 15% stake) */}
                        {task.status === 'OPEN' && account && account !== task.client && (
                          <button
                            onClick={() => handleAcceptTask(task)}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                          >
                            <DollarSign className="w-4 h-4" /> Claim Task (Stake 15%)
                          </button>
                        )}

                        {/* SUBMIT WORK */}
                        {(task.status === 'IN_PROGRESS' || task.status === 'NEEDS_REVISION') && account && account === task.worker && (
                          <button
                            onClick={() => setSubmitTaskTargetId(task.id)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                          >
                            <FileCheck className="w-4 h-4" /> Submit Deliverable & Trigger AI Jury
                          </button>
                        )}

                        {/* RAISE DISPUTE (during 24h cooling off) */}
                        {task.status === 'AWAITING_PAYOUT' && account && (account === task.client || account === task.worker) && (
                          <button
                            onClick={() => setDisputeTargetId(task.id)}
                            className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-100 text-xs font-bold rounded-xl transition flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Raise Dispute
                          </button>
                        )}

                        {/* FINALIZE PAYOUT (after 24h cooling off) */}
                        {task.status === 'AWAITING_PAYOUT' && (
                          <button
                            onClick={() => handleFinalizePayout(task.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Finalize Payout (Disburse Funds)
                          </button>
                        )}

                        {/* RECOVER STUCK FUNDS */}
                        {(task.status === 'OPEN' || task.status === 'IN_PROGRESS' || task.status === 'NEEDS_REVISION') && account && account === task.client && (
                          <button
                            onClick={() => handleRecoverStuckFunds(task.id)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                          >
                            Recover Stuck Funds
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SUBMIT WORK FORM MODAL */}
                    {submitTaskTargetId === task.id && (
                      <div className="mt-4 p-4 bg-slate-950 border border-purple-900/50 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          <FileCheck className="w-4 h-4" /> Submit Deliverable for Task #{task.id}
                        </h4>
                        <input
                          type="url"
                          placeholder="https://raw.githubusercontent.com/.../report.md"
                          value={deliverableUrlInput}
                          onChange={(e) => setDeliverableUrlInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-purple-900/60 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
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
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg"
                          >
                            Submit & Trigger AI Evaluation
                          </button>
                        </div>
                      </div>
                    )}

                    {/* RAISE DISPUTE FORM MODAL */}
                    {disputeTargetId === task.id && (
                      <div className="mt-4 p-4 bg-slate-950 border border-rose-900/50 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Raise Dispute for Task #{task.id}
                        </h4>
                        <input
                          type="text"
                          placeholder="Reason for dispute..."
                          value={disputeReasonInput}
                          onChange={(e) => setDisputeReasonInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-rose-900/60 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setDisputeTargetId(null)}
                            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRaiseDispute(task.id)}
                            disabled={loading}
                            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg"
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

          {/* TAB 2: CREATE ESCROW FORM */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto p-6 bg-slate-900/90 border border-purple-900/40 rounded-2xl shadow-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-purple-400" /> Create New AI Escrow Task (v0.2.18)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Deposit GEN tokens locked safely in an Intelligent Contract. Workers must lock a 15% collateral stake to claim.
                </p>
              </div>

              <form onSubmit={handleCreateEscrow} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Task Unique ID</label>
                    <input
                      type="text"
                      placeholder="e.g. task_001 (or auto-generated)"
                      value={taskIdInput}
                      onChange={(e) => setTaskIdInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Escrow Reward Amount (GEN)</label>
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
                  <label className="block text-slate-300 font-semibold mb-1">Criteria Spec URL (Full HTTP/HTTPS requirement spec)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://raw.githubusercontent.com/.../requirements.txt"
                    value={criteriaUrl}
                    onChange={(e) => setCriteriaUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Deadline (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deadlineHours}
                    onChange={(e) => setDeadlineHours(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-purple-900/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-xl shadow-purple-900/40 transition flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{loading ? 'Submitting Transaction to Studionet...' : 'Create Escrow & Deposit GEN'}</span>
                </button>
              </form>
            </div>
          )}
        </section>

        {/* FAQ */}
        <section className="max-w-7xl mx-auto px-4 py-8 border-t border-purple-900/30">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-purple-400" /> GenLayer Steward Review Architecture Rules
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
          <span className="font-bold text-slate-300">AgentEscrowCourt v0.2.18</span>
          <span>•</span>
          <span>GenLayer Studionet (Chain ID 61999)</span>
        </div>
        <p className="text-[11px] text-slate-400">
          GenLayer Steward Compliant Architecture: 24h Cooling Off • Untruncated Web Renders • 15% Collateral Staking
        </p>
      </footer>
    </div>
  );
}
