'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Calendar } from './ui/calendar';
import { MessageCircle, X, Send, Bot, User, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { clearAllCache } from '@/lib/cache';

// --- Types ---

interface Profile {
  id: string;
  name: string;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  type?: 'text' | 'profile-select' | 'date-picker' | 'yes-no' | 'summary' | 'heading';
  options?: { label: string; value: string }[];
  profileOptions?: Profile[];
}

// --- Session Persistence ---

const CHAT_SESSION_KEY = 'finance-assistant-session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PersistedSession {
  messages: ChatMessage[];
  step: ConversationStep;
  data: CollectedData;
  currentBankName: string;
  isOpen: boolean;
  timestamp: number;
}

function saveSession(session: Omit<PersistedSession, 'timestamp'>) {
  try {
    const payload: PersistedSession = { ...session, timestamp: Date.now() };
    localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    const session: PersistedSession = JSON.parse(raw);
    // Check if expired (24 hours)
    if (Date.now() - session.timestamp > SESSION_TTL_MS) {
      localStorage.removeItem(CHAT_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(CHAT_SESSION_KEY);
  } catch {
    // ignore
  }
}

interface CollectedData {
  profileId: string | null;
  profileName: string | null;
  entryDate: string | null;
  // Stocks
  totalStocks: number;
  goldInStocks: number;
  silverInStocks: number;
  // Mutual Funds
  totalMutualFunds: number;
  arbitrageFunds: number;
  // Banks
  banks: BankData[];
  // Other assets
  endowmentPlans: number;
  nps: number;
  epf: number;
  ppf: number;
  ulip: number;
  realEstate: number;
  realEstatesFunds: number;
  privateEquity: number;
  esops: number;
  equityPms: number;
  structuredProductsEquity: number;
  structuredProductsDebt: number;
}

interface BankData {
  name: string;
  balance: number;
  fd: number;
  rd: number;
}

type ConversationStep =
  | 'idle'
  | 'select-profile'
  | 'select-date'
  | 'stocks-total'
  | 'stocks-gold'
  | 'stocks-silver'
  | 'mf-total'
  | 'mf-arbitrage'
  | 'bank-ask-hdfc'
  | 'bank-hdfc-balance'
  | 'bank-hdfc-fd'
  | 'bank-hdfc-rd'
  | 'bank-ask-sbi'
  | 'bank-sbi-balance'
  | 'bank-sbi-fd'
  | 'bank-sbi-rd'
  | 'bank-ask-icici'
  | 'bank-icici-balance'
  | 'bank-icici-fd'
  | 'bank-icici-rd'
  | 'bank-ask-canara'
  | 'bank-canara-balance'
  | 'bank-canara-fd'
  | 'bank-canara-rd'
  | 'bank-ask-other'
  | 'bank-other-name'
  | 'bank-other-balance'
  | 'bank-other-fd'
  | 'bank-other-rd'
  | 'bank-ask-another'
  | 'endowment'
  | 'nps'
  | 'epf'
  | 'ppf'
  | 'ulip'
  | 'real-estate'
  | 'real-estate-funds'
  | 'private-equity'
  | 'esops'
  | 'equity-pms'
  | 'structured-products-equity'
  | 'structured-products-debt'
  | 'confirm-summary'
  | 'saving'
  | 'done';

// --- Helper Functions (exported for testing) ---

/**
 * Parse a user input that may contain Indian-style commas and arithmetic expressions
 * e.g., "12,89,502 + 8,64,670" => 2154172
 */
export function parseAmountExpression(input: string): number {
  // Remove all commas (Indian or otherwise)
  const cleaned = input.replace(/,/g, '');
  
  // Try to evaluate simple arithmetic (only +, -, *, /)
  // Safety: only allow digits, decimal points, spaces, and arithmetic operators
  if (!/^[\d\s.+\-*/()]+$/.test(cleaned)) {
    return NaN;
  }

  try {
    // Use Function constructor for safe math evaluation
    const result = new Function(`return (${cleaned})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 100) / 100; // Round to 2 decimal places
    }
    return NaN;
  } catch {
    return NaN;
  }
}

/**
 * Format number with Indian numbering system
 */
export function formatIndianNumber(num: number): string {
  if (num === 0) return '0';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const parts = absNum.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Indian grouping: last 3 digits, then groups of 2
  let result = '';
  const len = intPart.length;
  if (len <= 3) {
    result = intPart;
  } else {
    result = intPart.substring(len - 3);
    let remaining = intPart.substring(0, len - 3);
    while (remaining.length > 2) {
      result = remaining.substring(remaining.length - 2) + ',' + result;
      remaining = remaining.substring(0, remaining.length - 2);
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result;
    }
  }

  // Only show decimals if non-zero
  const formatted = decPart === '00' ? result : `${result}.${decPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

// --- Data Helpers ---

function getEmptyData(): CollectedData {
  return {
    profileId: null,
    profileName: null,
    entryDate: null,
    totalStocks: 0,
    goldInStocks: 0,
    silverInStocks: 0,
    totalMutualFunds: 0,
    arbitrageFunds: 0,
    banks: [],
    endowmentPlans: 0,
    nps: 0,
    epf: 0,
    ppf: 0,
    ulip: 0,
    realEstate: 0,
    realEstatesFunds: 0,
    privateEquity: 0,
    esops: 0,
    equityPms: 0,
    structuredProductsEquity: 0,
    structuredProductsDebt: 0,
  };
}

// --- Component ---

interface FinanceAssistantChatProps {
  /** Currently selected profile ID from the parent page (optional) */
  selectedProfileId?: string | null;
  /** Callback when entry is saved - parent can use to refresh state */
  onEntrySaved?: (profileId: string, entryDate: string) => void;
}

export function FinanceAssistantChat({ onEntrySaved }: FinanceAssistantChatProps) {
  // Load persisted session once on mount (initializer functions run only on first render)
  const [initialSession] = useState(() => loadSession());

  const [isOpen, setIsOpen] = useState(() => initialSession?.isOpen ?? false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialSession?.messages ?? []);
  const [userInput, setUserInput] = useState('');
  const [step, setStep] = useState<ConversationStep>(() => initialSession?.step ?? 'idle');
  const [data, setData] = useState<CollectedData>(() => initialSession?.data ?? getEmptyData());
  const [currentBankName, setCurrentBankName] = useState(() => initialSession?.currentBankName ?? '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Persist session on every meaningful state change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (step === 'done') {
        // Clear session once entry is saved
        clearSession();
      } else if (step !== 'idle' || messages.length > 0) {
        saveSession({ messages, step, data, currentBankName, isOpen });
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [messages, step, data, currentBankName, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens or step changes
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, step]);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: crypto.randomUUID() }]);
  }, []);

  const startConversation = async () => {
    clearSession();
    setMessages([]);
    setData(getEmptyData());
    setStep('select-profile');

    // Fetch profiles
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addMessage({ role: 'assistant', content: 'You need to be logged in. Please log in and try again.', type: 'text' });
        return;
      }

      const response = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const result = await response.json();
        const profileList: Profile[] = result.profiles || [];

        if (profileList.length === 0) {
          addMessage({ role: 'assistant', content: 'No profiles found. Please create a profile first from the main page.', type: 'text' });
          setStep('idle');
          return;
        }

        addMessage({
          role: 'assistant',
          content: 'Which profile do you want to create or update data for?',
          type: 'profile-select',
          profileOptions: profileList,
        });
      } else {
        addMessage({ role: 'assistant', content: 'Failed to load profiles. Please try again.', type: 'text' });
        setStep('idle');
      }
    } catch {
      addMessage({ role: 'assistant', content: 'Network error. Please check your connection and try again.', type: 'text' });
      setStep('idle');
    }
  };

  const handleProfileSelect = (profile: Profile) => {
    setData(prev => ({ ...prev, profileId: profile.id, profileName: profile.name }));
    addMessage({ role: 'user', content: profile.name, type: 'text' });
    addMessage({
      role: 'assistant',
      content: 'Which date do you want to create or update data for?',
      type: 'date-picker',
    });
    setStep('select-date');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const displayDate = `${day}/${month}/${year}`;

    setData(prev => ({ ...prev, entryDate: dateString }));
    addMessage({ role: 'user', content: displayDate, type: 'text' });

    // Start asking about stocks
    addMessage({ role: 'assistant', content: '📈 Stocks & Direct Equity', type: 'heading' });
    addMessage({ role: 'assistant', content: 'What is the total current value of your stocks (including Gold & Silver ETFs held in Demat)?', type: 'text' });
    setStep('stocks-total');
  };

  const handleYesNo = (answer: 'yes' | 'no') => {
    addMessage({ role: 'user', content: answer === 'yes' ? 'Yes' : 'No', type: 'text' });

    if (step === 'bank-ask-hdfc') {
      if (answer === 'yes') {
        addMessage({ role: 'assistant', content: 'What is your HDFC bank balance?', type: 'text' });
        setCurrentBankName('HDFC');
        setStep('bank-hdfc-balance');
      } else {
        askBankSbi();
      }
    } else if (step === 'bank-ask-sbi') {
      if (answer === 'yes') {
        addMessage({ role: 'assistant', content: 'What is your SBI bank balance?', type: 'text' });
        setCurrentBankName('SBI');
        setStep('bank-sbi-balance');
      } else {
        askBankIcici();
      }
    } else if (step === 'bank-ask-icici') {
      if (answer === 'yes') {
        addMessage({ role: 'assistant', content: 'What is your ICICI bank balance?', type: 'text' });
        setCurrentBankName('ICICI');
        setStep('bank-icici-balance');
      } else {
        askBankCanara();
      }
    } else if (step === 'bank-ask-canara') {
      if (answer === 'yes') {
        addMessage({ role: 'assistant', content: 'What is your Canara bank balance?', type: 'text' });
        setCurrentBankName('Canara');
        setStep('bank-canara-balance');
      } else {
        askBankOther();
      }
    } else if (step === 'bank-ask-other' || step === 'bank-ask-another') {
      if (answer === 'yes') {
        addMessage({ role: 'assistant', content: 'What is the name of this bank?', type: 'text' });
        setStep('bank-other-name');
      } else {
        askOtherAssets();
      }
    } else if (step === 'confirm-summary') {
      if (answer === 'yes') {
        saveEntry();
      } else {
        addMessage({ role: 'assistant', content: 'No problem! The data was not saved. You can start over anytime by clicking the chat button.', type: 'text' });
        setStep('idle');
      }
    }
  };

  const askBankSbi = () => {
    addMessage({ role: 'assistant', content: 'Do you have an SBI bank account?', type: 'yes-no' });
    setStep('bank-ask-sbi');
  };

  const askBankIcici = () => {
    addMessage({ role: 'assistant', content: 'Do you have an ICICI bank account?', type: 'yes-no' });
    setStep('bank-ask-icici');
  };

  const askBankCanara = () => {
    addMessage({ role: 'assistant', content: 'Do you have a Canara bank account?', type: 'yes-no' });
    setStep('bank-ask-canara');
  };

  const askBankOther = () => {
    addMessage({ role: 'assistant', content: 'Do you have any other bank account?', type: 'yes-no' });
    setStep('bank-ask-other');
  };

  const askBankAnother = () => {
    addMessage({ role: 'assistant', content: 'Do you have another bank account?', type: 'yes-no' });
    setStep('bank-ask-another');
  };

  const askOtherAssets = () => {
    addMessage({ role: 'assistant', content: '🏦 Other Investments', type: 'heading' });
    addMessage({ role: 'assistant', content: 'How much do you have in Endowment Plans? (Enter 0 if none)', type: 'text' });
    setStep('endowment');
  };

  const processAmountInput = (input: string, options?: { max?: number; maxLabel?: string; allowNegativeResult?: boolean }): number | null => {
    const value = parseAmountExpression(input.trim());
    if (isNaN(value)) {
      addMessage({ role: 'assistant', content: 'I couldn\'t understand that amount. Please enter a number (you can use +, -, * and Indian-style commas). Example: 12,89,502 + 8,64,670', type: 'text' });
      return null;
    }
    if (value < 0) {
      addMessage({ role: 'assistant', content: 'The amount cannot be negative. Please enter a valid positive amount (or 0 if none).', type: 'text' });
      return null;
    }
    if (options?.max !== undefined && value > options.max) {
      addMessage({
        role: 'assistant',
        content: `This amount (₹${formatIndianNumber(value)}) exceeds the ${options.maxLabel || 'total'} of ₹${formatIndianNumber(options.max)}. Please enter a value less than or equal to the total.`,
        type: 'text',
      });
      return null;
    }
    return value;
  };

  const handleTextInput = () => {
    const input = userInput.trim();
    if (!input) return;

    addMessage({ role: 'user', content: input, type: 'text' });
    setUserInput('');

    // Process based on current step
    switch (step) {
      case 'stocks-total': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, totalStocks: val }));
        addMessage({ role: 'assistant', content: 'Out of total stocks, how much is in Gold?', type: 'text' });
        setStep('stocks-gold');
        break;
      }
      case 'stocks-gold': {
        const val = processAmountInput(input, { max: data.totalStocks, maxLabel: 'total stocks' });
        if (val === null) return;
        setData(prev => ({ ...prev, goldInStocks: val }));
        addMessage({ role: 'assistant', content: 'Out of total stocks, how much is in Silver?', type: 'text' });
        setStep('stocks-silver');
        break;
      }
      case 'stocks-silver': {
        const maxSilver = data.totalStocks - data.goldInStocks;
        const val = processAmountInput(input, { max: maxSilver, maxLabel: 'remaining stocks (after Gold)' });
        if (val === null) return;
        setData(prev => ({ ...prev, silverInStocks: val }));
        // Move to Mutual Funds
        addMessage({ role: 'assistant', content: '📊 Mutual Funds', type: 'heading' });
        addMessage({ role: 'assistant', content: 'What is the total value of your Mutual Funds?', type: 'text' });
        setStep('mf-total');
        break;
      }
      case 'mf-total': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, totalMutualFunds: val }));
        addMessage({ role: 'assistant', content: 'Out of total MFs, how much is in Arbitrage / Debt Funds?', type: 'text' });
        setStep('mf-arbitrage');
        break;
      }
      case 'mf-arbitrage': {
        const val = processAmountInput(input, { max: data.totalMutualFunds, maxLabel: 'total Mutual Funds' });
        if (val === null) return;
        setData(prev => ({ ...prev, arbitrageFunds: val }));
        // Move to Banks
        addMessage({ role: 'assistant', content: '🏧 Bank Balance & Deposits', type: 'heading' });
        addMessage({ role: 'assistant', content: 'Do you have an HDFC bank account?', type: 'yes-no' });
        setStep('bank-ask-hdfc');
        break;
      }
      // HDFC
      case 'bank-hdfc-balance': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'HDFC');
          if (idx >= 0) banks[idx].balance = val;
          else banks.push({ name: 'HDFC', balance: val, fd: 0, rd: 0 });
          return { ...prev, banks };
        });
        addMessage({ role: 'assistant', content: 'How much is in FDs/RDs in HDFC? (combined FD + RD amount)', type: 'text' });
        setStep('bank-hdfc-fd');
        break;
      }
      case 'bank-hdfc-fd': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'HDFC');
          if (idx >= 0) banks[idx].fd = val;
          return { ...prev, banks };
        });
        askBankSbi();
        break;
      }
      // SBI
      case 'bank-sbi-balance': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'SBI');
          if (idx >= 0) banks[idx].balance = val;
          else banks.push({ name: 'SBI', balance: val, fd: 0, rd: 0 });
          return { ...prev, banks };
        });
        addMessage({ role: 'assistant', content: 'How much is in FDs/RDs in SBI? (combined FD + RD amount)', type: 'text' });
        setStep('bank-sbi-fd');
        break;
      }
      case 'bank-sbi-fd': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'SBI');
          if (idx >= 0) banks[idx].fd = val;
          return { ...prev, banks };
        });
        askBankIcici();
        break;
      }
      // ICICI
      case 'bank-icici-balance': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'ICICI');
          if (idx >= 0) banks[idx].balance = val;
          else banks.push({ name: 'ICICI', balance: val, fd: 0, rd: 0 });
          return { ...prev, banks };
        });
        addMessage({ role: 'assistant', content: 'How much is in FDs/RDs in ICICI? (combined FD + RD amount)', type: 'text' });
        setStep('bank-icici-fd');
        break;
      }
      case 'bank-icici-fd': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'ICICI');
          if (idx >= 0) banks[idx].fd = val;
          return { ...prev, banks };
        });
        askBankCanara();
        break;
      }
      // Canara
      case 'bank-canara-balance': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'Canara');
          if (idx >= 0) banks[idx].balance = val;
          else banks.push({ name: 'Canara', balance: val, fd: 0, rd: 0 });
          return { ...prev, banks };
        });
        addMessage({ role: 'assistant', content: 'How much is in FDs/RDs in Canara? (combined FD + RD amount)', type: 'text' });
        setStep('bank-canara-fd');
        break;
      }
      case 'bank-canara-fd': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === 'Canara');
          if (idx >= 0) banks[idx].fd = val;
          return { ...prev, banks };
        });
        askBankOther();
        break;
      }
      // Other banks
      case 'bank-other-name': {
        setCurrentBankName(input);
        setData(prev => {
          const banks = [...prev.banks];
          banks.push({ name: input, balance: 0, fd: 0, rd: 0 });
          return { ...prev, banks };
        });
        addMessage({ role: 'assistant', content: `What is your ${input} bank balance?`, type: 'text' });
        setStep('bank-other-balance');
        break;
      }
      case 'bank-other-balance': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === currentBankName);
          if (idx >= 0) banks[idx].balance = val;
          return { ...prev, banks };
        });
        addMessage({ role: 'assistant', content: `How much is in FDs/RDs in ${currentBankName}? (combined FD + RD amount)`, type: 'text' });
        setStep('bank-other-fd');
        break;
      }
      case 'bank-other-fd': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const banks = [...prev.banks];
          const idx = banks.findIndex(b => b.name === currentBankName);
          if (idx >= 0) banks[idx].fd = val;
          return { ...prev, banks };
        });
        askBankAnother();
        break;
      }
      // Other assets
      case 'endowment': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, endowmentPlans: val }));
        addMessage({ role: 'assistant', content: 'How much do you have in NPS? (Enter 0 if none)', type: 'text' });
        setStep('nps');
        break;
      }
      case 'nps': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, nps: val }));
        addMessage({ role: 'assistant', content: 'How much do you have in EPF? (Enter 0 if none)', type: 'text' });
        setStep('epf');
        break;
      }
      case 'epf': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, epf: val }));
        addMessage({ role: 'assistant', content: 'How much do you have in PPF? (Enter 0 if none)', type: 'text' });
        setStep('ppf');
        break;
      }
      case 'ppf': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, ppf: val }));
        addMessage({ role: 'assistant', content: 'How much do you have in ULIP? (Enter 0 if none)', type: 'text' });
        setStep('ulip');
        break;
      }
      case 'ulip': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, ulip: val }));
        addMessage({ role: 'assistant', content: 'What is the current value of your Real Estate? (Enter 0 if none)', type: 'text' });
        setStep('real-estate');
        break;
      }
      case 'real-estate': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, realEstate: val }));
        addMessage({ role: 'assistant', content: 'How much in Real Estate Funds / REITs? (Enter 0 if none)', type: 'text' });
        setStep('real-estate-funds');
        break;
      }
      case 'real-estate-funds': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, realEstatesFunds: val }));
        addMessage({ role: 'assistant', content: 'How much in Private Equity? (Enter 0 if none)', type: 'text' });
        setStep('private-equity');
        break;
      }
      case 'private-equity': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, privateEquity: val }));
        addMessage({ role: 'assistant', content: 'How much in ESOPs? (Enter 0 if none)', type: 'text' });
        setStep('esops');
        break;
      }
      case 'esops': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, esops: val }));
        addMessage({ role: 'assistant', content: 'How much in Equity PMS? (Enter 0 if none)', type: 'text' });
        setStep('equity-pms');
        break;
      }
      case 'equity-pms': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, equityPms: val }));
        addMessage({ role: 'assistant', content: 'How much in Structured Products (Equity)? (Enter 0 if none)', type: 'text' });
        setStep('structured-products-equity');
        break;
      }
      case 'structured-products-equity': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => ({ ...prev, structuredProductsEquity: val }));
        addMessage({ role: 'assistant', content: 'How much in Structured Products (Debt)? (Enter 0 if none)', type: 'text' });
        setStep('structured-products-debt');
        break;
      }
      case 'structured-products-debt': {
        const val = processAmountInput(input);
        if (val === null) return;
        setData(prev => {
          const updatedData = { ...prev, structuredProductsDebt: val };
          // Show summary after a tick so state is up to date
          setTimeout(() => showSummary(updatedData), 0);
          return updatedData;
        });
        break;
      }
      default:
        break;
    }
  };

  const computeFinalValues = (d: CollectedData) => {
    // Direct Equity = Total Stocks - Gold - Silver
    const directEquity = Math.max(0, d.totalStocks - d.goldInStocks - d.silverInStocks);
    // Gold ETFs/Funds = Gold + Silver
    const goldEtfsFunds = d.goldInStocks + d.silverInStocks;
    // Equity MF = Total MF - Arbitrage
    const equityMutualFunds = Math.max(0, d.totalMutualFunds - d.arbitrageFunds);
    // Debt MF = Arbitrage funds
    const debtMutualFunds = d.arbitrageFunds;
    // Bank balance = sum of all bank balances
    const bankBalance = d.banks.reduce((sum, b) => sum + b.balance, 0);
    // Fixed Deposits = sum of all bank FDs/RDs
    const fixedDeposits = d.banks.reduce((sum, b) => sum + b.fd, 0);

    return {
      direct_equity: directEquity,
      esops: d.esops,
      equity_pms: d.equityPms,
      ulip: d.ulip,
      real_estate: d.realEstate,
      real_estate_funds: d.realEstatesFunds,
      private_equity: d.privateEquity,
      equity_mutual_funds: equityMutualFunds,
      structured_products_equity: d.structuredProductsEquity,
      bank_balance: bankBalance,
      debt_mutual_funds: debtMutualFunds,
      endowment_plans: d.endowmentPlans,
      fixed_deposits: fixedDeposits,
      nps: d.nps,
      epf: d.epf,
      ppf: d.ppf,
      structured_products_debt: d.structuredProductsDebt,
      gold_etfs_funds: goldEtfsFunds,
    };
  };

  const showSummary = (d: CollectedData) => {
    const values = computeFinalValues(d);
    const totalHighMedium =
      values.direct_equity + values.esops + values.equity_pms + values.ulip +
      values.real_estate + values.real_estate_funds + values.private_equity +
      values.equity_mutual_funds + values.structured_products_equity;
    const totalLow =
      values.bank_balance + values.debt_mutual_funds + values.endowment_plans +
      values.fixed_deposits + values.nps + values.epf + values.ppf +
      values.structured_products_debt + values.gold_etfs_funds;
    const totalAssets = totalHighMedium + totalLow;

    const summaryLines = [
      `**Profile:** ${d.profileName}`,
      `**Date:** ${d.entryDate ? formatDate(d.entryDate) : ''}`,
      '',
      '**High/Medium Risk Assets:**',
      `  Direct Equity: ₹${formatIndianNumber(values.direct_equity)}`,
      `  ESOPs: ₹${formatIndianNumber(values.esops)}`,
      `  Equity PMS: ₹${formatIndianNumber(values.equity_pms)}`,
      `  ULIP: ₹${formatIndianNumber(values.ulip)}`,
      `  Real Estate: ₹${formatIndianNumber(values.real_estate)}`,
      `  Real Estate Funds: ₹${formatIndianNumber(values.real_estate_funds)}`,
      `  Private Equity: ₹${formatIndianNumber(values.private_equity)}`,
      `  Equity Mutual Funds: ₹${formatIndianNumber(values.equity_mutual_funds)}`,
      `  Structured Products (Equity): ₹${formatIndianNumber(values.structured_products_equity)}`,
      `  **Subtotal:** ₹${formatIndianNumber(totalHighMedium)}`,
      '',
      '**Low Risk Assets:**',
      `  Bank Balance: ₹${formatIndianNumber(values.bank_balance)}`,
      `  Debt Mutual Funds: ₹${formatIndianNumber(values.debt_mutual_funds)}`,
      `  Endowment Plans: ₹${formatIndianNumber(values.endowment_plans)}`,
      `  Fixed Deposits: ₹${formatIndianNumber(values.fixed_deposits)}`,
      `  NPS: ₹${formatIndianNumber(values.nps)}`,
      `  EPF: ₹${formatIndianNumber(values.epf)}`,
      `  PPF: ₹${formatIndianNumber(values.ppf)}`,
      `  Structured Products (Debt): ₹${formatIndianNumber(values.structured_products_debt)}`,
      `  Gold ETFs/Funds: ₹${formatIndianNumber(values.gold_etfs_funds)}`,
      `  **Subtotal:** ₹${formatIndianNumber(totalLow)}`,
      '',
      `**Total Assets: ₹${formatIndianNumber(totalAssets)}**`,
    ];

    addMessage({ role: 'assistant', content: '✅ Summary', type: 'heading' });
    addMessage({ role: 'assistant', content: summaryLines.join('\n'), type: 'summary' });
    addMessage({ role: 'assistant', content: 'Does this look correct? Should I save this entry?', type: 'yes-no' });
    setStep('confirm-summary');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const saveEntry = async () => {
    setStep('saving');
    addMessage({ role: 'assistant', content: 'Saving your entry...', type: 'text' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addMessage({ role: 'assistant', content: '❌ You need to be logged in. Please log in and try again.', type: 'text' });
        setStep('idle');
        return;
      }

      const values = computeFinalValues(data);
      const profileId = data.profileId!;
      const entryDate = data.entryDate!;

      // First check if an entry already exists for this date
      const checkResponse = await fetch(
        `/api/profiles/${profileId}/entries/by-date?date=${entryDate}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      let response;
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.entry) {
          // Update existing entry
          response = await fetch(`/api/entries/${checkData.entry.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              entry_date: entryDate,
              high_medium_risk: {
                direct_equity: values.direct_equity,
                esops: values.esops,
                equity_pms: values.equity_pms,
                ulip: values.ulip,
                real_estate: values.real_estate,
                real_estate_funds: values.real_estate_funds,
                private_equity: values.private_equity,
                equity_mutual_funds: values.equity_mutual_funds,
                structured_products_equity: values.structured_products_equity,
              },
              low_risk: {
                bank_balance: values.bank_balance,
                debt_mutual_funds: values.debt_mutual_funds,
                endowment_plans: values.endowment_plans,
                fixed_deposits: values.fixed_deposits,
                nps: values.nps,
                epf: values.epf,
                ppf: values.ppf,
                structured_products_debt: values.structured_products_debt,
                gold_etfs_funds: values.gold_etfs_funds,
              },
            }),
          });
        } else {
          // Create new entry
          response = await fetch(`/api/profiles/${profileId}/entries`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              entry_date: entryDate,
              high_medium_risk: {
                direct_equity: values.direct_equity,
                esops: values.esops,
                equity_pms: values.equity_pms,
                ulip: values.ulip,
                real_estate: values.real_estate,
                real_estate_funds: values.real_estate_funds,
                private_equity: values.private_equity,
                equity_mutual_funds: values.equity_mutual_funds,
                structured_products_equity: values.structured_products_equity,
              },
              low_risk: {
                bank_balance: values.bank_balance,
                debt_mutual_funds: values.debt_mutual_funds,
                endowment_plans: values.endowment_plans,
                fixed_deposits: values.fixed_deposits,
                nps: values.nps,
                epf: values.epf,
                ppf: values.ppf,
                structured_products_debt: values.structured_products_debt,
                gold_etfs_funds: values.gold_etfs_funds,
              },
            }),
          });
        }
      } else {
        // Fallback: try to create (will fail with 409 if exists)
        response = await fetch(`/api/profiles/${profileId}/entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            entry_date: entryDate,
            high_medium_risk: {
              direct_equity: values.direct_equity,
              esops: values.esops,
              equity_pms: values.equity_pms,
              ulip: values.ulip,
              real_estate: values.real_estate,
              real_estate_funds: values.real_estate_funds,
              private_equity: values.private_equity,
              equity_mutual_funds: values.equity_mutual_funds,
              structured_products_equity: values.structured_products_equity,
            },
            low_risk: {
              bank_balance: values.bank_balance,
              debt_mutual_funds: values.debt_mutual_funds,
              endowment_plans: values.endowment_plans,
              fixed_deposits: values.fixed_deposits,
              nps: values.nps,
              epf: values.epf,
              ppf: values.ppf,
              structured_products_debt: values.structured_products_debt,
              gold_etfs_funds: values.gold_etfs_funds,
            },
          }),
        });
      }

      if (response && response.ok) {
        addMessage({ role: 'assistant', content: '✅ Entry saved successfully! The page will now refresh with the updated data.', type: 'text' });
        setStep('done');

        // Clear cache and notify parent
        clearAllCache();
        toast({
          title: 'Success',
          description: 'Financial entry saved via assistant',
        });

        // Notify parent to refresh
        if (onEntrySaved) {
          onEntrySaved(profileId, entryDate);
        }

        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const errorData = response ? await response.json() : { error: 'Unknown error' };
        addMessage({ role: 'assistant', content: `❌ Failed to save: ${errorData.error || 'Unknown error'}. Please try again.`, type: 'text' });
        setStep('idle');
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      addMessage({ role: 'assistant', content: '❌ Network error while saving. Please check your connection and try again.', type: 'text' });
      setStep('idle');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextInput();
    }
  };

  // Determine if we should show the text input
  const showTextInput = ![
    'idle', 'select-profile', 'select-date', 'saving', 'done',
    'bank-ask-hdfc', 'bank-ask-sbi', 'bank-ask-icici', 'bank-ask-canara',
    'bank-ask-other', 'bank-ask-another', 'confirm-summary',
  ].includes(step);

  // Context-aware placeholder for the input
  const getPlaceholder = (): string => {
    switch (step) {
      case 'bank-hdfc-fd':
      case 'bank-sbi-fd':
      case 'bank-icici-fd':
      case 'bank-canara-fd':
      case 'bank-other-fd':
        return 'e.g. 14,23,867 + 1,82,000';
      case 'mf-arbitrage':
        return 'e.g. 12,89,502 + 8,64,670';
      case 'endowment':
      case 'nps':
      case 'epf':
      case 'ppf':
        return 'e.g. 8,00,000 or 0';
      default:
        return 'Enter amount (e.g. 13,67,986)';
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            if (step === 'idle' || step === 'done') {
              startConversation();
            }
          }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
          aria-label="Open finance assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] flex flex-col rounded-xl shadow-2xl border bg-background overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">Finance Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (step !== 'idle' && step !== 'done' && messages.length > 2) {
                    // Confirm restart if user is mid-conversation
                    if (!window.confirm('Start over? Your current progress will be lost.')) return;
                  }
                  setMessages([]);
                  setData(getEmptyData());
                  setStep('idle');
                  startConversation();
                }}
                className="px-2 py-1 rounded hover:bg-primary-foreground/20 transition-colors text-xs flex items-center gap-1"
                aria-label="Restart conversation"
                title="Start over"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Restart</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded hover:bg-primary-foreground/20 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.type === 'heading' ? (
                  <div className="text-center my-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                ) : msg.role === 'assistant' ? (
                  <div className="flex gap-2 items-start">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1">
                      {msg.type === 'profile-select' && msg.profileOptions ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground">{msg.content}</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.profileOptions.map(p => (
                              <Button
                                key={p.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleProfileSelect(p)}
                                className="text-xs"
                              >
                                {p.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : msg.type === 'date-picker' ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground">{msg.content}</p>
                          <Card className="p-2">
                            <Calendar
                              mode="single"
                              selected={undefined}
                              onSelect={handleDateSelect}
                              defaultMonth={new Date()}
                              className="w-full"
                            />
                          </Card>
                        </div>
                      ) : msg.type === 'yes-no' ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground">{msg.content}</p>
                          {step !== 'idle' && step !== 'done' && step !== 'saving' && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleYesNo('yes')}
                                className="text-xs"
                              >
                                Yes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleYesNo('no')}
                                className="text-xs"
                              >
                                No
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : msg.type === 'summary' ? (
                        <div className="text-xs bg-muted rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
                          {msg.content.split('\n').map((line, i) => {
                            const isBold = line.startsWith('**') && line.includes(':**');
                            const content = line.replace(/\*\*/g, '');
                            return (
                              <div key={i} className={isBold ? 'font-bold mt-1' : ''}>
                                {content}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 items-start justify-end">
                    <div className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm max-w-[80%]">
                      {msg.content}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {step === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}

            {step === 'done' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Done! Page will refresh shortly.</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {showTextInput && (
            <div className="border-t px-4 py-3">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={getPlaceholder()}
                  className="flex-1 text-sm"
                  autoComplete="off"
                />
                <Button
                  size="icon"
                  onClick={handleTextInput}
                  disabled={!userInput.trim()}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You can use + - * and Indian-style commas
              </p>
            </div>
          )}

          {/* Restart button when done or idle */}
          {(step === 'done' || step === 'idle') && messages.length > 0 && (
            <div className="border-t px-4 py-3">
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() => {
                  setMessages([]);
                  setData(getEmptyData());
                  setStep('idle');
                  startConversation();
                }}
              >
                Start New Entry
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
