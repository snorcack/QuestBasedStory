import React, { useState, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Copy,
  Check,
  Cpu,
  Terminal,
  Clock,
  Sparkles,
  Server,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface DebugStatus {
  server_status: string;
  timestamp: string;
  active_threads: string[];
  llm_diagnostics: {
    backend: string;
    model_name: string;
    fallback_model: string;
    project: string;
    location: string;
    credentials_path: string;
    credentials_found: boolean;
    allow_mock_fallback: boolean;
    warnings: string[];
    errors: string[];
  };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  category: 'API' | 'Pipeline' | 'LLM' | 'System';
  message: string;
  details?: any;
}

export const DebugView: React.FC = () => {
  const { lastError, clearError } = useStoryStore();

  // Status & diagnostics
  const [statusData, setStatusData] = useState<DebugStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Prompt playground
  const [prompt, setPrompt] = useState('Tell me the opening sentence for a cyber-noir mystery in 15 words.');
  const [systemPrompt, setSystemPrompt] = useState('You are a creative narrative designer.');
  const [backendOverride, setBackendOverride] = useState<string>('');
  const [modelOverride, setModelOverride] = useState<string>('');
  const [temperature, setTemperature] = useState(0.7);
  const [jsonMode, setJsonMode] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    response: string | null;
    latency_ms: number;
    backend: string;
    model: string;
    error: string | null;
    hint: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Diagnostic logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'WARNING' | 'LLM'>('ALL');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);

  // Fetch status
  const fetchStatus = async () => {
    setIsStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/debug/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setStatusData(data);
    } catch (e: any) {
      setStatusError(e.message || 'Failed to connect to API server.');
    } finally {
      setIsStatusLoading(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/debug/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  // Clear logs
  const handleClearLogs = async () => {
    try {
      await fetch('/api/debug/clear-logs', { method: 'POST' });
      fetchLogs();
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  };

  // Run test prompt
  const handleRunPrompt = async () => {
    if (!prompt.trim()) return;
    setIsExecuting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/debug/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_prompt: prompt,
          system_prompt: systemPrompt,
          temperature,
          json_mode: jsonMode,
          backend: backendOverride || null,
          model: modelOverride || null,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      fetchLogs();
    } catch (e: any) {
      setTestResult({
        success: false,
        response: null,
        latency_ms: 0,
        backend: backendOverride || 'unknown',
        model: modelOverride || 'unknown',
        error: e.message || 'Network request failed. Is the API server running?',
        hint: 'Verify that the FastAPI server is running at http://127.0.0.1:8000',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyResponse = () => {
    if (testResult?.response) {
      navigator.clipboard.writeText(testResult.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs]);

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'ERROR') return log.level === 'ERROR';
    if (logFilter === 'WARNING') return log.level === 'WARNING';
    if (logFilter === 'LLM') return log.category === 'LLM';
    return true;
  });

  const isServerOnline = !statusError && statusData?.server_status === 'online';
  const diag = statusData?.llm_diagnostics;

  return (
    <div className="h-full flex flex-col bg-[#060911] text-slate-200 overflow-y-auto p-6 space-y-6">
      {/* 1. Top API Status & Diagnostics Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                isServerOnline ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-rose-500 shadow-lg shadow-rose-500/50'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">QuestForge API & Diagnostics</h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isServerOnline
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold'
                  }`}
                >
                  {isServerOnline ? 'SERVER ONLINE' : 'SERVER OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Endpoint: <span className="font-mono text-slate-300">http://127.0.0.1:8000</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchStatus();
                fetchLogs();
              }}
              disabled={isStatusLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all shadow-sm"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isStatusLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Global Errors Banner (if any pipeline failure occurred) */}
        {lastError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start justify-between gap-3 text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-rose-300">Pipeline Execution Error</p>
                <p className="text-xs font-mono text-rose-200 mt-0.5 break-all">{lastError}</p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-xs text-rose-400 hover:text-rose-200 px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Configuration Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 text-xs font-mono">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">LLM Backend</span>
            <span className="font-semibold text-blue-400">{diag?.backend || 'vertex_ai'}</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Active Model</span>
            <span className="font-semibold text-slate-200 truncate block" title={diag?.model_name}>
              {diag?.model_name || 'xAi/grok-4.3'}
            </span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Fallback Model</span>
            <span className="font-semibold text-slate-300 truncate block">{diag?.fallback_model || 'gemini-3.1-flash'}</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">GCP Project</span>
            <span className="font-semibold text-slate-300 truncate block">{diag?.project || 'none'}</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Region / Location</span>
            <span
              className={`font-semibold truncate block ${
                diag?.location?.toLowerCase() === 'global' ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {diag?.location || 'global'}
            </span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Credentials File</span>
            <span
              className={`font-semibold truncate block ${
                diag?.credentials_found ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {diag?.credentials_found ? 'Found' : 'Not on disk'}
            </span>
          </div>
        </div>

        {/* Actionable Diagnostics Warnings */}
        {diag && (diag.errors.length > 0 || diag.warnings.length > 0) && (
          <div className="mt-4 space-y-2">
            {diag.errors.map((err, idx) => (
              <div
                key={`err-${idx}`}
                className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">Configuration Notice: </span>
                  <span>{err}</span>
                </div>
              </div>
            ))}
            {diag.warnings.map((warn, idx) => (
              <div
                key={`warn-${idx}`}
                className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-start gap-2.5 text-xs text-slate-300"
              >
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Main Split Area: Left (Prompt Test Window) & Right (Live Logs & Errors) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Prompt Testing Window (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">LLM Prompt Test Window</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Direct API Playground</span>
            </div>

            {/* Presets Bar */}
            <div className="flex items-center gap-2 py-3 overflow-x-auto">
              <span className="text-[11px] text-slate-400 shrink-0">Presets:</span>
              <button
                onClick={() => {
                  setPrompt("Say 'QuestForge pipeline operational' in exactly 5 words.");
                  setSystemPrompt('You are a concise system helper.');
                  setJsonMode(false);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all shrink-0"
              >
                Quick Ping
              </button>
              <button
                onClick={() => {
                  setPrompt('Outline a 3-act story arc for a detective solving an encrypted cyber-heist.');
                  setSystemPrompt('You are an expert narrative architect.');
                  setJsonMode(false);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all shrink-0"
              >
                Story Arc Test
              </button>
              <button
                onClick={() => {
                  setPrompt('Generate a single quest object with: quest_id, title, objective, and reward_flags array.');
                  setSystemPrompt('You are a structured game data designer.');
                  setJsonMode(true);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all shrink-0"
              >
                JSON Quest Test
              </button>
            </div>

            {/* Test Configuration Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Backend Override</label>
                <select
                  value={backendOverride}
                  onChange={(e) => setBackendOverride(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="">Default (.env)</option>
                  <option value="vertex_ai">Vertex AI</option>
                  <option value="gemini_api">Gemini API</option>
                  <option value="mock">Offline Mock</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Model Override</label>
                <input
                  type="text"
                  value={modelOverride}
                  onChange={(e) => setModelOverride(e.target.value)}
                  placeholder="e.g. gemini-2.0-flash"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Temp: <span className="font-mono text-indigo-300">{temperature}</span>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full mt-1.5 accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={jsonMode}
                    onChange={(e) => setJsonMode(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>JSON Mode</span>
                </label>
              </div>
            </div>

            {/* System Prompt (collapsible) */}
            <div className="mt-2">
              <label className="text-[10px] text-slate-500 block mb-1">System Prompt / Instruction</label>
              <input
                type="text"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
              />
            </div>

            {/* User Prompt */}
            <div className="mt-3 flex-1 flex flex-col">
              <label className="text-[10px] text-slate-500 block mb-1">User Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-none font-mono placeholder:text-slate-600"
                placeholder="Type your prompt here..."
              />
            </div>

            {/* Execute Button */}
            <div className="flex items-center justify-between mt-3 pt-2">
              <span className="text-[11px] text-slate-500">
                Tests response directly against the selected backend without advancing state.
              </span>
              <button
                onClick={handleRunPrompt}
                disabled={isExecuting || !prompt.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* Prompt Output Response Display */}
            {testResult && (
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> 200 OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                        <XCircle className="w-4 h-4" /> Request Failed
                      </span>
                    )}
                    <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {testResult.latency_ms} ms
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {testResult.backend} ({testResult.model})
                    </span>
                  </div>

                  {testResult.response && (
                    <button
                      onClick={copyResponse}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {/* Error Box with Actionable Hint */}
                {!testResult.success && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2">
                    <p className="font-mono text-rose-300 break-words">{testResult.error}</p>
                    {testResult.hint && (
                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-rose-500/20 text-slate-200 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-300">Diagnostic Suggestion: </span>
                          <span>{testResult.hint}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Successful Response Content */}
                {testResult.response && (
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {testResult.response}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Diagnostic Activity & Error Logs (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Recent Server & Error Logs</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearLogs}
                  className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-all"
                  title="Clear log buffer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60 text-xs">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'ERROR', 'WARNING', 'LLM'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      logFilter === filter ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshLogs}
                  onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Auto-poll (3s)</span>
              </label>
            </div>

            {/* Logs List */}
            <div className="mt-3 flex-1 overflow-y-auto space-y-2 max-h-[520px] pr-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">No log entries recorded yet.</div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      log.level === 'ERROR'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : log.level === 'WARNING'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-slate-950/70 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            log.level === 'ERROR'
                              ? 'bg-rose-500/20 text-rose-300'
                              : log.level === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {log.level}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-800/80 text-slate-400 px-1.5 py-0.2 rounded">
                          {log.category}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{log.timestamp}</span>
                    </div>

                    <p className="font-mono text-xs leading-relaxed break-words">{log.message}</p>

                    {log.details && (
                      <details className="mt-1.5 pt-1 border-t border-slate-800/50">
                        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                          View details
                        </summary>
                        <pre className="mt-1 p-2 rounded bg-slate-950 text-[10px] font-mono text-slate-400 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
