import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  RotateCcw,
  Sparkles,
  Globe,
  AlertCircle,
  HelpCircle,
  ShoppingBag,
  Layers,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

// ============================================================================
// CONFIGURATION: PJ Web Development WhatsApp Number
// The destination that receives all incoming customer leads
// ============================================================================
export const PJ_WHATSAPP_NUMBER = "27610140065";

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

interface ProjectSummaryData {
  customer: string;
  business: string;
  businessType: string;
  location: string;
  whatsapp: string;
  websiteGoal: string;
  requestedFeatures: string;
  recommendedPackage: string;
  additionalRequirements: string;
  isValidWhatsApp: boolean;
  rawText: string;
}

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.477-.15-.678.15-.2.301-.778.978-.954 1.179-.176.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.501-1.786-1.677-2.087-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.176.201-.301.301-.502.1-.2.05-.376-.025-.527-.075-.15-.678-1.635-.929-2.241-.244-.588-.493-.509-.678-.518l-.578-.01c-.2 0-.527.075-.803.376-.276.301-1.054 1.03-1.054 2.513 0 1.482 1.079 2.912 1.23 3.113.15.201 2.124 3.243 5.145 4.549.719.311 1.28.497 1.718.636.722.23 1.379.198 1.9-.12.58-.354 1.78-7.27 2.03-1.431.25-.703.25-1.305.176-1.431-.075-.126-.276-.201-.577-.351zm-5.467 7.618h-.008c-1.803 0-3.571-.486-5.115-1.405l-.366-.218-3.805.998 1.016-3.71-.238-.379c-1.01-1.606-1.543-3.468-1.543-5.38 0-5.568 4.53-10.098 10.103-10.098 2.697 0 5.232 1.05 7.14 2.959 1.908 1.908 2.959 4.444 2.958 7.143-.002 5.569-4.532 10.09-10.045 10.09zm8.56-18.654C18.297 1.082 15.26 0 12.005 0 5.386 0 .002 5.384 0 12.003c0 2.114.552 4.179 1.6 6l-1.7 6.208 6.353-1.666c1.748.953 3.719 1.455 5.748 1.455h.005c6.618 0 12-5.385 12.003-12.005 0-3.206-1.25-6.22-3.444-8.649z" />
    </svg>
  );
}

function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  // Normalize South African 10-digit mobile (e.g. 0610140065 -> +27610140065)
  if (/^0[6-8][0-9]{8}$/.test(digits)) {
    return '+27' + digits.slice(1);
  }
  if (/^27[6-8][0-9]{8}$/.test(digits)) {
    return '+' + digits;
  }
  return trimmed;
}

function isDummyPhoneNumber(digits: string): boolean {
  if (!digits || digits.length < 7) return true;
  // All identical digits e.g. 0000000000, 1111111111
  if (/^(\d)\1+$/.test(digits)) return true;
  // Obvious placeholder sequences e.g. 1234567890, 0123456789, 9876543210
  if (digits === '1234567890' || digits === '0123456789' || digits === '9876543210') return true;
  return false;
}

function formatFeaturesBlock(features: string): string {
  if (!features || features === 'Not specified') return '- None';
  if (features.includes('\n-') || features.startsWith('- ') || features.startsWith('* ')) {
    return features
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => (line.startsWith('- ') ? line : `- ${line.replace(/^[-*•]\s*/, '')}`))
      .join('\n');
  }
  const items = features
    .split(/[,;\n]+/)
    .map(s => s.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean);
  if (items.length > 0) {
    return items.map(item => `- ${item}`).join('\n');
  }
  return `- ${features}`;
}

function parseProjectSummary(content: string): ProjectSummaryData | null {
  if (!content.toUpperCase().includes('PROJECT SUMMARY')) {
    return null;
  }

  const getField = (fieldNames: string[], nextFieldNames: string[] = []): string => {
    const cleanVal = (val: string) => val.replace(/Perfect![\s\S]*$/i, '').replace(/[\*\_]/g, '').trim();

    for (const name of fieldNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const startRegex = new RegExp(`(?:^|\\n)[\\*\\s-]*\\**${escaped}\\**\\s*:(?:\\s*(.*))?`, 'i');
      const match = content.match(startRegex);
      if (match && match.index !== undefined) {
        const firstLine = (match[1] || '').trim();

        // If nextFieldNames are provided, capture the block until the next field header
        if (nextFieldNames.length > 0) {
          const afterMatch = content.slice(match.index + match[0].length);
          const nextRegexStr = `(?:^|\\n)[\\*\\s-]*\\**(?:${nextFieldNames.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\**\\s*:`;
          const nextMatch = afterMatch.match(new RegExp(nextRegexStr, 'i'));
          const block = nextMatch && nextMatch.index !== undefined ? afterMatch.slice(0, nextMatch.index) : afterMatch;

          const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean);
          if (firstLine) {
            const combined = rawLines.length === 0 ? firstLine : [firstLine, ...rawLines].join('\n');
            return cleanVal(combined);
          }
          if (rawLines.length > 0) {
            return cleanVal(rawLines.join('\n'));
          }
        }

        if (firstLine) {
          return cleanVal(firstLine);
        }
      }
    }
    return '';
  };

  const customer = getField(['Customer', 'Customer name', 'Name']);
  const business = getField(['Business', 'Business name', 'Company']);
  const businessType = getField(['Business type', 'Type of business', 'Industry']);
  const location = getField(['Location', 'City/location', 'City / Location', 'City']);
  const whatsapp = getField(['Customer WhatsApp', 'WhatsApp', 'WhatsApp number', 'Phone', 'Phone number']);
  const websiteGoal = getField(['Website goal', 'Goal', 'Website goals', 'Purpose'], ['Requested features', 'Features', 'Recommended package']);
  const requestedFeatures = getField(['Requested features', 'Important features', 'Features'], ['Recommended package', 'Package recommended', 'Package', 'Additional requirements', 'Perfect!']);
  const recommendedPackage = getField(['Recommended package', 'Package recommended', 'Package']);
  const additionalRequirements = getField(['Additional requirements', 'Additional notes', 'Requirements', 'Notes'], ['Perfect!']);

  const rawWhatsApp = whatsapp.trim();
  const digitsOnly = rawWhatsApp.replace(/[^0-9]/g, '');
  const isPlaceholder =
    !rawWhatsApp ||
    /\[.*\]/.test(rawWhatsApp) ||
    rawWhatsApp.toLowerCase().includes('not provided') ||
    rawWhatsApp.toLowerCase().includes('pending') ||
    rawWhatsApp.toLowerCase().includes('none') ||
    isDummyPhoneNumber(digitsOnly);
  // Accept common South African formats (0610140065, +27610140065, 27610140065) and any valid number >= 7 digits
  const isValidWhatsApp = digitsOnly.length >= 7 && !isPlaceholder;
  const formattedWhatsApp = isValidWhatsApp ? normalizePhoneNumber(rawWhatsApp) : rawWhatsApp;

  return {
    customer: customer || 'Not specified',
    business: business || 'Not specified',
    businessType: businessType || 'Not specified',
    location: location || 'Not specified',
    whatsapp: formattedWhatsApp || '',
    websiteGoal: websiteGoal || 'Not specified',
    requestedFeatures: requestedFeatures || 'Not specified',
    recommendedPackage: recommendedPackage || 'Not specified',
    additionalRequirements: additionalRequirements || 'None',
    isValidWhatsApp,
    rawText: content,
  };
}

function getMissingSummaryFields(data: ProjectSummaryData): string[] {
  const missing: string[] = [];
  const isInvalid = (val: string) => !val || val === 'Not specified' || val.trim() === '';

  if (isInvalid(data.customer)) missing.push('Customer name');
  if (isInvalid(data.business)) missing.push('Business name');
  if (isInvalid(data.businessType)) missing.push('Business type');
  if (isInvalid(data.location)) missing.push('Location');
  if (!data.isValidWhatsApp || isInvalid(data.whatsapp)) missing.push('Valid WhatsApp number');
  if (isInvalid(data.websiteGoal)) missing.push('Website goal');
  if (isInvalid(data.requestedFeatures)) missing.push('Requested features');
  if (isInvalid(data.recommendedPackage)) missing.push('Recommended package');

  return missing;
}

function buildWhatsAppMessage(data: ProjectSummaryData): string {
  const featuresBlock = formatFeaturesBlock(data.requestedFeatures);
  return `🔥 NEW WEBSITE LEAD

Customer: ${data.customer}
Business: ${data.business}
Business type: ${data.businessType}
Location: ${data.location}
Customer WhatsApp: ${data.whatsapp}

Website goal:
${data.websiteGoal}

Requested features:
${featuresBlock}

Recommended package:
${data.recommendedPackage}

Additional requirements:
${data.additionalRequirements}

Please contact this customer to discuss the project.`;
}

function extractFeaturesArray(features: string): string[] {
  if (!features || features === 'Not specified') return [];
  return features
    .split(/[\n,;]+/)
    .map((f) => f.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean);
}

interface LeadSaveState {
  status: 'idle' | 'saving' | 'saved' | 'failed';
  leadId?: string;
  error?: string;
}

function buildWhatsAppUrl(messageText: string): string {
  const encodedText = encodeURIComponent(messageText);
  return `https://wa.me/${PJ_WHATSAPP_NUMBER}?text=${encodedText}`;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome-msg',
  role: 'model',
  content:
    "Hello! 👋 I'm the PJ Web Development Assistant.\n\nWhether you're looking to build your first website, revamp an existing one, or just explore what type of site fits your business best, I'm here to help. What kind of project do you have in mind?",
  timestamp: 'Just now',
};

const FRIENDLY_ERROR_MESSAGE = "I'm having a temporary connection problem. Please try again in a moment.";

const SUGGESTIONS = [
  {
    icon: <Globe className="w-4 h-4 text-blue-500" />,
    text: "I need a website for my business",
  },
  {
    icon: <Layers className="w-4 h-4 text-emerald-500" />,
    text: "What website packages do you offer?",
  },
  {
    icon: <HelpCircle className="w-4 h-4 text-purple-500" />,
    text: "I don't know what kind of website I need",
  },
  {
    icon: <ShoppingBag className="w-4 h-4 text-amber-500" />,
    text: "Can you help me choose the right package?",
  },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openingWhatsAppId, setOpeningWhatsAppId] = useState<string | null>(null);
  const [sentConfirmedId, setSentConfirmedId] = useState<string | null>(null);
  const [leadSaveStates, setLeadSaveStates] = useState<Record<string, LeadSaveState>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const saveLeadToCloud = async (messageId: string, summary: ProjectSummaryData) => {
    // Prevent duplicate saves for the same project summary
    const current = leadSaveStates[messageId];
    if (current?.status === 'saving' || current?.status === 'saved') {
      return;
    }

    setLeadSaveStates((prev) => ({
      ...prev,
      [messageId]: { status: 'saving' },
    }));

    try {
      const features = extractFeaturesArray(summary.requestedFeatures);
      let pkg: 'Starter' | 'Business' | 'Premium' = 'Business';
      const pkgStr = summary.recommendedPackage.toLowerCase();
      if (pkgStr.includes('starter')) pkg = 'Starter';
      else if (pkgStr.includes('premium')) pkg = 'Premium';

      const payload = {
        customer_name: summary.customer,
        business_name: summary.business,
        business_type: summary.businessType,
        location: summary.location,
        customer_whatsapp: summary.whatsapp,
        website_goal: summary.websiteGoal,
        requested_features: features,
        recommended_package: pkg,
        additional_requirements: summary.additionalRequirements || 'None',
      };

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Save failed');
      }

      const data = await res.json();
      setLeadSaveStates((prev) => ({
        ...prev,
        [messageId]: { status: 'saved', leadId: data.lead?.id },
      }));
    } catch (err) {
      console.error('Lead cloud save error:', err);
      setLeadSaveStates((prev) => ({
        ...prev,
        [messageId]: { status: 'failed' },
      }));
    }
  };

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'model') {
        const summary = parseProjectSummary(msg.content);
        if (summary) {
          const missing = getMissingSummaryFields(summary);
          if (missing.length === 0 && !leadSaveStates[msg.id]) {
            saveLeadToCloud(msg.id, summary);
          }
        }
      }
    }
  }, [messages, leadSaveStates]);

  const handleCopySummary = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 2500);
    } catch (err) {
      console.error('Failed to copy summary:', err);
    }
  };

  const handleSendToWhatsApp = (id: string, url: string, summary?: ProjectSummaryData) => {
    if (openingWhatsAppId) return; // Prevent duplicate clicks while opening

    // Trigger save if not yet saved (in background, does not block WhatsApp)
    if (summary && leadSaveStates[id]?.status !== 'saved') {
      saveLeadToCloud(id, summary);
    }

    setOpeningWhatsAppId(id);
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      setSentConfirmedId(id);
    } catch (err) {
      console.error('Failed to open WhatsApp URL:', err);
    } finally {
      setTimeout(() => {
        setOpeningWhatsAppId(null);
      }, 1500);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    // Prevent duplicate requests while loading
    if (isLoading) return;

    const text = (textToSend || input).trim();
    if (!text) return;

    setError(null);
    setLastFailedMessage(null);
    setInput('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Exclude the initial welcome message from the Gemini history payload to keep context clean
      const historyPayload = newMessages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(0, -1) // All messages up to the one just added
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(FRIENDLY_ERROR_MESSAGE);
      }

      const data = await response.json();
      if (!data || !data.reply) {
        throw new Error(FRIENDLY_ERROR_MESSAGE);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
      setLastFailedMessage(null);
      setError(null);
    } catch (err: any) {
      console.error('Chat error:', err);
      // Do not expose raw JSON or technical errors to the customer
      setError(FRIENDLY_ERROR_MESSAGE);
      setLastFailedMessage(text);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleRetry = async () => {
    if (isLoading || !lastFailedMessage) return;

    setError(null);
    setIsLoading(true);

    try {
      // The user message is already in `messages` list; history contains all prior messages
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(0, -1)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: lastFailedMessage,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(FRIENDLY_ERROR_MESSAGE);
      }

      const data = await response.json();
      if (!data || !data.reply) {
        throw new Error(FRIENDLY_ERROR_MESSAGE);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
      setLastFailedMessage(null);
      setError(null);
    } catch (err: any) {
      console.error('Retry error:', err);
      setError(FRIENDLY_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        handleSend();
      }
    }
  };

  const handleResetConversation = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setError(null);
    setLastFailedMessage(null);
    setSentConfirmedId(null);
    setOpeningWhatsAppId(null);
    inputRef.current?.focus();
  };

  // Simple Markdown formatter for clean reading (bold, lists, linebreaks)
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');

    return (
      <div className="space-y-2 text-[15px] leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (!trimmed) {
            return <div key={idx} className="h-1" />;
          }

          // Bullet points
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            const bulletText = trimmed.replace(/^[\*\-•]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-blue-500 mt-1 font-bold text-xs">●</span>
                <span>{renderInlineStyles(bulletText)}</span>
              </div>
            );
          }

          // Numbered lists (e.g. 1. or 2.)
          const numberedMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
          if (numberedMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="font-semibold text-blue-600 min-w-[1.2rem] text-sm">{numberedMatch[1]}.</span>
                <span>{renderInlineStyles(numberedMatch[2])}</span>
              </div>
            );
          }

          return <p key={idx}>{renderInlineStyles(trimmed)}</p>;
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string) => {
    // Splits on **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs z-10 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/pj-web-development-logo.webp"
              alt="PJ Web Development"
              className="w-10 h-10 rounded-xl object-cover shadow-md shadow-orange-500/20"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
                  PJ Web Development
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Assistant Online
                </span>
              </div>
              <p className="text-xs text-slate-500">
                PJ Web Development Assistant &bull; Website Advisor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetConversation}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors"
              title="Start a new conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Conversation</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl w-full mx-auto">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-100 rounded-2xl p-4 sm:p-5 text-sm text-slate-700 mb-6 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-slate-900 text-base">
                Welcome to PJ Web Development
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                Need a new website or wondering what solution works best for your business? Chat with our virtual assistant to explore design options, functionality, and recommendations.
              </p>
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="space-y-5">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span
                      className={`text-[11px] font-semibold tracking-wide uppercase ${
                        isUser ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {isUser ? 'You' : 'PJ Assistant'}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isUser ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {message.timestamp}
                    </span>
                  </div>

                  {isUser ? (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    <>
                      {renderFormattedText(message.content)}
                      {(() => {
                        const summaryData = parseProjectSummary(message.content);
                        if (!summaryData) return null;

                        const missingFields = getMissingSummaryFields(summaryData);
                        const isComplete = missingFields.length === 0;
                        const whatsappMessage = buildWhatsAppMessage(summaryData);
                        const whatsappUrl = buildWhatsAppUrl(whatsappMessage);
                        const isOpening = openingWhatsAppId === message.id;
                        const hasConfirmed = sentConfirmedId === message.id;
                        const saveState = leadSaveStates[message.id];

                        return (
                          <div className="mt-4 pt-3.5 border-t border-slate-200/90 space-y-3">
                            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3.5 space-y-2.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs sm:text-sm">
                                  <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Send Project Details to PJ Web Development</span>
                                </div>
                                {isComplete && saveState?.status === 'saved' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full font-medium shadow-2xs">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    Lead saved ✓
                                  </span>
                                )}
                                {isComplete && saveState?.status === 'failed' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full font-medium shadow-2xs">
                                    Cloud save unavailable
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-emerald-700 leading-relaxed">
                                Ready to continue? Tap below to open WhatsApp addressed to PJ Web Development (<span className="font-semibold">+27 61 014 0065</span>) with your complete project details pre-filled.
                              </p>

                              {isComplete && saveState?.status === 'failed' && (
                                <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <p className="leading-relaxed">
                                    Your project summary is ready, but I couldn't save a cloud copy right now. You can still copy the summary or send it through WhatsApp.
                                  </p>
                                </div>
                              )}

                              {!isComplete && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-amber-900">Project details incomplete</p>
                                    <p className="text-amber-700 mt-0.5 leading-relaxed">
                                      Missing: {missingFields.join(', ')}. Please provide these details in the chat before sending.
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                {isComplete ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSendToWhatsApp(message.id, whatsappUrl, summaryData)}
                                    disabled={isOpening}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-xs disabled:opacity-75 disabled:cursor-wait"
                                  >
                                    <WhatsAppIcon className="w-4 h-4 fill-current" />
                                    <span>{isOpening ? 'Opening WhatsApp...' : 'Send to WhatsApp'}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-400 rounded-xl font-medium text-xs sm:text-sm cursor-not-allowed shadow-none"
                                    title={`Missing: ${missingFields.join(', ')}`}
                                  >
                                    <WhatsAppIcon className="w-4 h-4 fill-current opacity-50" />
                                    <span>Send to WhatsApp</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCopySummary(message.id, whatsappMessage)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-2xs"
                                >
                                  {copiedId === message.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="text-emerald-700 font-medium">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Copy Summary</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {hasConfirmed && (
                                <div className="flex items-center gap-2 p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-medium">
                                  <span>WhatsApp opened with your project details ready to send. 👍</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-xs mt-1 font-semibold text-xs">
                    You
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                </div>
                <span className="text-xs text-slate-500 font-medium pl-1">
                  PJ Assistant is thinking...
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="font-medium text-red-800">Connection notice</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
              {lastFailedMessage && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="text-xs font-semibold bg-red-100 hover:bg-red-200 active:bg-red-300 px-3 py-1.5 rounded-lg transition-colors text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips (shown when few messages) */}
        {messages.length <= 2 && !isLoading && (
          <div className="pt-2">
            <p className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
              <span>Suggested questions to get started:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => !isLoading && handleSend(item.text)}
                  className="flex items-center gap-2.5 text-left p-2.5 rounded-xl bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-xs text-slate-700 hover:text-blue-900 transition-all shadow-xs group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-1 rounded-md bg-slate-50 group-hover:bg-white shrink-0">
                    {item.icon}
                  </div>
                  <span className="line-clamp-2">{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isLoading && input.trim()) {
                handleSend();
              }
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about website options, tell us about your business, or describe your project..."
                rows={1}
                disabled={isLoading}
                className="w-full resize-none rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all max-h-32 min-h-[44px] disabled:bg-slate-50 disabled:text-slate-400"
                style={{ height: 'auto', minHeight: '44px' }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0 disabled:cursor-not-allowed"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
            <span>Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono">Shift+Enter</kbd> for a new line</span>
            <span className="hidden sm:inline">Powered by Gemini &bull; PJ Web Development</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
