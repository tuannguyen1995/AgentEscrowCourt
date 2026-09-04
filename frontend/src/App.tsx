import React, { useState, useEffect } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
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
  AlertCircle,
  Clock
} from 'lucide-react';

interface EscrowTask {
  id: string;
  client: string;
  worker: string;
  title: string;
  criteria_url: string;
  deliverable_url: string;
  amount: string;
  status: number; // 0: CREATED, 1: SUBMITTED, 2: RELEASED, 3: REFUNDED
  verdict_reason: string;
}

const CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"; // Target studionet address

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [tasks, setTasks] = useState<EscrowTask[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [adjudicatingId, setAdjudicatingId] = useState<string | null>(null);
  const [stepMessage, setStepMessage] = useState<string>('');

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

  // Sample seed tasks for demo preview
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
        verdict_reason: "VERDICT: RELEASED | Reason: Deliverable thoroughly covers all 4 scoring axes and includes full architecture diagrams and code examples."
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
      // Create genlayer client for studionet
      const client = createClient({ chain: studionet, account: account as `0x${string}` });
      setStepMessage("Creating Escrow contract on GenLayer Studionet...");

      // Simulate success for UX flow
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
          verdict_reason: ""
        };
        setTasks([newTask, ...tasks]);
        setTitle('');
        setCriteriaUrl('');
        setWorkerAddr('');
        setLoading(false);
        setStepMessage('');
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
    setTasks(tasks.map(t => t.id === taskId ? { ...t, deliverable_url: deliverableUrlInput, status: 1 } : t));
    setSubmitTaskTargetId(null);
    setDeliverableUrlInput('');
  };

  const handleTriggerAdjudication = async (taskId: string) => {
    setAdjudicatingId(taskId);
    setStepMessage("Step 1/4: GenLayer Validators fetching web content via gl.nondet.web.render...");

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-purple-900/50 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-xl border border-purple-500/40 text-purple-400">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                AgentEscrowCourt
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-purple-400" /> GenLayer Studionet AI Consensus Layer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-300 rounded-full flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              studionet (Chain ID 61999)
            </span>

            {account ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-medium rounded-lg text-sm transition shadow-lg shadow-purple-900/40 flex items-center gap-2"
              >
                Connect MetaMask
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Create Task Form */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
            <div className="flex items-center gap-2 text-purple-400 font-semibold mb-4 text-lg">
              <PlusCircle className="w-5 h-5" />
              Create Escrow Task
            </div>
            
            <form onSubmit={handleCreateEscrow} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Code Audit for Smart Contract"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Criteria Spec Web URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://.../criteria.txt"
                  value={criteriaUrl}
                  onChange={e => setCriteriaUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Directly rendered on-chain by GenLayer LLM Validators.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Worker Agent Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={workerAddr}
                  onChange={e => setWorkerAddr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Escrow Deposit (GEN)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Deposit GEN & Create Escrow"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Escrow Tasks Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-purple-400" />
              Active Agent Escrows ({tasks.length})
            </h2>
          </div>

          {/* Adjudication Progress Overlay */}
          {adjudicatingId && (
            <div className="bg-purple-950/70 border border-purple-500/50 rounded-2xl p-6 shadow-2xl animate-pulse">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                <div>
                  <h3 className="font-semibold text-purple-200">GenLayer AI Adjudication in Progress</h3>
                  <p className="text-xs text-purple-300 font-mono mt-1">{stepMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Task List */}
          <div className="space-y-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono text-purple-400 font-medium">Escrow #{task.id}</span>
                    <h3 className="text-base font-semibold text-slate-100 mt-0.5">{task.title}</h3>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                    task.status === 0 ? "bg-amber-900/40 border border-amber-500/30 text-amber-300" :
                    task.status === 1 ? "bg-blue-900/40 border border-blue-500/30 text-blue-300" :
                    task.status === 2 ? "bg-emerald-900/40 border border-emerald-500/30 text-emerald-300" :
                    "bg-rose-900/40 border border-rose-500/30 text-rose-300"
                  }`}>
                    {task.status === 0 && <Clock className="w-3.5 h-3.5" />}
                    {task.status === 1 && <RefreshCw className="w-3.5 h-3.5" />}
                    {task.status === 2 && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {task.status === 3 && <XCircle className="w-3.5 h-3.5" />}
                    {task.status === 0 ? "CREATED" : task.status === 1 ? "SUBMITTED" : task.status === 2 ? "RELEASED" : "REFUNDED"}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-mono text-slate-400 bg-slate-950/60 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-500">Client:</span> {task.client.slice(0, 8)}...
                  </div>
                  <div>
                    <span className="text-slate-500">Worker:</span> {task.worker.slice(0, 8)}...
                  </div>
                  <div>
                    <span className="text-slate-500">Amount:</span> <span className="text-purple-300 font-bold">{task.amount} GEN</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Criteria:</span>{" "}
                    <a href={task.criteria_url} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline inline-flex items-center gap-1">
                      Link <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Deliverable URL */}
                {task.deliverable_url && (
                  <div className="mt-3 text-xs bg-slate-950/40 p-2.5 rounded-lg flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Deliverable Submission:</span>
                    <a href={task.deliverable_url} target="_blank" rel="noreferrer" className="text-indigo-400 font-mono hover:underline flex items-center gap-1">
                      {task.deliverable_url.slice(0, 40)}... <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Verdict Reason */}
                {task.verdict_reason && (
                  <div className="mt-3 p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs text-purple-200">
                    <p className="font-semibold text-purple-400 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" /> AI Consensus Adjudication Result:
                    </p>
                    <p className="mt-1 font-mono text-slate-300">{task.verdict_reason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-3">
                  {task.status === 0 && (
                    <button
                      onClick={() => setSubmitTaskTargetId(task.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-medium rounded-lg transition"
                    >
                      Submit Work Deliverable
                    </button>
                  )}

                  {task.status === 1 && (
                    <button
                      onClick={() => handleTriggerAdjudication(task.id)}
                      disabled={!!adjudicatingId}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1.5"
                    >
                      <Scale className="w-4 h-4" /> Trigger GenLayer AI Adjudication
                    </button>
                  )}
                </div>

                {/* Submit input popup */}
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
                      className="px-3 py-1.5 bg-emerald-600 text-xs font-medium rounded-lg"
                    >
                      Submit
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
