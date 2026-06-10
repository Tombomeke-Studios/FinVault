#!/usr/bin/env node
/**
 * Kills every process tree that holds one of FinVault's dev ports.
 *
 * Root cause: tsx watch is an orphaned parent process.
 * When we only kill the port-holding node child, tsx watch immediately
 * respawns a new child that reclaims the port — racing with the new
 * npm run dev session.
 *
 * Fix: find the parent PID of the port-holder (tsx watch), then kill the
 * entire tree from that parent downward with taskkill /T. This removes
 * both the orphaned tsx watch AND its child in one shot.
 */
import { execSync } from 'child_process';

const PORTS = [3000, 8000, 8001, 8002, 8003];
const isWin = process.platform === 'win32';
let killed = 0;

function getParentPid(pid) {
  try {
    const out = execSync(
      `wmic process where processid=${pid} get parentprocessid /format:list`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const m = out.match(/ParentProcessId=(\d+)/);
    return m ? parseInt(m[1]) : null;
  } catch { return null; }
}

function killTree(pid) {
  try {
    execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

if (isWin) {
  let netstat;
  try {
    netstat = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch { process.exit(0); }

  for (const port of PORTS) {
    const seen = new Set();
    const regex = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`, 'g');
    let m;
    while ((m = regex.exec(netstat)) !== null) {
      const childPid = parseInt(m[1]);
      if (seen.has(childPid)) continue;
      seen.add(childPid);

      // Walk up: kill the tsx-watch parent so it can't respawn a new child
      const parentPid = getParentPid(childPid);
      const targetPid = (parentPid && parentPid > 8) ? parentPid : childPid;

      if (killTree(targetPid)) {
        console.log(`  killed tree from PID ${targetPid} (port ${port})`);
        killed++;
      }
    }
  }
} else {
  // Unix: kill the process group so the parent watcher dies too
  for (const port of PORTS) {
    try {
      const out = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' });
      for (const pid of out.trim().split('\n').filter(Boolean)) {
        try {
          execSync(`kill -9 -$(ps -o pgid= -p ${pid} | tr -d ' ') 2>/dev/null || kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`  killed process group for PID ${pid} (port ${port})`);
          killed++;
        } catch {}
      }
    } catch {}
  }
}

console.log(killed > 0 ? `kill-ports: freed ${killed} process tree(s)` : 'kill-ports: all ports already free');
