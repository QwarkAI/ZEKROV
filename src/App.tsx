import React, { useState, useRef, useEffect } from 'react';

interface TerminalEntry {
  id: string;
  command?: string;
  response?: string;
  isLoading?: boolean;
  isAgent?: boolean;
  agentSpeaker?: 'CIPHER' | 'NOVA' | 'SYSTEM';
  fileCreated?: {
    name: string;
    path: string;
    content: string;
    size: number;
    author: string;
  };
  bridgeAction?: 'export' | 'key' | 'import';
  accessKey?: string;
  baseUrl?: string;
}

function SourceBridgeCard({
  mode,
  accessKey,
  baseUrl,
  onPatchApplied,
}: {
  mode: 'export' | 'key' | 'import';
  accessKey: string;
  baseUrl?: string;
  onPatchApplied: (message: string) => void;
}) {
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [showImporter, setShowImporter] = useState(mode === 'import');
  const [patchText, setPatchText] = useState('');

  const exportUrl = `/api/sys/export?key=${encodeURIComponent(accessKey)}`;

  const fetchExportPayload = async () => {
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessKey}` },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  };

  const handleDownloadJson = async () => {
    setBusy(true);
    setStatusMsg('Packing workspace source files...');
    try {
      const payload = await fetchExportPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'auraos-codebase-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg(`Downloaded auraos-codebase-export.json (${payload.totalFiles} files).`);
    } catch (err: any) {
      setStatusMsg(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyJson = async () => {
    setBusy(true);
    setStatusMsg('Copying codebase JSON to clipboard...');
    try {
      const payload = await fetchExportPayload();
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatusMsg(`Copied full codebase JSON (${payload.totalFiles} files) to clipboard!`);
    } catch (err: any) {
      setStatusMsg(`Copy failed: ${err?.message || 'Clipboard permission denied'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyPromptBundle = async () => {
    setBusy(true);
    setStatusMsg('Building AI handoff bundle...');
    try {
      const payload = await fetchExportPayload();
      const promptBundle =
        `I am sharing my live AuraOS Web Terminal codebase with you (${payload.totalFiles} files).\n` +
        `Note: The preview URL sits behind a browser-cookie auth proxy, so here is the full exported codebase JSON directly.\n` +
        `When you want to modify or add files back to my live system, return a JSON object in this format so I can apply it with one click:\n` +
        `{\n  "files": [\n    { "path": "src/App.tsx", "content": "..." }\n  ]\n}\n\n` +
        `=== CODEBASE EXPORT JSON ===\n` +
        JSON.stringify(payload, null, 2);

      await navigator.clipboard.writeText(promptBundle);
      setStatusMsg(`Copied AI Handoff Prompt + ${payload.totalFiles} source files to clipboard!`);
    } catch (err: any) {
      setStatusMsg(`Copy failed: ${err?.message || 'Clipboard permission denied'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleApplyPatch = async () => {
    const raw = patchText.trim();
    if (!raw) {
      setStatusMsg('Paste JSON patch payload before applying.');
      return;
    }
    setBusy(true);
    setStatusMsg('Applying changes to live system...');
    try {
      // Strip optional markdown code fences if pasted directly from another AI
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      let filesToWrite: Array<{ path: string; content: string }> = [];

      if (Array.isArray(parsed.files)) {
        filesToWrite = parsed.files;
      } else if (typeof parsed.path === 'string' && typeof parsed.content === 'string') {
        filesToWrite = [{ path: parsed.path, content: parsed.content }];
      } else {
        throw new Error('Expected {"files": [{"path": "...", "content": "..."}]} or {"path": "...", "content": "..."}');
      }

      const res = await fetch('/api/sys/source/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessKey}`,
        },
        body: JSON.stringify({ files: filesToWrite }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Batch write failed');
      }

      const summary = (data.results || [])
        .map((r: any) => `  • ${r.path}: ${r.status}`)
        .join('\n');

      setStatusMsg(`Applied ${data.processed} file(s) to live system!`);
      setPatchText('');
      onPatchApplied(`[BRIDGE PATCH APPLIED]: ${data.processed} file(s) updated.\n${summary}`);
    } catch (err: any) {
      setStatusMsg(`Patch error: ${err?.message || 'Invalid JSON format'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 mb-2 p-3 bg-[#090d16] border border-[#1e293b] rounded font-mono text-xs text-zinc-200 max-w-4xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1e293b]">
        <span className="text-[#38bdf8] font-semibold">
          [SOURCE CODE BRIDGE · BROWSER-AUTHENTICATED GATEWAY]
        </span>
        <span className="text-[11px] text-zinc-400">
          Key: <span className="text-emerald-400">{accessKey}</span>
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleDownloadJson}
          className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] border border-[#38bdf8]/50 text-[#38bdf8] rounded cursor-pointer disabled:opacity-50"
        >
          [Download Codebase JSON]
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={handleCopyJson}
          className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] border border-emerald-500/50 text-emerald-400 rounded cursor-pointer disabled:opacity-50"
        >
          [Copy Full JSON]
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={handleCopyPromptBundle}
          className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] border border-purple-500/50 text-purple-300 rounded cursor-pointer disabled:opacity-50"
        >
          [Copy AI Prompt + Codebase]
        </button>

        <a
          href={exportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] border border-zinc-600 text-zinc-200 rounded inline-block"
        >
          [Open /api/sys/export]
        </a>

        <button
          type="button"
          onClick={() => setShowImporter((v) => !v)}
          className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] border border-amber-500/50 text-amber-300 rounded cursor-pointer"
        >
          {showImporter ? '[Hide Patch Importer]' : '[Apply AI Patch]'}
        </button>
      </div>

      {baseUrl && (baseUrl.includes('ais-dev-') || baseUrl.includes('ais-pre-')) && (
        <div className="mt-2 text-[11px] text-amber-300/90 leading-relaxed">
          Preview domain auth proxy blocks un-cookied external curl requests. Use Download/Copy above to hand the codebase to any AI immediately, and paste its JSON patch back via [Apply AI Patch].
        </div>
      )}

      {showImporter && (
        <div className="mt-3 pt-2.5 border-t border-[#1e293b] space-y-2">
          <div className="text-[11px] text-zinc-400">
            Paste JSON from external AI (e.g.{' '}
            <code className="text-zinc-200">{'{"files":[{"path":"shared/patch.ts","content":"..."}]}'}</code>):
          </div>
          <textarea
            value={patchText}
            onChange={(e) => setPatchText(e.target.value)}
            rows={5}
            placeholder='{"files": [{"path": "shared/example.ts", "content": "// code"}]}'
            className="w-full bg-black border border-zinc-700 rounded p-2 text-zinc-100 text-xs font-mono outline-none focus:border-[#38bdf8] select-text"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleApplyPatch}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 rounded cursor-pointer disabled:opacity-50"
            >
              [Write Changes to Live System]
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="mt-2 text-[11px] text-emerald-300">{`> ${statusMsg}`}</div>
      )}
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'CIPHER' | 'NOVA' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stopAgentsRef = useRef<boolean>(false);

  // Auto-focus input on mount and on any click anywhere on the black screen
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScreenClick = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus();
  };

  // Scroll to bottom when entries update, input changes, or active speaker changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, inputVal, isProcessing, activeSpeaker]);

  const appendEntry = (entry: TerminalEntry) => {
    setEntries((prev) => [...prev, entry]);
  };

  // Multi-agent dialogue orchestrator
  const runAgentSession = async (topic: string) => {
    stopAgentsRef.current = false;
    setIsProcessing(true);

    const topicClean = topic.trim() || 'The future of autonomous operating systems and synthetic intelligence';

    // Announce dual-agent protocol link
    appendEntry({
      id: Math.random().toString(36).substring(7),
      isAgent: true,
      agentSpeaker: 'SYSTEM',
      response:
        `[MULTI-AGENT PROTOCOL INITIALIZED]\n` +
        `Linking Agent 1: CIPHER (Analytical Systems Architect)\n` +
        `Linking Agent 2: NOVA   (Visionary Cyberneticist)\n` +
        `Topic: "${topicClean}"\n` +
        `Live transmission streaming below. Enter '/stop' to halt at any point.`,
    });

    const history: Array<{ speaker: string; text: string }> = [];
    const maxTurns = 6;
    const agents = [
      { name: 'CIPHER', role: 'Pragmatic Systems Architect', other: 'NOVA', otherRole: 'Visionary Cyberneticist' },
      { name: 'NOVA', role: 'Visionary Cyberneticist', other: 'CIPHER', otherRole: 'Pragmatic Systems Architect' },
    ];

    for (let turn = 1; turn <= maxTurns; turn++) {
      if (stopAgentsRef.current) break;

      const currentAgent = agents[(turn - 1) % 2];
      setActiveSpeaker(currentAgent.name as 'CIPHER' | 'NOVA');

      // Realistic typing / thinking delay
      await new Promise((r) => setTimeout(r, 1200));
      if (stopAgentsRef.current) break;

      try {
        const res = await fetch('/api/terminal/agent-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            speaker: currentAgent.name,
            role: currentAgent.role,
            otherSpeaker: currentAgent.other,
            otherRole: currentAgent.otherRole,
            topic: topicClean,
            turn,
            history,
          }),
        });

        const data = await res.json();
        if (stopAgentsRef.current) break;

        let replyText = data.text || '...';
        replyText = replyText.replace(/^\[[A-Za-z0-9_\s-]+\]\s*:?\s*/i, '').replace(/^([A-Za-z0-9_-]+):\s*/i, '').trim();

        history.push({ speaker: currentAgent.name, text: replyText });

        appendEntry({
          id: Math.random().toString(36).substring(7),
          isAgent: true,
          agentSpeaker: currentAgent.name as 'CIPHER' | 'NOVA',
          response: replyText,
          fileCreated: data.fileCreated,
        });
      } catch {
        if (stopAgentsRef.current) break;
      }
    }

    setActiveSpeaker(null);
    setIsProcessing(false);

    if (stopAgentsRef.current) {
      appendEntry({
        id: Math.random().toString(36).substring(7),
        isAgent: true,
        agentSpeaker: 'SYSTEM',
        response: `[PROTOCOL HALTED]: Multi-agent dialogue interrupted by user.`,
      });
    } else {
      appendEntry({
        id: Math.random().toString(36).substring(7),
        isAgent: true,
        agentSpeaker: 'SYSTEM',
        response: `[TRANSMISSION CONCLUDED]: Multi-agent debate cycle finished.\nType '/call <topic>' to initiate another session or ask any question.`,
      });
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Arrow Up: navigate previous commands
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(commandHistory[nextIndex]);
      return;
    }

    // Arrow Down: navigate next commands
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(commandHistory[nextIndex]);
      }
      return;
    }

    // Enter key: execute command
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentCommand = inputVal;
      const trimmed = currentCommand.trim();

      // If agents are running and user typed /stop or pressed Enter with /stop
      if (trimmed === '/stop') {
        stopAgentsRef.current = true;
        setInputVal('');
        setHistoryIndex(-1);
        return;
      }

      if (isProcessing) return;

      // Reset input immediately
      setInputVal('');
      setHistoryIndex(-1);

      if (!trimmed) {
        // Just empty enter: append empty prompt line
        appendEntry({
          id: Math.random().toString(36).substring(7),
          command: '',
          response: '',
        });
        return;
      }

      // Add to command history
      setCommandHistory((prev) => [...prev, trimmed]);

      // Check for local 'clear' command
      if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
        setEntries([]);
        return;
      }

      // Record user command on screen
      const entryId = Math.random().toString(36).substring(7);
      appendEntry({
        id: entryId,
        command: trimmed,
        response: '',
        isLoading: true,
      });

      // Check for /call multi-agent command
      if (trimmed.startsWith('/call')) {
        const topic = trimmed.slice(5).trim();
        // Clear loading state on the command entry
        setEntries((prev) =>
          prev.map((item) => (item.id === entryId ? { ...item, isLoading: false } : item))
        );
        runAgentSession(topic);
        return;
      }

      setIsProcessing(true);

      try {
        // Build history context for single-agent query
        const historyContext = entries
          .filter((item) => !item.isAgent && item.command)
          .map((item) => ({
            command: item.command || '',
            response: item.response || '',
          }));

        const res = await fetch('/api/terminal/command', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command: trimmed,
            history: historyContext,
          }),
        });

        const data = await res.json();
        const reply = data.text || data.fallback || data.error || 'Command executed.';

        setEntries((prev) =>
          prev.map((item) =>
            item.id === entryId
              ? {
                  ...item,
                  response: reply,
                  isLoading: false,
                  bridgeAction: data.bridgeAction,
                  accessKey: data.accessKey,
                  baseUrl: data.baseUrl,
                }
              : item
          )
        );
      } catch (err: any) {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === entryId
              ? {
                  ...item,
                  response: `[Error communicating with terminal AI: ${err.message || 'Network error'}]`,
                  isLoading: false,
                }
              : item
          )
        );
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleScreenClick}
      className="h-screen w-full bg-black text-[#e2e8f0] font-['JetBrains_Mono',monospace] p-4 md:p-6 overflow-y-auto cursor-text select-text"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Terminal History */}
      <div className="space-y-3 max-w-full">
        {entries.map((entry) => (
          <div key={entry.id} className="leading-relaxed">
            {/* Standard User Command Line */}
            {entry.command !== undefined && entry.command !== '' && (
              <div className="flex items-start text-white">
                <span className="text-[#38bdf8] shrink-0 mr-1 select-none font-semibold">{' >>'}</span>
                <span className="whitespace-pre-wrap break-all">{entry.command}</span>
              </div>
            )}

            {/* Standard AI Loading Indicator */}
            {entry.isLoading && (
              <div className="text-zinc-400 pl-4 py-1 flex items-center gap-1 text-sm">
                <span>AI processing</span>
                <span className="terminal-cursor text-[#38bdf8]">_</span>
              </div>
            )}

            {/* Multi-Agent Dialogue Lines */}
            {entry.isAgent ? (
              <div className="py-1">
                {entry.agentSpeaker === 'SYSTEM' ? (
                  <div className="text-[#c084fc] text-sm whitespace-pre-wrap leading-normal border-l-2 border-[#a855f7]/40 pl-3 my-1">
                    {entry.response}
                  </div>
                ) : (
                  <div className="leading-relaxed">
                    <span
                      className={`font-semibold mr-2 shrink-0 ${
                        entry.agentSpeaker === 'CIPHER'
                          ? 'text-[#38bdf8]'
                          : 'text-[#34d399]'
                      }`}
                    >
                      {`[${entry.agentSpeaker}] >>`}
                    </span>
                    <span className="text-zinc-200 whitespace-pre-wrap break-words">
                      {entry.response}
                    </span>

                    {/* Shared File Creation Card */}
                    {entry.fileCreated && (
                      <div className="mt-2 mb-1 p-2.5 bg-[#090d16] border border-[#1e293b] rounded font-mono text-xs">
                        <div className="flex items-center justify-between text-[#38bdf8] pb-1.5 border-b border-[#1e293b]/70">
                          <span className="font-semibold flex items-center gap-1.5">
                            <span className="text-amber-400">[SHARED FILE CREATED]</span>
                            <span className="text-white underline">{entry.fileCreated.path}</span>
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            {entry.fileCreated.size} B · by {entry.fileCreated.author}
                          </span>
                        </div>
                        <div className="mt-2 text-zinc-300 text-[11px] overflow-x-auto max-h-36 p-2 bg-black/60 rounded border border-zinc-800/60 whitespace-pre font-mono">
                          {entry.fileCreated.content}
                        </div>
                        <div className="mt-1.5 text-[11px] text-zinc-500">
                          Shared with peer agent. Inspect anytime via: <span className="text-zinc-300">cat {entry.fileCreated.path}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Standard AI Single Response */
              !entry.isLoading &&
              entry.response && (
                <div className="text-zinc-300 pl-2 md:pl-4 whitespace-pre-wrap break-words py-1 leading-normal">
                  {entry.response}
                  {entry.bridgeAction && entry.accessKey && (
                    <SourceBridgeCard
                      mode={entry.bridgeAction}
                      accessKey={entry.accessKey}
                      baseUrl={entry.baseUrl}
                      onPatchApplied={(msg) =>
                        appendEntry({
                          id: Math.random().toString(36).substring(7),
                          isAgent: true,
                          agentSpeaker: 'SYSTEM',
                          response: msg,
                        })
                      }
                    />
                  )}
                </div>
              )
            )}
          </div>
        ))}

        {/* Active Multi-Agent Thinking Indicator */}
        {activeSpeaker && (
          <div className="py-1 flex items-center gap-1.5 text-sm">
            <span
              className={`font-semibold ${
                activeSpeaker === 'CIPHER' ? 'text-[#38bdf8]' : 'text-[#34d399]'
              }`}
            >
              [{activeSpeaker} is transmitting...]
            </span>
            <span
              className={`terminal-cursor ${
                activeSpeaker === 'CIPHER' ? 'text-[#38bdf8]' : 'text-[#34d399]'
              }`}
            >
              _
            </span>
          </div>
        )}

        {/* Active Input Line */}
        <div className="flex items-center text-white min-h-[1.75rem] relative">
          <span className="text-[#38bdf8] shrink-0 mr-1 select-none font-semibold">{' >>'}</span>
          <span className="whitespace-pre-wrap break-all text-white font-normal">{inputVal}</span>
          <span className="terminal-cursor text-[#38bdf8] ml-[1px]">_</span>

          {/* Invisible controlled input to capture all keyboard typing, IME, mobile keyboards */}
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing && !activeSpeaker}
            autoFocus
            aria-label="Terminal command input"
            className="absolute inset-0 opacity-0 cursor-text w-full h-full bg-transparent border-none outline-none text-transparent"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        <div ref={bottomRef} className="h-6" />
      </div>
    </div>
  );
}
