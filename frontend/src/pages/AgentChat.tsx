import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { MessageSquare, Send, Bot, User, CheckCircle2, RefreshCw, Zap, ArrowRight, ShieldCheck, Activity, AlertCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  activitySteps?: Array<{ step: string; timestamp: string }>;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  fallbackUsed?: boolean;
}

export const AgentChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your **AI Finance Controller Assistant**.

I am connected directly to your multi-source financial dataset, decision engine, and verified finance tools. Ask me anything about transaction traces, reconciliation decisions, exception details, settlements, cash flow forecasts, or tax verification.`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const suggestedPills = [
    'Why was TXN1001 reconciled as MATCHED?',
    'Why was TXN20288 flagged as EXCEPTION?',
    'How many exceptions are there?',
    'What is today\'s match rate?',
    'How much was settled today?',
    'What is the current cash position?',
    'What is the 30-day cash forecast?',
    'Show tax verification summary',
  ];

  const handleSendMessage = async (promptText: string) => {
    const query = promptText.trim();
    if (!query) return;

    setError(null);
    setInputPrompt('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post('/agent/chat', {
        message: query,
        history,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date().toLocaleTimeString(),
        activitySteps: res.data.activitySteps,
        toolCalls: res.data.toolCalls,
        fallbackUsed: res.data.fallbackUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'AI Finance Controller Agent execution failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bot className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>Finance Controller AI Assistant</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Ask natural-language questions, investigate transaction traces, or orchestrate financial tasks using verified tools.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm shrink-0">
          {error}
        </div>
      )}

      {/* Chat Messages Container */}
      <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 overflow-y-auto space-y-6 shadow-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
                <Bot className="w-5 h-5" />
              </div>
            )}

            <div className={`max-w-2xl space-y-3 ${msg.role === 'user' ? 'bg-brand-600 text-white p-4 rounded-2xl rounded-tr-xs shadow-md' : 'bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white p-5 rounded-2xl rounded-tl-xs border border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between text-xs opacity-75 border-b border-white/10 dark:border-gray-700 pb-1 mb-2">
                <span className="font-semibold">{msg.role === 'user' ? 'You' : 'AI Finance Controller'}</span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Message Content */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {msg.content}
              </div>

              {/* Agent Activity Steps Panel */}
              {msg.activitySteps && msg.activitySteps.length > 0 && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400 font-semibold uppercase">
                    <Activity className="w-3.5 h-3.5 text-brand-500" />
                    <span>Agent Operational Activity Steps</span>
                  </div>
                  <div className="space-y-1 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
                    {msg.activitySteps.map((act, idx) => (
                      <div key={idx} className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{act.step}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{act.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tool Execution Badges */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Verified Tools Called:</span>
                  {msg.toolCalls.map((tc, idx) => (
                    <span key={idx} className="text-[11px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                      ⚙ {tc.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-sm shrink-0">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {/* Live Loading Spinner */}
        {loading && (
          <div className="flex gap-4 justify-start">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl rounded-tl-xs border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                AI Finance Controller is selecting tools and executing database query...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Pills & Input Form */}
      <div className="space-y-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-semibold text-gray-400 shrink-0">Suggested Questions:</span>
          {suggestedPills.map((pill, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(pill)}
              disabled={loading}
              className="text-xs bg-white dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              {pill}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputPrompt);
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask your AI Finance Controller..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
