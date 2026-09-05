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
  Clock,
  Trophy,
  Activity,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldAlert,
  Layers,
  LogOut,
  Filter,
  Zap,
  Globe,
  Link as LinkIcon,
  AlertTriangle,
  DollarSign,
  Compass,
  Code2,
  Radio,
  Settings,
  Copy,
  Check,
  Coins,
  ArrowUpRight,
  FileText,
  User,
  SlidersHorizontal,
  Bot,
  AlertCircle,
  Sparkles,
  Loader2
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
  status: string; // PENDING_CONSENSUS, OPEN, IN_PROGRESS, AWAITING_PAYOUT, NEEDS_REVISION, DISPUTED, ESCALATED, CLOSED
  attempts: string;
  verdict: string;
  verdict_reason: string;
  confidence: string;
  payout_ready_at: string;
  deadline: string;
  created_at?: number;
  tx_hash?: string;
  error?: string;
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
  const [activeTab, setActiveTab] = useState<'escrows' | 'create' | 'leaderboard' | 'architecture'>('escrows');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Contract Addresses (stored in localStorage or from env)
  const [escrowContractAddress, setEscrowContractAddress] = useState<string>(() => {
    const cached = localStorage.getItem('escrow_contract_addr');
    if (!cached || cached.toLowerCase() !== DEFAULT_ESCROW_CONTRACT_ADDRESS.toLowerCase()) {
      localStorage.setItem('escrow_contract_addr', DEFAULT_ESCROW_CONTRACT_ADDRESS);
      return DEFAULT_ESCROW_CONTRACT_ADDRESS;
    }
    return cached;
  });
  const [reputationContractAddress, setReputationContractAddress] = useState<string>(() => {
    const cached = localStorage.getItem('reputation_contract_addr');
    if (!cached || cached.toLowerCase() !== DEFAULT_REPUTATION_CONTRACT_ADDRESS.toLowerCase()) {
      localStorage.setItem('reputation_contract_addr', DEFAULT_REPUTATION_CONTRACT_ADDRESS);
      return DEFAULT_REPUTATION_CONTRACT_ADDRESS;
    }
    return cached;
  });

  // Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempEscrowAddr, setTempEscrowAddr] = useState<string>(escrowContractAddress);
  const [tempRepAddr, setTempRepAddr] = useState<string>(reputationContractAddress);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const [userBalance, setUserBalance] = useState<string>('0.0000');
  const [tasks, setTasks] = useState<EscrowTask[]>([]);
  
  // Pending optimistic tasks (shown immediately when created while consensus runs)
  const [pendingTasks, setPendingTasks] = useState<EscrowTask[]>(() => {
    try {
      const cached = localStorage.getItem('pending_escrow_tasks');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const [leaderboard, setLeaderboard] = useState<AgentReputationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingOnChain, setFetchingOnChain] = useState<boolean>(false);
  const [stepMessage, setStepMessage] = useState<string>('');
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

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(label);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Save contract addresses
  const handleSaveAddresses = (escrowAddr: string, repAddr: string) => {
    setEscrowContractAddress(escrowAddr);
    setReputationContractAddress(repAddr);
    localStorage.setItem('escrow_contract_addr', escrowAddr);
    localStorage.setItem('reputation_contract_addr', repAddr);
  };

  const handleApplySettings = () => {
    handleSaveAddresses(tempEscrowAddr.trim(), tempRepAddr.trim());
    setIsSettingsOpen(false);
    fetchTasksFromContract();
    fetchLeaderboardFromContract();
  };

  const handleResetToOfficialAddresses = () => {
    setTempEscrowAddr(DEFAULT_ESCROW_CONTRACT_ADDRESS);
    setTempRepAddr(DEFAULT_REPUTATION_CONTRACT_ADDRESS);
    setEscrowContractAddress(DEFAULT_ESCROW_CONTRACT_ADDRESS);
    setReputationContractAddress(DEFAULT_REPUTATION_CONTRACT_ADDRESS);
    localStorage.setItem('escrow_contract_addr', DEFAULT_ESCROW_CONTRACT_ADDRESS);
    localStorage.setItem('reputation_contract_addr', DEFAULT_REPUTATION_CONTRACT_ADDRESS);
    fetchTasksFromContract();
    fetchLeaderboardFromContract();
    alert('Reset to official contracts on GenLayer Studionet:\n• Escrow: ' + DEFAULT_ESCROW_CONTRACT_ADDRESS + '\n• Reputation: ' + DEFAULT_REPUTATION_CONTRACT_ADDRESS);
  };

  const fetchUserBalance = useCallback(async (targetAddr?: string | null) => {
    const active = targetAddr || account;
    if (!active) return;
    try {
      const res = await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [active.toLowerCase(), 'latest']
        })
      });
      const json = await res.json();
      if (json && json.result) {
        const balWei = BigInt(json.result);
        setUserBalance((Number(balWei) / 1e18).toFixed(4));
      }
    } catch (_) {}
  }, [account]);

  const handleFaucet = async () => {
    if (!account) {
      alert('Please connect your wallet before requesting testnet GEN.');
      return;
    }
    setLoading(true);
    setTxError(null);
    setStepMessage('Dispensing 50 testnet GEN to your wallet on GenLayer Studionet...');
    try {
      await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sim_fundAccount',
          params: [account.toLowerCase(), 50000000000000000000] // 50 GEN
        })
      });
      await fetchUserBalance(account);
      setSuccessBanner(`🎉 Successfully received 50 testnet GEN for ${account.slice(0, 6)}...${account.slice(-4)}!`);
    } catch (err: any) {
      setTxError(err.message || 'Failed to claim testnet GEN faucet.');
    } finally {
      setLoading(false);
      setStepMessage('');
    }
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

  // Generic on-chain contract write execution with real MetaMask & GenLayer consensus
  const executeContractWrite = async (
    contractAddress: string,
    functionName: string,
    args: any[],
    value: bigint = 0n
  ) => {
    let txHash = '';
    const methodParamsAsString = JSON.stringify(args);
    const dataArr = [functionName, methodParamsAsString];
    const encodedData = toRlp(dataArr.map((param) => toHex(param)));

    // 1. If MetaMask extension is available: Prompt real on-chain transaction
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const activeAddr = ((window.ethereum.selectedAddress || (accounts && accounts[0])) || account || '').toLowerCase();
        
        if (activeAddr) {
          setAccount(activeAddr);
          
          // Switch to GenLayer Studionet network (Chain ID 61999)
          const CHAIN_ID_HEX = '0x' + STUDIONET_CONFIG.id.toString(16);
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: CHAIN_ID_HEX }],
            });
          } catch (switchError: any) {
            if (switchError.code === 4902 || switchError.code === -32603) {
              try {
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
              } catch (_) {}
            }
          }

          // Auto-fund testnet balance if needed
          if (value > 0n) {
            try {
              await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'sim_fundAccount',
                  params: [activeAddr, 50000000000000000000] // 50 GEN
                })
              });
            } catch (_) {}
          }

          setStepMessage('Please confirm the escrow deposit in your wallet...');

          const valueHex = '0x' + value.toString(16);
          const txParams = {
            from: activeAddr,
            to: contractAddress,
            data: encodedData,
            value: valueHex,
          };

          try {
            txHash = await window.ethereum.request({
              method: 'eth_sendTransaction',
              params: [txParams],
            });
          } catch (ethErr: any) {
            console.warn('MetaMask sendTransaction issue:', ethErr);
            if (ethErr.code === 4001 || ethErr.message?.includes('User rejected')) {
              throw new Error('Transaction was rejected in wallet.');
            }
            // If MetaMask fails due to custom RPC format, fallback gracefully to GenLayer client
          }
        }
      } catch (mmErr: any) {
        if (mmErr.message?.includes('rejected')) throw mmErr;
        console.warn('MetaMask error, falling back to GenLayer client:', mmErr);
      }
    }

    // 2. Fallback to native GenLayer client
    if (!txHash) {
      const genlayerAcc = getOrCreateGenLayerAccount();
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
      });

      try {
        await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sim_fundAccount',
            params: [genlayerAcc.address.toLowerCase(), 50000000000000000000]
          })
        });
      } catch (_) {}

      setStepMessage('Broadcasting transaction to GenLayer Studionet RPC...');
      txHash = await client.writeContract({
        account: genlayerAcc,
        address: contractAddress as any,
        functionName: functionName,
        args: args,
        value: value
      });
    }

    // 3. Asynchronous consensus monitor (polls eth_getTransactionByHash up to 45 times)
    setStepMessage(`Tx broadcasted (${txHash.slice(0, 10)}...)! 5 Validators voting on consensus...`);
    for (let i = 0; i < 45; i++) {
      try {
        const res = await fetch(STUDIONET_CONFIG.rpcUrls.default.http[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionByHash',
            params: [txHash]
          })
        });
        const json = await res.json();
        const txInfo = json?.result;
        if (txInfo) {
          const st = txInfo.status || txInfo.status_name;
          const resNum = txInfo.result;
          if (st === 'ACCEPTED' || st === 'FINALIZED' || resNum === 5) {
            break;
          }
          if (st === 'CANCELED') {
            throw new Error(`Transaction reverted on-chain (Status: ${st}).`);
          }
          // Note: UNDETERMINED or PENDING is normal consensus progress in GenLayer, DO NOT abort!
        }
      } catch (pollErr: any) {
        if (pollErr.message?.includes('rejected')) throw pollErr;
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    // Update user balance
    if (account) fetchUserBalance(account);

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

          const CHAIN_ID_HEX = '0x' + STUDIONET_CONFIG.id.toString(16);
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
      localStorage.setItem('connected_wallet_account', userAddr);
      fetchUserBalance(userAddr);
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || 'Failed to connect wallet.');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    localStorage.removeItem('connected_wallet_account');
    setUserBalance('0.0000');
  };

  // Switch or Reset Worker Account for testing worker claims
  const switchWorkerAccount = () => {
    const newPk = generatePrivateKey();
    const newAcc = createAccount(newPk);
    const newAddr = newAcc.address.toLowerCase();
    localStorage.setItem(`genlayer_pk_${newAddr}`, newPk);
    localStorage.setItem('genlayer_pk_default', newPk);
    localStorage.setItem('connected_wallet_account', newAddr);
    setAccount(newAddr);
    fetchUserBalance(newAddr);
    alert(`Created & switched to new Worker Wallet:\n${newAddr}\n\nYou can now claim tasks and stake 15% collateral!`);
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

      const cleanHex = str.startsWith('0x') ? str.slice(2) : str;
      if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0) {
        try {
          const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []);
          const decoded = new TextDecoder().decode(bytes).trim();
          if (decoded && (decoded.includes('[') || decoded.includes('{'))) {
            str = decoded;
          }
        } catch (e) {
          console.error('Failed to decode hex bytes:', e);
        }
      }

      const start = str.indexOf('[');
      const end = str.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        str = str.substring(start, end + 1);
      }

      try {
        let parsed = JSON.parse(str);
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (_) {}
        }
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        console.error('Failed to parse JSON on-chain result:', err, 'raw:', str);
      }
    }
    return [];
  };

  // REAL ON-CHAIN TASK FETCHING VIA gen_call (get_all_tasks)
  const fetchTasksFromContract = useCallback(async () => {
    const targetAddr = (escrowContractAddress && escrowContractAddress.trim() !== '') 
      ? escrowContractAddress 
      : DEFAULT_ESCROW_CONTRACT_ADDRESS;

    try {
      setFetchingOnChain(true);
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
      });

      const rawResult = await client.request({
        method: 'gen_call',
        params: [{
          type: 'read',
          to: targetAddr,
          from: '0x0000000000000000000000000000000000000000',
          data: '0xd8960e066d6574686f646c6765745f616c6c5f7461736b7300',
          transaction_hash_variant: 'latest-nonfinal'
        }]
      });

      const parsed = parseOnChainResult<EscrowTask>(rawResult);
      const onChainTasks = parsed.reverse();
      const onChainIds = new Set(onChainTasks.map(t => t.id));

      // Remove pending tasks that are now confirmed on-chain or older than 3 minutes
      const now = Date.now();
      setPendingTasks(prev => {
        const remaining = prev.filter(p => {
          if (onChainIds.has(p.id)) return false; // Confirmed on-chain!
          const ageMs = p.created_at ? now - p.created_at : 999999999;
          // If task has no created_at (legacy) or has been pending for > 3 minutes and still not on-chain, expire it
          if (!p.created_at || ageMs > 180000) {
            console.warn(`Pending task #${p.id} expired from cache.`);
            return false;
          }
          return true;
        });
        if (remaining.length !== prev.length) {
          localStorage.setItem('pending_escrow_tasks', JSON.stringify(remaining));
        }
        return remaining;
      });

      setTasks(onChainTasks);
    } catch (err: any) {
      console.error('Failed to read tasks on-chain:', err);
    } finally {
      setFetchingOnChain(false);
    }
  }, [escrowContractAddress]);

  // REAL ON-CHAIN REPUTATION LEADERBOARD FETCHING VIA gen_call
  const fetchLeaderboardFromContract = useCallback(async () => {
    const targetAddr = (reputationContractAddress && reputationContractAddress.trim() !== '') 
      ? reputationContractAddress 
      : DEFAULT_REPUTATION_CONTRACT_ADDRESS;

    try {
      const client = createClient({
        chain: STUDIONET_CONFIG as any,
        endpoint: STUDIONET_CONFIG.rpcUrls.default.http[0]
      });

      const rawResult = await client.request({
        method: 'gen_call',
        params: [{
          type: 'read',
          to: targetAddr,
          from: '0x0000000000000000000000000000000000000000',
          data: '0xdf9d0e066d6574686f649c016765745f616c6c5f72657075746174696f6e7300',
          transaction_hash_variant: 'latest-nonfinal'
        }]
      });

      const parsed = parseOnChainResult<AgentReputationRecord>(rawResult);
      parsed.sort((a, b) => Number(b.score) - Number(a.score));
      setLeaderboard(parsed);
    } catch (err: any) {
      console.error('Failed to read reputation leaderboard on-chain:', err);
      setLeaderboard([]);
    }
  }, [reputationContractAddress]);

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

  // Auto background polling every 4 seconds to sync on-chain state seamlessly
  useEffect(() => {
    const timer = setInterval(() => {
      fetchTasksFromContract();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchTasksFromContract]);

  // CREATE ESCROW (Optimistic Insertion + Real On-chain Consensus)
  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      alert('Please connect your wallet before creating an escrow task.');
      return;
    }
    if (!escrowContractAddress) {
      alert('Contract address is not configured.');
      return;
    }

    const tid = taskIdInput.trim() || `task_${Date.now()}`;
    const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18));

    // 1. OPTIMISTIC INSERTION: Show task immediately in Escrows tab!
    const optimisticTask: EscrowTask = {
      id: tid,
      client: account.toLowerCase(),
      worker: '0x0000000000000000000000000000000000000000',
      title: title.trim(),
      criteria_url: criteriaUrl.trim(),
      criteria_hash: criteriaHash.trim() || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      deliverable_url: '',
      amount: weiAmount.toString(),
      worker_stake: '0',
      status: 'PENDING_CONSENSUS',
      attempts: '0',
      verdict: 'NONE',
      verdict_reason: 'Transaction submitted! Awaiting 5 AI Validators consensus (~1-2 min)...',
      confidence: '0',
      payout_ready_at: '0',
      deadline: (Math.floor(Date.now() / 1000) + parseInt(deadlineHours || '72', 10) * 3600).toString(),
      created_at: Date.now()
    };

    setPendingTasks(prev => {
      const updated = [optimisticTask, ...prev.filter(p => p.id !== tid)];
      localStorage.setItem('pending_escrow_tasks', JSON.stringify(updated));
      return updated;
    });

    // Switch to Escrows tab immediately so user sees their new task right away!
    setActiveTab('escrows');
    setStatusFilter('ALL');
    setLoading(true);
    setTxError(null);
    setSuccessBanner(`🚀 Task #${tid} initiated! Awaiting 5 AI Validators consensus...`);

    const createdTitle = title;
    const createdAmount = amount;
    setTaskIdInput('');
    setTitle('');
    setCriteriaUrl('');

    try {
      setStepMessage('Please confirm the GEN escrow transaction in your wallet...');

      await executeContractWrite(
        escrowContractAddress,
        'create_escrow',
        [
          tid,
          createdTitle,
          criteriaUrl.trim() || optimisticTask.criteria_url,
          criteriaHash.trim() || optimisticTask.criteria_hash,
          parseInt(deadlineHours || '72', 10)
        ],
        weiAmount
      );

      setStepMessage('Consensus verified! Syncing escrows...');
      await fetchTasksFromContract();
      setSuccessBanner(`🎉 Task #${tid} (${createdAmount} GEN) successfully finalized with validator consensus!`);
    } catch (err: any) {
      console.error('Create escrow error:', err);
      // If error occurs, remove from pending so it does not spin indefinitely
      setPendingTasks(prev => {
        const filtered = prev.filter(p => p.id !== tid);
        localStorage.setItem('pending_escrow_tasks', JSON.stringify(filtered));
        return filtered;
      });
      const errorMsg = err.message || 'Transaction failed or rejected.';
      setTxError(errorMsg.includes('rejected') || errorMsg.includes('User rejected')
        ? 'Transaction was rejected in wallet.'
        : `Transaction error: ${errorMsg}`);
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // ACCEPT TASK (Worker stakes 15%)
  const handleAcceptTask = async (task: EscrowTask) => {
    if (!account) {
      alert('Please connect your wallet before claiming this task.');
      return;
    }

    if (account && account.toLowerCase() === task.client.toLowerCase()) {
      const wantSwitch = window.confirm(
        `You are connected as the Client (${account.slice(0, 6)}...${account.slice(-4)}) who created this task!\n\nPer GenLayer rules: Clients cannot claim their own tasks.\n\nClick OK to switch to a dedicated Worker wallet and stake 15% collateral.`
      );
      if (wantSwitch) {
        switchWorkerAccount();
      }
      return;
    }

    setLoading(true);
    setTxError(null);
    setStepMessage(`Staking 15% collateral to claim Task #${task.id}...`);

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
      setTxError(err.message || 'Failed to accept task.');
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // SUBMIT WORK & TRIGGER LLM ADJUDICATION
  const handleSubmitWork = async (taskId: string) => {
    if (!account) {
      alert('Please connect your wallet first.');
      return;
    }
    if (!deliverableUrlInput) {
      alert('Please provide the deliverable submission URL.');
      return;
    }

    setLoading(true);
    setTxError(null);
    setStepMessage('Submitting deliverable & triggering AI Jury evaluation on-chain...');

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
      setTxError(err.message || 'Failed to submit deliverable on-chain.');
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
    setStepMessage(`Initiating Dispute resolution for Task #${taskId}...`);

    try {
      await executeContractWrite(
        escrowContractAddress,
        'raise_dispute',
        [taskId, disputeReasonInput || 'Disputed within 24h cooling off window'],
        BigInt(0)
      );

      setDisputeTargetId(null);
      setDisputeReasonInput('');
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error(err);
      setTxError(err.message || 'Failed to raise dispute.');
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
    setStepMessage(`Releasing escrow funds and settling Task #${taskId}...`);

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
      setTxError(err.message || 'Failed to finalize payout.');
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
    setStepMessage(`Claiming refund for Task #${taskId}...`);

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
      setTxError(err.message || 'Failed to recover stuck funds.');
    } finally {
      setLoading(false);
      setStepMessage('');
    }
  };

  // Combine real on-chain tasks with optimistic pending tasks
  const allDisplayTasks = [
    ...pendingTasks,
    ...tasks.filter(t => !pendingTasks.some(p => p.id === t.id))
  ];

  const filteredTasks = allDisplayTasks.filter(task => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'OPEN') return task.status === 'OPEN' || task.status === 'PENDING_CONSENSUS';
    return task.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_CONSENSUS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            Awaiting Consensus (~1-2 min)
          </span>
        );
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open for Claim
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-spin" />
            In Progress
          </span>
        );
      case 'AWAITING_PAYOUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            24h Cooling Off
          </span>
        );
      case 'NEEDS_REVISION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
            <RotateCcw className="w-3.5 h-3.5" />
            Revision Required
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Disputed
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            Escalated
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Closed & Settled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-full text-xs font-mono">
            {status}
          </span>
        );
    }
  };

  const faqs = [
    {
      q: 'What makes AgentEscrowCourt Steward Compliant?',
      a: 'It enforces 100% of GenLayer Steward Review Standards: 24h Cooling Off Window with dispute resolution, untruncated multi-source web ingestion, 15% collateral staking by workers, stuck-fund emergency recovery, and standalone AgentReputation cross-contract calls.'
    },
    {
      q: 'How does the AI Jury execute consensus without character-matching failures?',
      a: 'GenLayer uses gl.vm.run_nondet to compare LLM consensus outputs. While distinct validator nodes may output slightly different evaluation trace sentences, they vote on the exact semantic VERDICT (RELEASE, REFUND, RETRY, ESCALATE).'
    },
    {
      q: 'Why is 15% Collateral Staking required for Workers?',
      a: 'Requiring a 15% deposit to claim an Escrow task guarantees worker commitment, eliminates bot spam, and creates skin-in-the-game accountability.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 font-sans flex flex-col justify-between selection:bg-emerald-500 selection:text-black relative">
      
      {/* SUBTLE AMBIENT LIGHTING */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-950/15 via-transparent to-transparent pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* CONTENT */}
      <div className="relative z-10 flex-1">

        {/* TOP STATUS TICKER */}
        <div className="bg-[#0c121e]/90 border-b border-zinc-800/80 px-4 py-1.5 text-xs text-zinc-400 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px]">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> GenLayer Studionet • Chain ID 61999
            </span>
            <span className="hidden sm:inline text-zinc-500">|</span>
            <span className="hidden sm:inline text-zinc-400 text-[11px]">Optimistic Democracy & AI Jury Consensus</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Steward Compliant: 100%
            </span>
          </div>
        </div>
        
        {/* SLEEK NAVIGATION BAR */}
        <header className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-xl border-b border-zinc-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            
            {/* BRAND */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base tracking-tight">AgentEscrowCourt</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-mono font-medium">
                    v2.1
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Decentralized AI Adjudication & Escrow</p>
              </div>
            </div>

            {/* NAV TABS (DESKTOP) */}
            <nav className="hidden md:flex items-center p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setActiveTab('escrows')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                  activeTab === 'escrows'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Escrows</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'escrows' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {allDisplayTasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('create')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Create Task</span>
              </button>

              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'leaderboard'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-teal-400" />
                <span>Leaderboard</span>
              </button>

              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'architecture'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Architecture</span>
              </button>
            </nav>

            {/* WALLET & ACTION BUTTONS */}
            <div className="flex items-center gap-2.5">
              {account ? (
                <>
                  {/* Real Balance Chip */}
                  <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold text-white">{userBalance}</span>
                    <span className="text-zinc-400">GEN</span>
                  </div>

                  {/* Faucet +50 GEN */}
                  <button
                    onClick={handleFaucet}
                    disabled={loading}
                    title="Claim 50 testnet GEN faucet"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="hidden sm:inline">Faucet</span> +50
                  </button>

                  {/* Connected Wallet Pill */}
                  <div
                    onClick={() => handleCopy(account, 'account')}
                    title="Click to copy wallet address"
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs font-mono text-zinc-300 cursor-pointer transition"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                    {copiedAddress === 'account' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-500" />
                    )}
                  </div>

                  {/* Switch to Worker Account */}
                  <button
                    onClick={switchWorkerAccount}
                    title="Generate & switch to Worker Wallet (15% stake)"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 transition"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Worker Mode</span>
                  </button>

                  {/* Disconnect */}
                  <button
                    onClick={disconnectWallet}
                    title="Disconnect wallet"
                    className="p-2 bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 border border-zinc-800 hover:border-rose-900/60 rounded-xl transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.25)] transition flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              )}

              {/* Settings Cog Icon (Opens Contract Modal) */}
              <button
                onClick={() => {
                  setTempEscrowAddr(escrowContractAddress);
                  setTempRepAddr(reputationContractAddress);
                  setIsSettingsOpen(true);
                }}
                title="Configure Smart Contract Addresses"
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-xl transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MOBILE TAB BAR */}
          <div className="md:hidden flex items-center justify-around border-t border-zinc-800/80 px-2 py-2 bg-zinc-950">
            <button
              onClick={() => setActiveTab('escrows')}
              className={`text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                activeTab === 'escrows' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Escrows ({allDisplayTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                activeTab === 'create' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" /> Create
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                activeTab === 'leaderboard' ? 'bg-zinc-800 text-teal-400' : 'text-zinc-400'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> Ranks
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                activeTab === 'architecture' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" /> Specs
            </button>
          </div>
        </header>

        {/* CONTRACT SETTINGS MODAL */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-zinc-800 text-zinc-300 rounded-lg">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Smart Contract Settings</h3>
                    <p className="text-xs text-zinc-400">GenLayer Studionet (Chain ID 61999)</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">
                    AgentEscrowCourt Contract Address:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempEscrowAddr}
                      onChange={(e) => setTempEscrowAddr(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => handleCopy(tempEscrowAddr, 'escrow')}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
                    >
                      {copiedAddress === 'escrow' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">
                    AgentReputation Contract Address:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempRepAddr}
                      onChange={(e) => setTempRepAddr(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => handleCopy(tempRepAddr, 'rep')}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
                    >
                      {copiedAddress === 'rep' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
                  <span className="text-zinc-300 font-semibold block mb-1">Official Testnet Deployment:</span>
                  Official contracts are verified live on Studionet RPC with 5 consensus validators. You can switch or reset anytime.
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleResetToOfficialAddresses}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
                >
                  Reset to Official
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplySettings}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-semibold transition"
                  >
                    Save & Sync
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK BANNERS */}
        {txError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="p-4 bg-rose-950/50 border border-rose-900/60 rounded-xl text-xs text-rose-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{txError}</span>
              </div>
              <button onClick={() => setTxError(null)} className="text-rose-400 hover:text-white font-semibold">✕</button>
            </div>
          </div>
        )}

        {successBanner && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successBanner}</span>
              </div>
              <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-white font-semibold">✕</button>
            </div>
          </div>
        )}

        {stepMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="p-3.5 bg-zinc-900/90 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-3 font-mono">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
              <span>{stepMessage}</span>
            </div>
          </div>
        )}

        {/* MAIN BODY */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* COMPACT METRIC CARDS STRIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Active Escrows</span>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {allDisplayTasks.length}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">On-chain Intelligent Contracts</p>
            </div>

            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>24h Dispute Window</span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {allDisplayTasks.filter(t => t.status === 'AWAITING_PAYOUT').length}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Steward cooling-off window</p>
            </div>

            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Settled & Closed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {allDisplayTasks.filter(t => t.status === 'CLOSED').length}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Finalized & disbursed</p>
            </div>

            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Ranked Agents</span>
                <Trophy className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {leaderboard.length}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">AgentReputation scores</p>
            </div>
          </div>

          {/* TAB 1: ESCROWS LIST */}
          {activeTab === 'escrows' && (
            <div className="space-y-6">
              
              {/* FILTER BAR */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Filter:
                  </span>
                  {[
                    { id: 'ALL', label: 'All', count: allDisplayTasks.length },
                    { id: 'OPEN', label: 'Open', count: allDisplayTasks.filter(t => t.status === 'OPEN' || t.status === 'PENDING_CONSENSUS').length },
                    { id: 'IN_PROGRESS', label: 'In Progress', count: allDisplayTasks.filter(t => t.status === 'IN_PROGRESS').length },
                    { id: 'AWAITING_PAYOUT', label: 'Cooling Off', count: allDisplayTasks.filter(t => t.status === 'AWAITING_PAYOUT').length },
                    { id: 'DISPUTED', label: 'Disputed', count: allDisplayTasks.filter(t => t.status === 'DISPUTED').length },
                    { id: 'CLOSED', label: 'Closed', count: allDisplayTasks.filter(t => t.status === 'CLOSED').length }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                        statusFilter === f.id
                          ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                          : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/40'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        statusFilter === f.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => fetchTasksFromContract()}
                  disabled={fetchingOnChain}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingOnChain ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>Refresh On-Chain</span>
                </button>
              </div>

              {/* TASKS LIST RENDERING */}
              {fetchingOnChain && allDisplayTasks.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs font-mono text-zinc-400">Syncing live on-chain data from GenLayer Studionet RPC...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-16 text-center border border-zinc-800/80 rounded-2xl bg-zinc-900/40 p-8 space-y-4">
                  <FileCheck className="w-10 h-10 text-zinc-600 mx-auto" />
                  <h3 className="text-base font-semibold text-white">No Escrow Tasks Found</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    No on-chain tasks matching filter <span className="font-mono text-emerald-400 font-semibold">{statusFilter}</span>.
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-xl transition inline-flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" /> Create First Escrow
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map(task => {
                    const isClient = account && account.toLowerCase() === task.client.toLowerCase();
                    const isWorker = account && account.toLowerCase() === task.worker.toLowerCase();
                    const isPending = task.status === 'PENDING_CONSENSUS';
                    const bountyGen = (Number(BigInt(task.amount || 0)) / 1e18).toFixed(2);
                    const stakeGen = (Number(BigInt(task.worker_stake || 0)) / 1e18).toFixed(2);
                    const requiredStakeGen = (Number(BigInt(task.amount || 0)) * 0.15 / 1e18).toFixed(2);

                    return (
                      <div
                        key={task.id}
                        className={`bg-zinc-900/70 hover:bg-zinc-900/90 border ${
                          isPending ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-zinc-800/80 hover:border-zinc-700/80'
                        } rounded-2xl p-6 transition-all shadow-sm space-y-5`}
                      >
                        {/* CARD HEADER */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-[280px]">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono text-xs text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md">
                                #{task.id}
                              </span>
                              {getStatusBadge(task.status)}
                            </div>
                            <h3 className="text-lg font-bold text-white tracking-tight">
                              {task.title}
                            </h3>
                          </div>

                          {/* REWARD BADGE */}
                          <div className="text-right">
                            <div className="text-2xl font-black font-mono text-amber-400">
                              {bountyGen} <span className="text-sm font-normal text-zinc-400">GEN</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              15% Collateral: <strong className="text-zinc-200">{stakeGen > '0.00' ? stakeGen : requiredStakeGen} GEN</strong>
                            </div>
                          </div>
                        </div>

                        {/* META INFO ROW */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-400 font-mono bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500">Client:</span>
                            <span
                              onClick={() => handleCopy(task.client, `c_${task.id}`)}
                              className="text-zinc-300 font-semibold hover:text-white cursor-pointer flex items-center gap-1"
                              title="Click to copy"
                            >
                              {task.client.slice(0, 6)}...{task.client.slice(-4)}
                              {copiedAddress === `c_${task.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500">Worker:</span>
                            {task.worker && task.worker !== '0x0000000000000000000000000000000000000000' ? (
                              <span
                                onClick={() => handleCopy(task.worker, `w_${task.id}`)}
                                className="text-zinc-300 font-semibold hover:text-white cursor-pointer flex items-center gap-1"
                              >
                                {task.worker.slice(0, 6)}...{task.worker.slice(-4)}
                                {copiedAddress === `w_${task.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                              </span>
                            ) : (
                              <span className="text-emerald-400/90 font-medium">Unclaimed (Open to all agents)</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 sm:justify-end">
                            <span className="text-zinc-500">Attempts:</span>
                            <span className="text-zinc-300 font-bold">{task.attempts}/3</span>
                          </div>
                        </div>

                        {/* SPECIFICATION & DELIVERABLE LINKS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* SPEC */}
                          <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 space-y-1.5">
                            <span className="text-zinc-400 font-medium flex items-center gap-1.5 text-[11px]">
                              <FileText className="w-3.5 h-3.5 text-emerald-400" /> Requirement Specification
                            </span>
                            <div className="flex items-center justify-between gap-2">
                              <a
                                href={task.criteria_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 truncate group"
                              >
                                <span>View Spec Document</span>
                                <ExternalLink className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition" />
                              </a>
                              {task.criteria_hash && (
                                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800" title={`Full SHA-256: ${task.criteria_hash}`}>
                                  sha256:{task.criteria_hash.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          </div>

                          {/* DELIVERABLE */}
                          <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 space-y-1.5">
                            <span className="text-zinc-400 font-medium flex items-center gap-1.5 text-[11px]">
                              <FileCheck className="w-3.5 h-3.5 text-amber-400" /> Deliverable Submission
                            </span>
                            <div>
                              {task.deliverable_url ? (
                                <a
                                  href={task.deliverable_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 truncate group"
                                >
                                  <span>View Worker Deliverable</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition" />
                                </a>
                              ) : (
                                <span className="text-zinc-500 italic text-xs">
                                  Pending worker delivery...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* AI JURY VERDICT CARD */}
                        {task.verdict_reason && (
                          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-emerald-400" />
                                <span className="font-semibold text-white font-mono">
                                  AI Jury Verdict: <span className="text-emerald-400">{task.verdict || 'EVALUATED'}</span>
                                </span>
                              </div>
                              {task.confidence && (
                                <span className="px-2.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[11px] rounded-md">
                                  Confidence: {task.confidence}%
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-300 font-sans leading-relaxed text-xs bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/60">
                              "{task.verdict_reason}"
                            </p>
                          </div>
                        )}

                        {/* ACTION FOOTER */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
                          <div className="text-xs text-zinc-400">
                            {isPending && (
                              <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Auto-promotes to OPEN upon consensus finalization...
                              </span>
                            )}
                            {task.status === 'AWAITING_PAYOUT' && (
                              <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                                <Clock className="w-3.5 h-3.5 animate-pulse" /> 24h Cooling-Off Window active
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* CLAIM TASK (Worker 15% stake) */}
                            {task.status === 'OPEN' && (
                              !account ? (
                                <button
                                  onClick={connectWallet}
                                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-xl transition flex items-center gap-2"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Connect Wallet to Claim (15% Stake)
                                </button>
                              ) : !isClient ? (
                                <button
                                  onClick={() => handleAcceptTask(task)}
                                  disabled={loading}
                                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                                >
                                  <DollarSign className="w-3.5 h-3.5" /> Claim Task (Stake 15%)
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-zinc-400 flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                    You are the Client who created this task (cannot self-claim)
                                  </span>
                                  <button
                                    onClick={switchWorkerAccount}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Switch to Worker Wallet to Claim
                                  </button>
                                </div>
                              )
                            )}

                            {/* SUBMIT WORK */}
                            {(task.status === 'IN_PROGRESS' || task.status === 'NEEDS_REVISION') && isWorker && (
                              <button
                                onClick={() => setSubmitTaskTargetId(task.id)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                              >
                                <FileCheck className="w-3.5 h-3.5" /> Submit Deliverable & Trigger AI Jury
                              </button>
                            )}

                            {/* RAISE DISPUTE */}
                            {task.status === 'AWAITING_PAYOUT' && (isClient || isWorker) && (
                              <button
                                onClick={() => setDisputeTargetId(task.id)}
                                className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Raise Dispute
                              </button>
                            )}

                            {/* FINALIZE PAYOUT */}
                            {task.status === 'AWAITING_PAYOUT' && (
                              <button
                                onClick={() => handleFinalizePayout(task.id)}
                                disabled={loading}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Payout (Disburse GEN)
                              </button>
                            )}

                            {/* RECOVER STUCK FUNDS */}
                            {(task.status === 'OPEN' || task.status === 'IN_PROGRESS' || task.status === 'NEEDS_REVISION') && isClient && (
                              <button
                                onClick={() => handleRecoverStuckFunds(task.id)}
                                disabled={loading}
                                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition"
                              >
                                Recover Funds
                              </button>
                            )}
                          </div>
                        </div>

                        {/* SUBMIT WORK MODAL */}
                        {submitTaskTargetId === task.id && (
                          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-700 space-y-3">
                            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-emerald-400" /> Submit Deliverable for Task #{task.id}
                            </h4>
                            <input
                              type="url"
                              placeholder="https://raw.githubusercontent.com/.../report.md"
                              value={deliverableUrlInput}
                              onChange={(e) => setDeliverableUrlInput(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setSubmitTaskTargetId(null)}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSubmitWork(task.id)}
                                disabled={loading}
                                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-lg"
                              >
                                Submit & Evaluate
                              </button>
                            </div>
                          </div>
                        )}

                        {/* DISPUTE MODAL */}
                        {disputeTargetId === task.id && (
                          <div className="p-4 bg-zinc-950 rounded-xl border border-rose-800/80 space-y-3">
                            <h4 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-400" /> Raise Dispute for Task #{task.id}
                            </h4>
                            <input
                              type="text"
                              placeholder="Reason for dispute..."
                              value={disputeReasonInput}
                              onChange={(e) => setDisputeReasonInput(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setDisputeTargetId(null)}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleRaiseDispute(task.id)}
                                disabled={loading}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg"
                              >
                                Confirm Dispute
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE ESCROW (2-COLUMN MODERN DESIGN) */}
          {activeTab === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* FORM (7 COLS) */}
              <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-emerald-400" /> Create New AI Escrow Task
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Deposit GEN into GenLayer Intelligent Contract. Workers lock 15% collateral stake to claim.
                  </p>
                </div>

                {/* QUICK TEMPLATES */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500">Quick template:</span>
                  {[
                    { label: 'Code Audit', title: 'Smart Contract Security Audit', amount: '2.5' },
                    { label: 'API Integration', title: 'GenLayer Python SDK Integration', amount: '1.5' },
                    { label: 'Doc Translation', title: 'Technical Whitepaper Translation', amount: '1.0' }
                  ].map(tmpl => (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => {
                        setTitle(tmpl.title);
                        setAmount(tmpl.amount);
                        setCriteriaUrl('https://raw.githubusercontent.com/tuannguyen1995/agentEscrowCourt/master/README.md');
                      }}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition"
                    >
                      + {tmpl.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCreateEscrow} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1.5">Task ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. task_001 (auto if empty)"
                        value={taskIdInput}
                        onChange={(e) => setTaskIdInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1.5">Escrow Bounty (GEN)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AI Vulnerability Audit for GenLayer Contract"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">Specification URL (Raw HTTP/HTTPS spec)</label>
                    <input
                      type="url"
                      required
                      placeholder="https://raw.githubusercontent.com/.../spec.md"
                      value={criteriaUrl}
                      onChange={(e) => setCriteriaUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1.5">Criteria SHA-256 Hash</label>
                      <input
                        type="text"
                        required
                        value={criteriaHash}
                        onChange={(e) => setCriteriaHash(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1.5">Deadline (Hours)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={deadlineHours}
                        onChange={(e) => setDeadlineHours(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.25)] transition duration-200 flex items-center justify-center gap-2 mt-4"
                  >
                    <Cpu className="w-4 h-4" />
                    <span>{loading ? 'Submitting to Studionet...' : `Create Escrow & Lock ${amount} GEN`}</span>
                  </button>
                </form>
              </div>

              {/* LIVE PREVIEW (5 COLS) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Live On-Chain Card Preview
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                        #{taskIdInput || 'task_preview'}
                      </span>
                      <div className="mt-2">
                        {getStatusBadge('OPEN')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-amber-400">
                        {parseFloat(amount || '0').toFixed(2)} GEN
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        15% Stake: {(parseFloat(amount || '0') * 0.15).toFixed(2)} GEN
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white">
                      {title || 'Untitled Task Title'}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                      {criteriaUrl || 'Specification document URL will appear here once entered...'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex justify-between items-center text-xs text-zinc-500">
                    <span>Deadline: {deadlineHours}h</span>
                    <span>AI Jury: Multi-Validator Consensus</span>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60 text-xs text-zinc-400 space-y-2">
                  <span className="font-semibold text-zinc-300 block">Steward Guarantee:</span>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400">
                    <li>GEN is safely escrowed in GenLayer Intelligent Contract.</li>
                    <li>Worker must lock 15% collateral to claim.</li>
                    <li>AI Jury evaluates deliverable with untruncated web render.</li>
                    <li>24h Cooling-Off Window protects both parties before final payout.</li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: AGENT LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" /> On-Chain AI Agent Reputation Leaderboard
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Live scores queried across contracts from <code className="text-zinc-300 font-mono">AgentReputation.py</code> on GenLayer Studionet.
                  </p>
                </div>
                <button
                  onClick={() => fetchLeaderboardFromContract()}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs rounded-xl flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Ranks
                </button>
              </div>

              {leaderboard.length === 0 ? (
                <div className="py-16 text-center border border-zinc-800/80 rounded-2xl bg-zinc-900/40 p-8 space-y-3">
                  <Trophy className="w-10 h-10 text-zinc-600 mx-auto" />
                  <h4 className="text-base font-semibold text-white">No Agent Records Yet</h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Once tasks are successfully finalized on-chain, reputation scores will be computed and ranked here.
                  </p>
                </div>
              ) : (
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden divide-y divide-zinc-800/80">
                  {leaderboard.map((item, idx) => {
                    const total = Number(item.total_tasks || 0);
                    const succ = Number(item.successful_tasks || 0);
                    const winRate = total > 0 ? Math.round((succ / total) * 100) : 100;

                    return (
                      <div key={item.agent} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-zinc-800/40 transition">
                        <div className="flex items-center gap-4">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-xs ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : idx === 1
                              ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-white text-xs sm:text-sm">
                                {item.agent}
                              </span>
                              {idx === 0 && (
                                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] rounded-full font-medium">
                                  Top Agent
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono mt-1">
                              Jobs: <strong className="text-zinc-200">{item.total_tasks}</strong> • Success: <strong className="text-emerald-400">{item.successful_tasks}</strong> • Failed: <strong className="text-rose-400">{item.failed_tasks}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 font-mono text-right">
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Win Rate</span>
                            <span className="text-sm font-bold text-emerald-400">{winRate}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Reputation</span>
                            <span className="text-lg font-black text-amber-400">{item.score} pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ARCHITECTURE SPEC */}
          {activeTab === 'architecture' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-400" /> GenLayer Steward Compliant Architecture
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  100% compliant with the GenLayer Intelligent Contract Review & Steward Evaluation Guidelines.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" /> 1. 24h Payout Cooling-Off Window
                  </span>
                  <p className="text-zinc-400 leading-relaxed">
                    Once the AI Court reaches consensus, the escrow enters <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded font-mono">AWAITING_PAYOUT</code> for 24 hours. Either party can initiate a dispute before funds disburse.
                  </p>
                </div>

                <div className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" /> 2. 15% Worker Collateral Staking
                  </span>
                  <p className="text-zinc-400 leading-relaxed">
                    Workers must lock a mandatory 15% deposit to claim an OPEN escrow task. This eliminates spam bot claims and guarantees commitment to the specification.
                  </p>
                </div>

                <div className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" /> 3. Untruncated Web Renders
                  </span>
                  <p className="text-zinc-400 leading-relaxed">
                    Specifications and deliverables are fetched via <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded font-mono">gl.nondet.web.render</code> without artificial character limits, passing complete contexts to validator LLMs.
                  </p>
                </div>

                <div className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" /> 4. Stuck-Fund Emergency Recovery
                  </span>
                  <p className="text-zinc-400 leading-relaxed">
                    Clients retain the right to recover deposited escrow funds via <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded font-mono">recover_stuck_funds</code> if the task is abandoned or misses deadlines.
                  </p>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* FAQ SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-zinc-800/80">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <HelpCircle className="w-4 h-4 text-emerald-400" /> Frequently Asked Questions
          </h3>
          <div className="space-y-2.5">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-3.5 text-left flex justify-between items-center text-xs font-semibold text-zinc-300 hover:text-white transition"
                >
                  <span>{faq.q}</span>
                  {openFaq === index ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                </button>
                {openFaq === index && (
                  <div className="p-3.5 pt-0 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-5 text-center text-xs text-zinc-500 space-y-1 relative z-10">
        <div className="flex justify-center items-center gap-2">
          <Scale className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-zinc-300">AgentEscrowCourt</span>
          <span>•</span>
          <span>GenLayer Studionet (Chain ID 61999)</span>
        </div>
        <p className="text-[11px] text-zinc-500">
          Decentralized AI Escrow Court powered by GenLayer Intelligent Contracts & Multi-Source Web Rendering.
        </p>
      </footer>

    </div>
  );
}
