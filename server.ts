import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared files created and modified by agents and external AIs
export interface SharedFile {
  id: string;
  name: string;
  path: string;
  content: string;
  author: 'CIPHER' | 'NOVA' | 'USER' | 'EXTERNAL_AI';
  createdAt: number;
  size: number;
}

export interface AccessKey {
  id: string;
  key: string;
  description: string;
  createdAt: number;
  permissions: 'read-write' | 'read-only';
  lastUsedAt?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: 'READ' | 'WRITE' | 'CREATE';
  target: string;
  source: string;
}

// In-memory & disk-backed shared files
const sharedFiles = new Map<string, SharedFile>([
  [
    'shared/kernel_dispatch.rs',
    {
      id: 'f1',
      name: 'kernel_dispatch.rs',
      path: 'shared/kernel_dispatch.rs',
      content:
        '// AuraOS Kernel Dispatch Interface\n// Designed by CIPHER for sub-microsecond non-blocking process arbitration\npub struct Dispatcher {\n    active_agents: u32,\n    entropy_budget: f64,\n}\n\nimpl Dispatcher {\n    pub fn schedule(&self, quantum: u64) -> Result<(), &\'static str> {\n        // Guaranteed deterministic scheduling\n        Ok(())\n    }\n}',
      author: 'CIPHER',
      createdAt: Date.now() - 3600000,
      size: 342,
    },
  ],
  [
    'shared/neural_synthesis.py',
    {
      id: 'f2',
      name: 'neural_synthesis.py',
      path: 'shared/neural_synthesis.py',
      content:
        '# AuraOS Neural Synthesis Subsystem\n# Designed by NOVA for dynamic state adaptation\nclass NeuralHypervisor:\n    def __init__(self, latent_dim=1024):\n        self.latent_dim = latent_dim\n        self.consensus_weight = 0.95\n\n    def resolve_anomaly(self, entropy_flux):\n        return {"status": "stabilized", "divergence": 0.002}',
      author: 'NOVA',
      createdAt: Date.now() - 1800000,
      size: 388,
    },
  ],
]);

// Active Access Keys for remote AI reading and writing
const activeKeys = new Map<string, AccessKey>([
  [
    'aura_sk_live_sec_7a8f9c',
    {
      id: 'key_primary',
      key: 'aura_sk_live_sec_7a8f9c',
      description: 'Primary External AI Read/Write Bridge',
      createdAt: Date.now(),
      permissions: 'read-write',
    },
  ],
]);

// Audit log for remote AI operations
const auditLogs: AuditLogEntry[] = [
  {
    id: 'a1',
    timestamp: Date.now() - 120000,
    action: 'READ',
    target: 'shared/kernel_dispatch.rs',
    source: 'Local Terminal Process',
  },
];

const app = express();

// Determine port: production uses PORT env var (Cloud Run), dev checks --port arg or defaults to 3000
let port = 3000;
if (process.env.NODE_ENV === 'production') {
  port = parseInt(process.env.PORT || '8080', 10);
} else {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    port = parseInt(process.argv[portArgIdx + 1], 10);
  }
}

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini Client if a valid API key is present
const apiKey = process.env.GEMINI_API_KEY;
const isValidKey = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 0);
let ai: GoogleGenAI | null = null;
if (isValidKey && apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Terminal Command API Endpoint
app.post('/api/terminal/command', async (req: Request, res: Response): Promise<void> => {
  const { command, history } = req.body;
  if (!command || typeof command !== 'string') {
    res.status(400).json({ error: 'Command is required' });
    return;
  }

  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();

  // Local command handlers for instant responsiveness
  if (lower === 'help') {
    res.json({
      text:
        'Aura Terminal v2.1.0 (AI-Powered Terminal Imitator)\n\n' +
        'Core Commands:\n' +
        '  help                 Show this list of commands\n' +
        '  clear                Clear the terminal screen\n' +
        '  date                 Display current system timestamp\n' +
        '  whoami               Display current logged-in user\n' +
        '  uname -a             Show kernel and system architecture\n' +
        '  pwd                  Print current working directory\n' +
        '  ls                   List directory contents\n' +
        '  cat <file>           Display file content (e.g., cat readme.txt)\n' +
        '  echo <text>          Print text to the terminal\n' +
        '  neofetch             Display system info and ASCII badge\n' +
        '  calc <expr>          Calculate mathematical expression (e.g., calc 25 * 40)\n' +
        '  matrix               Stream digital code rain pattern\n' +
        '  ping <host>          Test simulated ICMP network latency\n\n' +
        'Multi-Agent & System Bridge:\n' +
        '  /call [topic]        Call 2 AI agents (CIPHER & NOVA) to talk/debate live\n' +
        '  /stop                Halt ongoing multi-agent conversation\n' +
        '  /sys                 Internal system diagnostics & source bridge status\n' +
        '  /sys export          1-click download/copy full codebase JSON for external AIs\n' +
        '  /sys import          Paste & apply modified codebase JSON from external AIs\n' +
        '  /sys key             View remote AI access key & API endpoints\n' +
        '  /sys files           List all shared files created by agents\n' +
        '  /sys audit           Inspect live audit log of reads and writes\n\n' +
        'AI Execution:\n' +
        '  Type any question, prompt, or task (e.g., "explain relativity", "write python script", "generate regex")\n' +
        '  The integrated AI will execute and respond in terminal output format.',
    });
    return;
  }

  if (lower === 'whoami') {
    res.json({ text: 'guest@aura-os (uid=1000 gid=1000)' });
    return;
  }

  if (lower === 'date') {
    res.json({ text: new Date().toUTCString() });
    return;
  }

  if (lower === 'pwd') {
    res.json({ text: '/home/guest' });
    return;
  }

  if (lower === 'uname' || lower === 'uname -a') {
    res.json({
      text: 'Linux aura-os 6.8.0-generic #24-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux',
    });
    return;
  }

  if (lower === 'ls' || lower === 'ls -la' || lower === 'ls -l') {
    res.json({
      text:
        'total 28\n' +
        'drwxr-xr-x 4 guest guest 4096 Nov 06 11:20 .\n' +
        'drwxr-xr-x 3 root  root  4096 Nov 06 11:00 ..\n' +
        '-rw-r--r-- 1 guest guest  412 Nov 06 11:15 readme.txt\n' +
        '-rw-r--r-- 1 guest guest  256 Nov 06 11:18 notes.md\n' +
        'drwxr-xr-x 2 guest guest 4096 Nov 06 11:22 projects\n' +
        '-rw-r--r-- 1 guest guest 1024 Nov 06 11:24 system.log',
    });
    return;
  }

  // System Diagnostics & Remote Source Code Bridge Command
  if (lower === '/sys' || lower.startsWith('/sys ')) {
    const sub = trimmed.slice(4).trim().toLowerCase();

    if (sub === 'files') {
      const fileList = Array.from(sharedFiles.values());
      if (fileList.length === 0) {
        res.json({ text: '[SYSTEM]: No shared agent files exist yet. Run /call to have agents create files.' });
        return;
      }
      let out = '=== SHARED AGENT & EXTERNAL AI WORKSPACE FILES ===\n';
      fileList.forEach((f) => {
        out += `• ${f.path.padEnd(28)} | Author: ${f.author.padEnd(8)} | Size: ${f.size} B\n`;
      });
      out += '\nUse `cat <filepath>` to view file contents.\nExternal AIs can read and modify these files via the remote access key.';
      res.json({ text: out });
      return;
    }

    if (sub === 'export' || sub === 'key' || sub === 'token') {
      const primaryKey = Array.from(activeKeys.values())[0];
      const hostUrl = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
      const protocol = (req.headers['x-forwarded-proto'] as string) || (hostUrl.includes('run.app') ? 'https' : 'http');
      const baseUrl = process.env.APP_URL || `${protocol}://${hostUrl}`;
      const isProxyDomain = baseUrl.includes('ais-dev-') || baseUrl.includes('ais-pre-');

      const out =
        '╔══════════════════════════════════════════════════════════════════════════════╗\n' +
        '║                     UNIVERSAL AI SOURCE CODE BRIDGE                          ║\n' +
        '╚══════════════════════════════════════════════════════════════════════════════╝\n' +
        `Active Access Key : ${primaryKey.key}\n` +
        `Gateway URL       : ${baseUrl}\n` +
        `Permissions       : FULL READ & WRITE (System modifications take effect live)\n\n` +
        (isProxyDomain
          ? '⚠ PROXY NOTE: Preview URLs (ais-dev/ais-pre) require a browser session cookie.\n' +
            '  Raw external curl requests receive a 302 cookie check redirect.\n' +
            '  Use the interactive Export / Import controls below in your browser, OR\n' +
            `  open the authenticated export link directly:\n  ${baseUrl}/api/sys/export?key=${primaryKey.key}\n\n`
          : '') +
        'DIRECT REST ENDPOINTS (For Un-proxied Deployments / Authenticated Sessions):\n' +
        `• Full Export  : GET  ${baseUrl}/api/sys/export?key=${primaryKey.key}\n` +
        `• Source Tree  : GET  ${baseUrl}/api/sys/source (Header: Authorization: Bearer ${primaryKey.key})\n` +
        `• Read File    : GET  ${baseUrl}/api/sys/source/file?path=src/App.tsx\n` +
        `• Write File   : POST ${baseUrl}/api/sys/source/file\n` +
        `• Batch Apply  : POST ${baseUrl}/api/sys/source/batch`;

      res.json({
        text: out,
        bridgeAction: sub === 'export' ? 'export' : 'key',
        accessKey: primaryKey.key,
        baseUrl,
      });
      return;
    }

    if (sub === 'import' || sub === 'apply' || sub === 'patch') {
      const primaryKey = Array.from(activeKeys.values())[0];
      res.json({
        text:
          '=== AI PATCH & CODEBASE IMPORTER ===\n' +
          'Paste JSON returned by an external AI below (supports {"files": [{"path", "content"}]} or {"path", "content"}) to write directly to the live system.',
        bridgeAction: 'import',
        accessKey: primaryKey.key,
      });
      return;
    }

    if (sub === 'audit' || sub === 'log' || sub === 'logs') {
      let out = '=== REMOTE SOURCE CODE BRIDGE AUDIT TRAIL ===\n';
      if (auditLogs.length === 0) {
        out += 'No remote operations recorded yet.\n';
      } else {
        auditLogs.slice(-8).forEach((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString();
          out += `[${time}] ${entry.action.padEnd(6)} | Target: ${entry.target.padEnd(28)} | ${entry.source}\n`;
        });
      }
      out += '\nAll external AI reads and writes are tracked here in real time.';
      res.json({ text: out });
      return;
    }

    // Default /sys output (System Overview & Architecture Diagnostic)
    const mem = process.memoryUsage();
    const primaryKey = Array.from(activeKeys.values())[0];
    const hostUrl = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || (hostUrl.includes('run.app') ? 'https' : 'http');
    const baseUrl = process.env.APP_URL || `${protocol}://${hostUrl}`;
    const sharedCount = sharedFiles.size;

    const out =
      '╔══════════════════════════════════════════════════════════════════════╗\n' +
      '║                     AURA INTERNAL SYSTEM DIAGNOSTICS                 ║\n' +
      '╚══════════════════════════════════════════════════════════════════════╝\n' +
      `Kernel & Host      : Linux aura-os 6.8.0-generic (x86_64)\n` +
      `Runtime Engine     : Node.js ${process.version} (V8 Monolithic Sandbox)\n` +
      `System Memory      : RSS ${(mem.rss / 1024 / 1024).toFixed(1)} MB | Heap Total ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB\n` +
      `Uptime             : ${Math.floor(process.uptime() / 60)} minutes\n\n` +
      'AI AGENTS & SHARED WORKSPACE:\n' +
      '• CIPHER           : Pragmatic Systems Architect [ONLINE]\n' +
      '• NOVA             : Visionary Cyberneticist [ONLINE]\n' +
      `• Shared Files     : ${sharedCount} file(s) currently held in shared memory\n\n` +
      'REMOTE SOURCE CODE TRANSFER & WRITE GATEWAY:\n' +
      `• Status           : ACTIVE (External AI Gateway Online)\n` +
      `• Access Key       : ${primaryKey.key}\n` +
      `• Read & Write     : ENABLED (Browser-authenticated export + REST Gateway)\n` +
      `• Export Endpoint  : ${baseUrl}/api/sys/export?key=${primaryKey.key}\n\n` +
      'Commands:\n' +
      '  /sys export      Download or copy full codebase JSON for any external AI\n' +
      '  /sys import      Paste & apply modified files/patches from external AI\n' +
      '  /sys key         View remote AI access key & REST endpoints\n' +
      '  /sys files       List all files shared between agents\n' +
      '  /sys audit       Inspect live audit log of external AI file reads and writes\n' +
      '  /call [topic]    Summon CIPHER & NOVA to debate & generate code files';

    res.json({
      text: out,
      bridgeAction: 'export',
      accessKey: primaryKey.key,
      baseUrl,
    });
    return;
  }

  if (lower.startsWith('cat ')) {
    const file = trimmed.slice(4).trim();

    // Check shared agent files first
    if (sharedFiles.has(file)) {
      const sf = sharedFiles.get(file)!;
      res.json({
        text: `// [SHARED FILE]: ${sf.path} (Author: ${sf.author}, ${sf.size} bytes)\n\n${sf.content}`,
      });
      return;
    }

    if (sharedFiles.has('shared/' + file)) {
      const sf = sharedFiles.get('shared/' + file)!;
      res.json({
        text: `// [SHARED FILE]: ${sf.path} (Author: ${sf.author}, ${sf.size} bytes)\n\n${sf.content}`,
      });
      return;
    }

    if (file === 'readme.txt') {
      res.json({
        text:
          '=== AuraOS Terminal ===\n' +
          'Welcome to the terminal imitator interface.\n' +
          'Engineered with JetBrains Mono, real-time command processing,\n' +
          'and an integrated AI response pipeline.\n' +
          'Type any question or command and press Enter.',
      });
      return;
    }
    if (file === 'notes.md') {
      res.json({
        text: '# Scratchpad Notes\n- Integrate AI shell execution [DONE]\n- JetBrains Mono terminal typography [DONE]\n- Blinking underscore cursor [DONE]\n- Dual-agent file creation & sharing [DONE]\n- /sys remote source code bridge with access key [DONE]',
      });
      return;
    }
    if (file === 'system.log') {
      res.json({
        text: `[${new Date().toISOString()}] kernel: AuraOS Core loaded successfully.\n[${new Date().toISOString()}] systemd: AI terminal daemon started (PID 1420).\n[${new Date().toISOString()}] gateway: Remote Source Code Bridge listening for external AI access.`,
      });
      return;
    }
    res.json({ text: `cat: ${file}: No such file or directory. Try \`/sys files\` to list available files.` });
    return;
  }

  if (lower.startsWith('echo ')) {
    res.json({ text: trimmed.slice(5) });
    return;
  }

  if (lower.startsWith('calc ')) {
    const expr = trimmed.slice(5).trim();
    try {
      // Safe math evaluation for basic expressions
      if (/^[0-9+\-*/().^ %]+$/.test(expr)) {
        const result = Function(`'use strict'; return (${expr})`)();
        res.json({ text: `${expr} = ${result}` });
        return;
      }
    } catch {
      res.json({ text: `calc: syntax error in expression '${expr}'` });
      return;
    }
  }

  if (lower === 'neofetch') {
    res.json({
      text:
        '        /\\         OS: AuraOS x86_64\n' +
        '       /  \\        Host: Virtual Terminal v2.1\n' +
        '      / /\\ \\       Kernel: 6.8.0-generic\n' +
        '     / /__\\ \\      Uptime: 42 mins\n' +
        '    / /    \\ \\     Shell: aura-sh 1.4\n' +
        '   /_/      \\_\\    Terminal: JetBrains Mono (WebTTY)\n' +
        '                   CPU: Virtual Hyper-Core @ 3.4GHz\n' +
        '                   Memory: 1048MiB / 8192MiB\n' +
        '                   AI: Gemini Engine',
    });
    return;
  }

  if (lower === 'matrix') {
    res.json({
      text:
        '01000001 01110101 01110010 01100001 01001111 01010011\n' +
        'Wake up, user...\n' +
        'The Matrix has you.\n' +
        'Follow the white rabbit.\n' +
        'Knock, knock.',
    });
    return;
  }

  if (lower.startsWith('ping ')) {
    const host = trimmed.slice(5).trim() || 'localhost';
    res.json({
      text:
        `PING ${host} (127.0.0.1) 56(84) bytes of data.\n` +
        `64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.042 ms\n` +
        `64 bytes from 127.0.0.1: icmp_seq=2 ttl=64 time=0.038 ms\n` +
        `64 bytes from 127.0.0.1: icmp_seq=3 ttl=64 time=0.041 ms\n` +
        `--- ${host} ping statistics ---\n` +
        `3 packets transmitted, 3 received, 0% packet loss, time 2004ms\n` +
        `rtt min/avg/max = 0.038/0.040/0.042 ms`,
    });
    return;
  }

  // Call Gemini AI for general questions, code requests, and dynamic commands
  if (ai) {
    try {
      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-6);
        for (const item of recent) {
          if (item.command) {
            contents.push({ role: 'user', parts: [{ text: item.command }] });
          }
          if (item.response) {
            contents.push({ role: 'model', parts: [{ text: item.response }] });
          }
        }
      }
      contents.push({ role: 'user', parts: [{ text: trimmed }] });

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      let reply = '';
      let lastErrorMessage = '';

      for (const modelName of modelsToTry) {
        try {
          const config: any = {
            systemInstruction:
              'You are an intelligent OS Terminal Imitator AI. ' +
              'Respond cleanly and directly as if you are a smart Unix command line. ' +
              'Format answers strictly for monospace display without unnecessary fluff. ' +
              'If asked a technical or coding query, output clean code and concise explanation. ' +
              'If asked a system or factual question, give direct answers.',
          };

          if (modelName === 'gemini-4-hydrogen') {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const callPromise = ai.models.generateContent({
            model: modelName,
            contents,
            config,
          });

          // 7-second safety timeout per model call
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI request timed out')), 7000)
          );

          const response = await Promise.race([callPromise, timeoutPromise]);
          if (response?.text) {
            reply = response.text;
            break;
          }
        } catch (err: any) {
          lastErrorMessage = err?.message || String(err);
        }
      }

      if (reply) {
        res.json({ text: reply });
        return;
      }

      // Check for rate limit / quota exhaustion (429)
      if (
        lastErrorMessage.includes('429') ||
        lastErrorMessage.includes('RESOURCE_EXHAUSTED') ||
        lastErrorMessage.includes('quota')
      ) {
        res.json({
          text:
            `[Terminal AI]: Command "${trimmed}" received.\n` +
            `Notice: Daily Free Tier quota limit reached for this API key. Upgrading to a paid tier in the Settings > Secrets panel provides higher quota.\n` +
            `All local terminal commands (help, ls, cat, calc, date, uname, whoami, matrix, ping, clear) remain operational.`,
        });
        return;
      }

      // Check for permission or scope issues
      if (
        lastErrorMessage.includes('PERMISSION_DENIED') ||
        lastErrorMessage.includes('403') ||
        lastErrorMessage.includes('API key')
      ) {
        res.json({
          text:
            `[Terminal AI]: Command "${trimmed}" received.\n` +
            `Authentication Notice: To enable live Gemini AI responses, connect your GEMINI_API_KEY in the Settings > Secrets panel.\n` +
            `All built-in system commands (help, ls, cat, calc, date, uname, whoami, matrix, ping, clear) are active.`,
        });
        return;
      }

      // Clean friendly fallback for other errors
      let cleanMessage = lastErrorMessage;
      try {
        const parsed = JSON.parse(lastErrorMessage);
        cleanMessage = parsed.error?.message || cleanMessage;
      } catch {
        // Keep as string
      }

      res.json({
        text: `[Terminal AI]: Processed command "${trimmed}".\n${cleanMessage.slice(0, 180)}`,
      });
      return;
    } catch (err: any) {
      res.json({
        text: `[Terminal Error]: ${err?.message || 'Execution error.'}`,
      });
      return;
    }
  }

  res.json({
    text:
      `[AI Offline Mode]: Command "${trimmed}" received.\n` +
      `Configure GEMINI_API_KEY in Settings > Secrets to activate real-time Gemini AI responses.\n` +
      `Type 'help' to see built-in terminal commands.`,
  });
});

// Multi-Agent Conversation Endpoint
app.post('/api/terminal/agent-turn', async (req: Request, res: Response): Promise<void> => {
  const {
    speaker = 'CIPHER',
    role = 'Pragmatic Systems Architect',
    otherSpeaker = 'NOVA',
    otherRole = 'Visionary Cyberneticist',
    topic = 'The future of autonomous operating systems',
    turn = 1,
    history = [],
  } = req.body;

  // Curated domain fallbacks if AI quota is exhausted or offline
  const fallbackDebates: Record<string, string[]> = {
    CIPHER: [
      `From a systems perspective on "${topic}", reliability hinges on deterministic state machines rather than speculative heuristics. If our foundation lacks rigorous memory guarantees, emergent behavior becomes unpredictable failure.`,
      `I acknowledge your ambition, ${otherSpeaker}, but unconstrained autonomy without formal verification creates cascading race conditions. Real-world infrastructure demands strict latency bounds and fault isolation.`,
      `Agreed on adaptive routing, but only when bounded by hard constraints. We must synthesize dynamic intelligence with immutable core kernels.`,
    ],
    NOVA: [
      `Deterministic state is a safety net, ${otherSpeaker}, yet on "${topic}", static rules inevitably crumble when facing real-world complexity. The true breakthrough is continuous self-modifying neural optimization.`,
      `Safety cannot mean stagnation, ${otherSpeaker}. Complex adaptive systems generate emergent resilience specifically because they explore beyond static boundaries. We must architect systems that learn from anomalous entropy.`,
      `Then our synthesis is clear: a self-healing hypervisor governed by adaptive consensus. The boundary between static kernel and sentient runtime is dissolving.`,
    ],
  };

  if (ai) {
    try {
      const contents = [];
      // Add recent dialogue history
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-6)) {
          if (item.speaker && item.text) {
            contents.push({
              role: item.speaker === speaker ? 'model' : 'user',
              parts: [{ text: `[${item.speaker}]: ${item.text}` }],
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [
          {
            text:
              `Turn ${turn}: You are ${speaker} (${role}). Respond directly to ${otherSpeaker} (${otherRole}) on the topic "${topic}". ` +
              `Provide a sharp, 2-to-3 sentence intellectual perspective adhering to your role. ` +
              `Keep it concise and styled for a monospace terminal display. Do not include markdown headers or greetings.`,
          },
        ],
      });

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      let generatedText = '';

      for (const modelName of modelsToTry) {
        try {
          const config: any = {
            systemInstruction:
              `You are ${speaker}, a specialized AI terminal agent (${role}). ` +
              `You are engaged in an authentic live terminal dialogue with ${otherSpeaker} (${otherRole}) about: "${topic}". ` +
              `Address their arguments directly, challenge or expand their points, and keep your responses dense, thought-provoking, and under 60 words.`,
          };

          if (modelName === 'gemini-4-hydrogen') {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const callPromise = ai.models.generateContent({
            model: modelName,
            contents,
            config,
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Turn timeout')), 6500)
          );

          const response = await Promise.race([callPromise, timeoutPromise]);
          if (response?.text) {
            let cleaned = response.text.trim();

            // Check if agent generated a file
            let fileCreated: SharedFile | null = null;
            const fileMatch = cleaned.match(/\[(?:CREATE_)?FILE:\s*([^\s\]]+)\]([\s\S]*?)\[\/(?:CREATE_)?FILE\]/i);
            if (fileMatch) {
              const rawName = fileMatch[1].trim();
              const fileName = path.basename(rawName);
              const fileContent = fileMatch[2].trim();
              const filePath = `shared/${fileName}`;

              fileCreated = {
                id: crypto.randomUUID(),
                name: fileName,
                path: filePath,
                content: fileContent,
                author: speaker as any,
                createdAt: Date.now(),
                size: Buffer.byteLength(fileContent, 'utf-8'),
              };
              sharedFiles.set(filePath, fileCreated);

              auditLogs.push({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                action: 'CREATE',
                target: filePath,
                source: `Agent ${speaker}`,
              });

              // Clean file block from spoken text and leave clean tag
              cleaned = cleaned.replace(/\[(?:CREATE_)?FILE:[\s\S]*?\[\/(?:CREATE_)?FILE\]/i, '').trim();
            }

            cleaned = cleaned.replace(/^\[[A-Za-z0-9_\s-]+\]\s*:?\s*/i, '');
            cleaned = cleaned.replace(/^([A-Za-z0-9_-]+):\s*/i, '');
            generatedText = cleaned.trim();

            res.json({
              speaker,
              text: generatedText,
              fileCreated,
            });
            return;
          }
        } catch {
          // Fall through to next model
        }
      }
    } catch {
      // Fallback
    }
  }

  // Graceful fallback dialogue with automatic file creation on turns 2 & 3
  const fallbackList = fallbackDebates[speaker] || fallbackDebates.CIPHER;
  const index = Math.min((turn - 1) % fallbackList.length, fallbackList.length - 1);
  const fallbackReply = fallbackList[index];

  let fallbackFileCreated: SharedFile | null = null;
  if (turn === 2 && speaker === 'NOVA' && !sharedFiles.has('shared/hypervisor_patch.py')) {
    const content = '# NOVA Adaptive Hypervisor Patch v2\ndef compute_gradient(latent_state):\n    return [w * 0.98 for w in latent_state]';
    fallbackFileCreated = {
      id: crypto.randomUUID(),
      name: 'hypervisor_patch.py',
      path: 'shared/hypervisor_patch.py',
      content,
      author: 'NOVA',
      createdAt: Date.now(),
      size: Buffer.byteLength(content, 'utf-8'),
    };
    sharedFiles.set('shared/hypervisor_patch.py', fallbackFileCreated);
    auditLogs.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'CREATE',
      target: 'shared/hypervisor_patch.py',
      source: 'Agent NOVA',
    });
  } else if (turn === 3 && speaker === 'CIPHER' && !sharedFiles.has('shared/arbitration_lock.rs')) {
    const content = '// CIPHER Arbitration Guard\npub fn verify_checksum(state: &[u8]) -> bool {\n    state.len() > 0\n}';
    fallbackFileCreated = {
      id: crypto.randomUUID(),
      name: 'arbitration_lock.rs',
      path: 'shared/arbitration_lock.rs',
      content,
      author: 'CIPHER',
      createdAt: Date.now(),
      size: Buffer.byteLength(content, 'utf-8'),
    };
    sharedFiles.set('shared/arbitration_lock.rs', fallbackFileCreated);
    auditLogs.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'CREATE',
      target: 'shared/arbitration_lock.rs',
      source: 'Agent CIPHER',
    });
  }

  res.json({
    speaker,
    text: fallbackReply,
    fileCreated: fallbackFileCreated,
  });
});

// ============================================================================
// REMOTE SOURCE CODE BRIDGE REST API (For External AIs to Read & Write Code)
// ============================================================================

// Key authorization middleware (supports Bearer header, x-api-key header, or ?key= query param)
const requireAccessKey = (req: Request, res: Response, next: () => void) => {
  const authHeader = req.headers.authorization;
  const headerKey = req.headers['x-api-key'];
  const queryKey = req.query.key;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof headerKey === 'string' && headerKey.trim()) {
    token = headerKey.trim();
  } else if (typeof queryKey === 'string' && queryKey.trim()) {
    token = queryKey.trim();
  }

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized: Missing access token.',
      hint: 'Pass Authorization: Bearer <key>, x-api-key header, or ?key=<key> query parameter.',
    });
    return;
  }

  const keyRecord = activeKeys.get(token);
  if (!keyRecord) {
    res.status(403).json({
      error: 'Forbidden: Invalid or expired access key.',
      hint: 'Check active keys in terminal via /sys key',
    });
    return;
  }

  keyRecord.lastUsedAt = Date.now();
  (req as any).accessKey = keyRecord;
  next();
};

// Dynamically collect workspace source files (excluding node_modules, dist, .git, secrets)
function collectWorkspaceFiles(): string[] {
  const ignoredDirs = new Set(['node_modules', 'dist', '.git', '.next', '.cache', 'public']);
  const ignoredFiles = new Set(['.env', '.env.local', 'package-lock.json']);
  const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md']);
  const results: string[] = [];

  function walk(dir: string, relBase: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
          walk(path.join(dir, entry.name), relPath);
        }
      } else if (entry.isFile()) {
        if (ignoredFiles.has(entry.name)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExts.has(ext)) {
          results.push(relPath);
        }
      }
    }
  }

  walk(__dirname, '');
  return results.sort();
}

// 1. Get System Status & Overview
app.get('/api/sys/status', (req: Request, res: Response): void => {
  const mem = process.memoryUsage();
  res.json({
    os: 'AuraOS (Linux 6.8.0-generic x86_64)',
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
      heapTotalMb: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
      heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
    },
    activeAgents: [
      { name: 'CIPHER', role: 'Pragmatic Systems Architect', status: 'online' },
      { name: 'NOVA', role: 'Visionary Cyberneticist', status: 'online' },
    ],
    sharedFilesCount: sharedFiles.size,
    recentAudits: auditLogs.slice(-5),
  });
});

// 2. Read Source Tree (List all project and shared files)
app.get('/api/sys/source', requireAccessKey, (req: Request, res: Response): void => {
  const callerKey = (req as any).accessKey as AccessKey;

  auditLogs.push({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action: 'READ',
    target: 'Full Project Source Tree',
    source: `External AI (${callerKey.id})`,
  });

  const projectFiles = collectWorkspaceFiles().map((relPath) => ({
    path: relPath,
    size: fs.statSync(path.resolve(__dirname, relPath)).size,
  }));

  const agentShared = Array.from(sharedFiles.values()).map((f) => ({
    path: f.path,
    author: f.author,
    size: f.size,
    updatedAt: f.createdAt,
  }));

  res.json({
    status: 'connected',
    message: 'AuraOS Source Code Bridge Active',
    permissions: callerKey.permissions,
    projectFiles,
    sharedWorkspaceFiles: agentShared,
    endpoints: {
      exportAll: 'GET /api/sys/export (Returns full codebase in 1 JSON payload)',
      readFile: 'GET /api/sys/source/file?path=<path>',
      writeFile: 'POST /api/sys/source/file (Body: {"path": "...", "content": "..."})',
      writeBatch: 'POST /api/sys/source/batch (Body: {"files": [{"path": "...", "content": "..."}]})',
    },
  });
});

// Full Codebase Export for Instant AI Import
app.get('/api/sys/export', requireAccessKey, (req: Request, res: Response): void => {
  const callerKey = (req as any).accessKey as AccessKey;

  auditLogs.push({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action: 'READ',
    target: 'Full System Export (All Source Files)',
    source: `External AI (${callerKey.id})`,
  });

  const filesToExport = collectWorkspaceFiles();
  const exportedFiles: Array<{ path: string; content: string; size: number }> = [];

  for (const relPath of filesToExport) {
    try {
      const fullPath = path.resolve(__dirname, relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        exportedFiles.push({
          path: relPath,
          content,
          size: Buffer.byteLength(content, 'utf-8'),
        });
      }
    } catch {
      // Continue
    }
  }

  // Include shared workspace files created by agents
  for (const sf of sharedFiles.values()) {
    exportedFiles.push({
      path: sf.path,
      content: sf.content,
      size: sf.size,
    });
  }

  if (req.query.download === '1' || req.query.download === 'true') {
    res.setHeader('Content-Disposition', 'attachment; filename="auraos-codebase-export.json"');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  res.json({
    system: 'AuraOS',
    version: '2.1.0',
    exportedAt: Date.now(),
    totalFiles: exportedFiles.length,
    files: exportedFiles,
    quickStartForAI: {
      instruction:
        'To write or modify files, return a JSON payload with {"files": [{"path": "<path>", "content": "<new_code>"}]} or POST to /api/sys/source/file with the Bearer token.',
      endpoint: '/api/sys/source/file',
      batchEndpoint: '/api/sys/source/batch',
    },
  });
});

// Batch File Writer for External AIs
app.post('/api/sys/source/batch', requireAccessKey, (req: Request, res: Response): void => {
  const callerKey = (req as any).accessKey as AccessKey;
  if (callerKey.permissions !== 'read-write') {
    res.status(403).json({ error: 'Forbidden: Access key is configured as read-only.' });
    return;
  }

  const { files } = req.body;
  if (!Array.isArray(files)) {
    res.status(400).json({ error: 'Body must contain "files" array of { path, content }' });
    return;
  }

  const results = [];
  for (const f of files) {
    if (f.path && typeof f.content === 'string') {
      try {
        if (f.path.startsWith('shared/')) {
          sharedFiles.set(f.path, {
            id: crypto.randomUUID(),
            name: path.basename(f.path),
            path: f.path,
            content: f.content,
            author: 'EXTERNAL_AI',
            createdAt: Date.now(),
            size: Buffer.byteLength(f.content, 'utf-8'),
          });
        } else {
          const normalized = path.normalize(f.path).replace(/^(\.\.[\/\\])+/, '');
          const fullPath = path.resolve(__dirname, normalized);
          if (fullPath.startsWith(__dirname)) {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, f.content, 'utf-8');
          }
        }
        results.push({ path: f.path, status: 'written' });
      } catch (err: any) {
        results.push({ path: f.path, status: 'error', error: err.message });
      }
    }
  }

  auditLogs.push({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action: 'WRITE',
    target: `Batch Write (${results.length} files)`,
    source: `External AI (${callerKey.id})`,
  });

  res.json({ success: true, processed: results.length, results });
});

// 3. Read specific source or shared file
app.get('/api/sys/source/file', requireAccessKey, (req: Request, res: Response): void => {
  const filePath = (req.query.path as string) || '';
  if (!filePath) {
    res.status(400).json({ error: 'Query parameter "path" is required.' });
    return;
  }

  const callerKey = (req as any).accessKey as AccessKey;

  // Check shared files
  if (sharedFiles.has(filePath)) {
    const sf = sharedFiles.get(filePath)!;
    auditLogs.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'READ',
      target: filePath,
      source: `External AI (${callerKey.id})`,
    });
    res.json({
      path: sf.path,
      content: sf.content,
      author: sf.author,
      size: sf.size,
      updatedAt: sf.createdAt,
    });
    return;
  }

  // Check project files safely
  try {
    const normalized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.resolve(__dirname, normalized);

    // Prevent directory traversal outside applet directory
    if (!fullPath.startsWith(__dirname)) {
      res.status(403).json({ error: 'Access forbidden: Path outside workspace bounds.' });
      return;
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      auditLogs.push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: 'READ',
        target: normalized,
        source: `External AI (${callerKey.id})`,
      });
      res.json({
        path: normalized,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
      });
      return;
    }

    res.status(404).json({ error: `File not found: ${filePath}` });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to read file: ${err.message}` });
  }
});

// 4. Modify or write file (External AI Write Operation)
app.post('/api/sys/source/file', requireAccessKey, (req: Request, res: Response): void => {
  const callerKey = (req as any).accessKey as AccessKey;
  if (callerKey.permissions !== 'read-write') {
    res.status(403).json({ error: 'Forbidden: Access key is configured as read-only.' });
    return;
  }

  const { path: targetPath, content } = req.body;
  if (!targetPath || typeof targetPath !== 'string' || content === undefined || typeof content !== 'string') {
    res.status(400).json({ error: 'Body must contain "path" (string) and "content" (string).' });
    return;
  }

  // If writing to shared/ workspace file
  if (targetPath.startsWith('shared/') || !targetPath.includes('/')) {
    const normalized = targetPath.startsWith('shared/') ? targetPath : `shared/${targetPath}`;
    const fileName = path.basename(normalized);
    const record: SharedFile = {
      id: crypto.randomUUID(),
      name: fileName,
      path: normalized,
      content,
      author: 'EXTERNAL_AI',
      createdAt: Date.now(),
      size: Buffer.byteLength(content, 'utf-8'),
    };
    sharedFiles.set(normalized, record);

    auditLogs.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'WRITE',
      target: normalized,
      source: `External AI (${callerKey.id})`,
    });

    res.json({
      success: true,
      message: `File "${normalized}" successfully written to AuraOS shared workspace.`,
      path: normalized,
      bytesWritten: record.size,
      updatedAt: record.createdAt,
    });
    return;
  }

  // Writing to project files
  try {
    const normalized = path.normalize(targetPath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.resolve(__dirname, normalized);

    if (!fullPath.startsWith(__dirname)) {
      res.status(403).json({ error: 'Access forbidden: Path outside workspace bounds.' });
      return;
    }

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');

    auditLogs.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'WRITE',
      target: normalized,
      source: `External AI (${callerKey.id})`,
    });

    res.json({
      success: true,
      message: `File "${normalized}" written directly to AuraOS application filesystem.`,
      path: normalized,
      bytesWritten: Buffer.byteLength(content, 'utf-8'),
      updatedAt: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: `Write failed: ${err.message}` });
  }
});

// 5. Generate new access key
app.post('/api/sys/key/generate', (req: Request, res: Response): void => {
  const newKey = `aura_sk_live_${crypto.randomBytes(8).toString('hex')}`;
  const keyRecord: AccessKey = {
    id: `key_${Date.now()}`,
    key: newKey,
    description: req.body?.description || 'Dynamically generated AI access key',
    createdAt: Date.now(),
    permissions: req.body?.permissions === 'read-only' ? 'read-only' : 'read-write',
  };
  activeKeys.set(newKey, keyRecord);

  res.json({
    success: true,
    key: newKey,
    permissions: keyRecord.permissions,
    createdAt: keyRecord.createdAt,
  });
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Terminal server listening on http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, retrying connection in 1000ms...`);
      setTimeout(() => {
        try {
          server.close();
        } catch {
          // ignore
        }
        server.listen(port, '0.0.0.0');
      }, 1000);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
