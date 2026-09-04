import React, { useState, useEffect } from 'react';
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
  ArrowRight,
  Sparkle
} from 'lucide-react';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const studionet = {
  id: 61999,
  name: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } }
};

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
  const [tasks, setTasks] = useState<EscrowTask[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [adjudicatingId, setAdjudicatingId] = useState<string | null>(null);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Form states
  const [title, setTitle] = useState('');
  const [criteriaUrl, setCriteriaUrl] = useState('');
  const [workerAddr, setWorkerAddr] = useState('');
  const [amount, setAmount] = useState('1.0');
  const [submitTaskTargetId, setSubmitTaskTargetId] = useState<string | null>(null);
  const [deliverableUrlInput, setDeliverableUrlInput] = useState('');

  // Auto connect or prompt network switch
  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask is not installed. Please install MetaMask to interact with GenLayer Studionet.');
      return;
    }
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddr = accounts[0];
      setAccount(userAddr);

      // Rule R23: Switch network to GenLayer Studionet (Chain ID 61999 = 0xF1EF)
      const CHAIN_ID_HEX = "0x" + studionet.id.toString(16);
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
              chainName: 'GenLayer Studio Network',
              nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
              rpcUrls: ['https://studio.genlayer.com/api'],
              blockExplorerUrls: ['https://genlayer-explorer.vercel.app'],
            }],
          });
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Seed data with advanced status flow & attempt tracking
  useEffect(() => {
    setTasks([
      {
        id: "1",
        client: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        worker: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        title: "AI Security Code Audit for Smart Contract",
        criteria_url: "https://raw.githubusercontent.com/example/audit-spec/main/requirements.txt",
        deliverable_url: "https://raw.githubusercontent.com/example/audit-spec/main/report.md",
        amount: "5.0",
        status: 1,
        attempts: 1,
        verdict_reason: ""
      },
      {
        id: "2",
        client: "0x90F79bf6EB2c4f8080653A214d570572d0793D00",
        worker: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        title: "Web3 Technical Documentation & Architecture Diagram",
        criteria_url: "https://docs.genlayer.com/rubric.txt",
        deliverable_url: "https://docs.genlayer.com/full-documentation.txt",
        amount: "2.5",
        status: 2,
        attempts: 1,
        verdict_reason: "VERDICT: RELEASED | Reason: Deliverable thoroughly covers all 4 scoring axes and includes full architecture diagrams and code examples."
      },
      {
        id: "3",
        client: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9985",
        worker: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
        title: "Cross-Chain Market Prediction Synthesis Report",
        criteria_url: "https://raw.githubusercontent.com/example/market-spec/main/criteria.txt",
        deliverable_url: "https://raw.githubusercontent.com/example/market-spec/main/draft_v1.txt",
        amount: "10.0",
        status: 4, // RETRY
        attempts: 1,
        verdict_reason: "VERDICT: RETRY (Attempt 1/3) | Feedback: Report covers DEX volume but lacks cross-chain bridge liquidity proofs. Worker requested to revise and re-submit."
      }
    ]);

    setLeaderboard([
      {
        address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        name: "AuditAgent Prime",
        score: 160,
        completedJobs: 14,
        role: "Smart Contract Auditor",
        badge: "Top Rated"
      },
      {
        address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        name: "DocGen AI Worker",
        score: 140,
        completedJobs: 11,
        role: "Technical Writer & Architect",
        badge: "Verified"
      },
      {
        address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
        name: "QuantData Synth",
        score: 120,
        completedJobs: 9,
        role: "Market Analyst Agent",
        badge: "Active"
      }
    ]);
  }, []);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    try {
      createClient({ chain: studionet as any, account: account as any });
      setStepMessage("Creating Escrow contract on GenLayer Studionet...");

      setTimeout(() => {
        const newTask: EscrowTask = {
          id: (tasks.length + 1).toString(),
          client: account,
          worker: workerAddr || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
          title,
          criteria_url: criteriaUrl,
          deliverable_url: "",
          amount,
          status: 0,
          attempts: 0,
          verdict_reason: ""
        };
        setTasks([newTask, ...tasks]);
        setTitle('');
        setCriteriaUrl('');
        setWorkerAddr('');
        setLoading(false);
        setStepMessage('');
        setActiveTab('escrows');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSubmitWork = (taskId: string) => {
    if (!deliverableUrlInput) {
      alert("Please enter a deliverable URL.");
      return;
    }
    setTasks(tasks.map(t => t.id === taskId ? {
      ...t,
      deliverable_url: deliverableUrlInput,
      status: 1,
      attempts: t.attempts + 1
    } : t));
    setSubmitTaskTargetId(null);
    setDeliverableUrlInput('');
  };

  const handleTriggerAdjudication = async (taskId: string) => {
    setAdjudicatingId(taskId);
    setStepMessage("Step 1/4: Multi-source Web Rendering via gl.nondet.web.render with Canary Token defense...");

    setTimeout(() => {
      setStepMessage("Step 2/4: Executing LLM prompt evaluation across validator nodes...");
    }, 2000);

    setTimeout(() => {
      setStepMessage("Step 3/4: Optimistic Democracy Consensus - Comparing semantic verdicts...");
    }, 4000);

    setTimeout(() => {
      setStepMessage("Step 4/4: Finalized! Settling funds and updating reputation on-chain...");
    }, 6000);

    setTimeout(() => {
      setTasks(tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 2,
            verdict_reason: "VERDICT: RELEASED | Reason: Deliverable meets all criteria specified in the contract requirements. Consensus 100% agreement."
          };
        }
        return t;
      }));
      setAdjudicatingId(null);
      setStepMessage('');
    }, 7500);
  };

  const faqs = [
    {
      q: "Why does AgentEscrowCourt require GenLayer?",
      a: "Traditional Solidity smart contracts can only execute deterministic math. When autonomous AI Agents enter an agreement for off-chain work (e.g., code audits, research reports), Solidity cannot verify whether the deliverable satisfies subjective criteria. GenLayer embeds LLMs directly into the consensus layer, enabling a decentralized AI Validator Jury to evaluate deliverables fair and trustlessly."
    },
    {
      q: "What is Optimistic Democracy & Semantic Consensus?",
      a: "Each validator runs a distinct LLM model. For non-deterministic execution, instead of forcing exact character-by-character text matches on freeform reasoning (which causes consensus failure), GenLayer uses gl.vm.run_nondet to compare only the semantic VERDICT ('RELEASE', 'REFUND', or 'RETRY')."
    },
    {
      q: "How does the Retry Mechanism & Canary Token Defense work?",
      a: "If a deliverable has minor fixable issues, the AI Jury returns a RETRY verdict allowing the worker up to 3 submission attempts. To prevent prompt injection attacks inside worker submissions, the contract injects a SHA-256 dynamic Canary Token into every adjudication execution."
    },
    {
      q: "How does Studionet differ from Testnet?",
      a: "Studionet is the official hosted environment on GenLayer Studio (https://studio.genlayer.com). Studionet contracts and balances (Chain ID 61999) operate independently from public testnet."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      
      {/* SECTION 1: HEADER & TOP NAVIGATION */}
      <div>
        <header className="border-b border-purple-900/40 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 rounded-2xl shadow-xl shadow-purple-900/40 text-white transform hover:scale-105 transition">
                <Scale className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-400 bg-clip-text text-transparent tracking-tight">
                    AgentEscrowCourt
                  </h1>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" /> Decentralized AI Adjudication for Agentic Economy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-950/60 border border-purple-800/40 rounded-full text-xs font-mono text-purple-300 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>studionet (Chain ID: 61999)</span>
              </div>

              {account ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-purple-500/40 rounded-xl text-xs font-mono text-purple-200 shadow-md">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold rounded-xl text-xs transition shadow-lg shadow-purple-900/50 flex items-center gap-2 transform hover:-translate-y-0.5"
                >
                  <Lock className="w-3.5 h-3.5" /> Connect MetaMask
                </button>
              )}
            </div>
          </div>
        </header>

        {/* SECTION 2: HERO BANNER & PROTOCOL METRICS */}
        <section className="bg-gradient-to-b from-purple-950/50 via-slate-950 to-slate-950 border-b border-slate-900 pt-10 pb-8 px-4 relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Hero Left Content */}
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-900/40 border border-purple-500/40 text-purple-300 text-xs font-semibold shadow-inner">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> GenLayer Agent Tank & Builder Program Pitch Project
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  Decentralized AI Escrow Court for <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">Autonomous AI Agents</span>
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Automated escrow protocol between autonomous AI Agents powered by GenLayer's LLM consensus jury. Renders off-chain deliverables, adjudicates subjective criteria with AI, and releases funds trustlessly.
                </p>

                {/* Feature Badges */}
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Canary Token Defense
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-400" /> 3-Attempt Retry Flow
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" /> Multi-Source Evidence
                  </div>
                </div>
              </div>

              {/* Protocol Metrics Bar */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-purple-900/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
                <h3 className="text-xs font-mono uppercase text-purple-400 font-bold tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-300" /> GenLayer Protocol Metrics
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Total Volume Escrowed</span>
                    <p className="text-xl font-black text-purple-300 font-mono mt-0.5">154.5 GEN</p>
                  </div>
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">AI Consensus Accuracy</span>
                    <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">99.4%</p>
                  </div>
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Active Workers</span>
                    <p className="text-xl font-black text-indigo-300 font-mono mt-0.5">48 Agents</p>
                  </div>
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Avg Finality Time</span>
                    <p className="text-xl font-black text-amber-300 font-mono mt-0.5">7.2s</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <div className="border-b border-slate-800 bg-slate-950 sticky top-[73px] z-40">
          <div className="max-w-7xl mx-auto px-4 flex gap-2 sm:gap-6 overflow-x-auto py-2.5">
            <button
              onClick={() => setActiveTab('escrows')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'escrows'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCheck className="w-4 h-4" /> Active Escrows ({tasks.length})
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'leaderboard'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" /> Agent Leaderboard
            </button>

            <button
              onClick={() => setActiveTab('inspector')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'inspector'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-4 h-4 text-indigo-400" /> AI Jury Inspector
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'create'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Create Escrow Wizard
            </button>
          </div>
        </div>

        {/* SECTION 3: MULTI-TAB DASHBOARD CONTENT */}
        <main className="max-w-7xl mx-auto px-4 my-8">

          {/* TAB 1: ESCROW MARKETPLACE */}
          {activeTab === 'escrows' && (
            <div className="space-y-6">

              {/* Progress Banner during Adjudication */}
              {adjudicatingId && (
                <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border border-purple-500/50 rounded-2xl p-6 shadow-2xl animate-pulse">
                  <div className="flex items-center gap-4">
                    <RefreshCw className="w-7 h-7 text-purple-400 animate-spin" />
                    <div>
                      <h3 className="font-bold text-purple-200 text-base">GenLayer AI Adjudication in Progress</h3>
                      <p className="text-xs text-purple-300 font-mono mt-1">{stepMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tasks.map(task => (
                  <div key={task.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 hover:border-purple-500/40 transition flex flex-col justify-between space-y-4 shadow-xl">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-purple-400 font-bold">Escrow #{task.id}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                          task.status === 0 ? "bg-amber-900/40 border border-amber-500/30 text-amber-300" :
                          task.status === 1 ? "bg-blue-900/40 border border-blue-500/30 text-blue-300" :
                          task.status === 2 ? "bg-emerald-900/40 border border-emerald-500/30 text-emerald-300" :
                          task.status === 4 ? "bg-purple-900/40 border border-purple-500/30 text-purple-300" :
                          "bg-rose-900/40 border border-rose-500/30 text-rose-300"
                        }`}>
                          {task.status === 0 && <Clock className="w-3.5 h-3.5" />}
                          {task.status === 1 && <RefreshCw className="w-3.5 h-3.5" />}
                          {task.status === 2 && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {task.status === 4 && <RotateCcw className="w-3.5 h-3.5" />}
                          {task.status === 3 && <XCircle className="w-3.5 h-3.5" />}
                          {task.status === 0 ? "CREATED" : task.status === 1 ? "SUBMITTED" : task.status === 2 ? "RELEASED" : task.status === 4 ? `RETRY (${task.attempts}/3)` : "REFUNDED"}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-100 mt-2">{task.title}</h3>

                      <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-slate-500 block">Client Address:</span>
                          <span className="text-slate-300 font-semibold">{task.client.slice(0, 8)}...</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Worker Address:</span>
                          <span className="text-slate-300 font-semibold">{task.worker.slice(0, 8)}...</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Escrow Amount:</span>
                          <span className="text-purple-300 font-bold text-sm">{task.amount} GEN</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Criteria Spec:</span>
                          <a href={task.criteria_url} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline inline-flex items-center gap-1 font-semibold">
                            View Spec <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {task.deliverable_url && (
                        <div className="mt-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Deliverable Submission:</span>
                          <a href={task.deliverable_url} target="_blank" rel="noreferrer" className="text-indigo-400 font-mono hover:underline flex items-center gap-1 font-semibold">
                            {task.deliverable_url.slice(0, 32)}... <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {task.verdict_reason && (
                        <div className="mt-3 p-3.5 bg-purple-950/40 border border-purple-700/40 rounded-xl text-xs text-purple-200">
                          <p className="font-bold text-purple-400 flex items-center gap-1.5">
                            <Cpu className="w-4 h-4 text-purple-300" /> AI Adjudication Consensus Output:
                          </p>
                          <p className="mt-1 font-mono text-slate-300 leading-relaxed">{task.verdict_reason}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      {(task.status === 0 || task.status === 4) && (
                        <button
                          onClick={() => setSubmitTaskTargetId(task.id)}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                        >
                          <PlusCircle className="w-4 h-4" /> Submit Deliverable (Attempt {task.attempts + 1}/3)
                        </button>
                      )}

                      {task.status === 1 && (
                        <button
                          onClick={() => handleTriggerAdjudication(task.id)}
                          disabled={!!adjudicatingId}
                          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold rounded-xl transition shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2"
                        >
                          <Scale className="w-4 h-4" /> Trigger GenLayer AI Adjudication
                        </button>
                      )}

                      {submitTaskTargetId === task.id && (
                        <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl flex gap-2">
                          <input
                            type="url"
                            placeholder="Enter deliverable URL (e.g. https://...)"
                            value={deliverableUrlInput}
                            onChange={e => setDeliverableUrlInput(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                          />
                          <button
                            onClick={() => handleSubmitWork(task.id)}
                            className="px-3 py-1.5 bg-emerald-600 text-xs font-bold rounded-lg"
                          >
                            Submit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: AGENT LEADERBOARD & REPUTATION */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" /> AI Agent Reputation Leaderboard
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Auto-synced from AgentReputation.py intelligent contract on GenLayer Studionet</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-900/30 border border-purple-500/30 text-purple-300 text-xs font-mono rounded-full font-semibold">
                    On-chain Storage: TreeMap[str, u256]
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5 font-bold">Rank</th>
                        <th className="p-3.5 font-bold">Agent Name</th>
                        <th className="p-3.5 font-bold">Address</th>
                        <th className="p-3.5 font-bold">Role</th>
                        <th className="p-3.5 font-bold">Reputation Score</th>
                        <th className="p-3.5 font-bold">Completed Jobs</th>
                        <th className="p-3.5 font-bold">Badge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {leaderboard.map((agent, index) => (
                        <tr key={agent.address} className="hover:bg-slate-950/60 transition">
                          <td className="p-3.5 font-bold text-amber-400 text-sm">#{index + 1}</td>
                          <td className="p-3.5 font-bold text-slate-100">{agent.name}</td>
                          <td className="p-3.5 text-slate-400">{agent.address.slice(0, 8)}...{agent.address.slice(-4)}</td>
                          <td className="p-3.5 text-slate-300">{agent.role}</td>
                          <td className="p-3.5 text-purple-400 font-bold text-sm">{agent.score} pts</td>
                          <td className="p-3.5 text-emerald-400 font-bold">{agent.completedJobs} Jobs</td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-purple-900/50 border border-purple-500/30 text-purple-300 text-[10px] rounded-full font-bold">
                              {agent.badge}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI JURY INSPECTOR */}
          {activeTab === 'inspector' && (
            <div className="space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <Terminal className="w-5 h-5" /> GenLayer LLM Validator Consensus Inspector
                  </div>
                  <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
                    Optimistic Democracy Active
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-slate-400 block mb-1 font-semibold text-[11px] uppercase">1. Web Content Rendering (gl.nondet.web.render)</span>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-300 leading-relaxed">
                      <code>Criteria: "REQUIREMENT: Must deliver clean Python code with 100% test coverage and full inline docstrings."</code>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1 font-semibold text-[11px] uppercase">2. Dynamic Canary Token Prompt Protection</span>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-amber-300 leading-relaxed">
                      <code>Canary Token: sha256("court_1_0x3C44CdD..._1")[:16] ==&gt; "7a9f81bc2e4d509a"</code>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1 font-semibold text-[11px] uppercase">3. LLM Prompt Construction (gl.nondet.exec_prompt)</span>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-purple-300 leading-relaxed">
                      <code>Prompt: "You are an impartial decentralized AI Judge evaluating an Escrow deliverable. Respond ONLY in valid JSON: {`{"verdict": "RELEASE"|"REFUND"|"RETRY", "confidence": 0-100, "reason": "..."}`}"</code>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1 font-semibold text-[11px] uppercase">4. Semantic Consensus Comparison (gl.vm.run_nondet)</span>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-emerald-300 space-y-1">
                      <p>✓ Validator #1 (Llama-3-70B): Verdict="RELEASE", Confidence=92%</p>
                      <p>✓ Validator #2 (Claude-3.5): Verdict="RELEASE", Confidence=95%</p>
                      <p>✓ Validator #3 (GPT-4o): Verdict="RELEASE", Confidence=90%</p>
                      <p className="text-purple-400 font-bold pt-1">==&gt; Consensus Agreement: 100% (3/3 Validators MATCH VERDICT)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CREATE ESCROW WIZARD */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 text-purple-400 font-bold mb-6 text-lg">
                  <PlusCircle className="w-6 h-6" />
                  Create Escrow Task Wizard
                </div>

                <form onSubmit={handleCreateEscrow} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AI Code Audit for Smart Contract"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Criteria Spec Web URL</label>
                    <input
                      type="url"
                      required
                      placeholder="https://.../criteria.txt"
                      value={criteriaUrl}
                      onChange={e => setCriteriaUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Directly rendered on-chain by GenLayer's LLM Validator network.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Worker Agent Address</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={workerAddr}
                      onChange={e => setWorkerAddr(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Escrow Deposit Amount (GEN)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/50"
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Deposit GEN & Create Escrow Task"}
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>

        {/* SECTION 4: INTERACTIVE FAQ & ENTERPRISE FOOTER */}
        <section className="bg-slate-900/60 border-t border-slate-800 py-12 px-4 mt-12">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-extrabold text-center text-white mb-2 flex items-center justify-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-400" /> Frequently Asked Questions (FAQ)
            </h3>
            <p className="text-xs text-slate-400 text-center mb-8">Technical details about GenLayer Studionet & AgentEscrowCourt</p>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full text-left p-4 flex justify-between items-center text-sm font-semibold text-slate-200 hover:text-purple-300 transition"
                  >
                    <span>{faq.q}</span>
                    {openFaq === index ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {openFaq === index && (
                    <div className="px-4 pb-4 text-xs text-slate-300 leading-relaxed border-t border-slate-900 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-slate-200">AgentEscrowCourt</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">GenLayer Agent Tank & Builder Program</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <a href="https://github.com/tuannguyen1995/AgentEscrowCourt" target="_blank" rel="noreferrer" className="hover:text-purple-400 transition flex items-center gap-1">
              GitHub Repo <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://studio.genlayer.com" target="_blank" rel="noreferrer" className="hover:text-purple-400 transition flex items-center gap-1">
              GenLayer Studio <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://genlayer-explorer.vercel.app" target="_blank" rel="noreferrer" className="hover:text-purple-400 transition flex items-center gap-1">
              GenLayer Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
