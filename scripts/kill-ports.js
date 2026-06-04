#!/usr/bin/env node
// Kills any process listening on FinVault's dev ports before npm run dev starts.
// Uses native OS commands — no npm package required.
import { execSync } from 'child_process';

const PORTS = [3000, 8000, 8001, 8002, 8003];
const isWin = process.platform === 'win32';

let killed = 0;

for (const port of PORTS) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const regex = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`, 'g');
      let match;
      while ((match = regex.exec(out)) !== null) {
        const pid = match[1];
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`  killed PID ${pid} on port ${port}`);
          killed++;
        } catch {}
      }
    } else {
      const out = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' });
      for (const pid of out.trim().split('\n').filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`  killed PID ${pid} on port ${port}`);
          killed++;
        } catch {}
      }
    }
  } catch {}
}

console.log(killed > 0 ? `kill-ports: freed ${killed} process(es)` : 'kill-ports: all ports already free');
