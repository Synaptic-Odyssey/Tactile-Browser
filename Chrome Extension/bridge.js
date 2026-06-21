// bridge.js  –  Node.js WebSocket ↔ Serial bridge
//
// Run with:  node bridge.js
//
// Architecture
// ────────────
//   Chrome extension (content.js)
//       │  WebSocket (ws://localhost:8765)
//       ▼
//   bridge.js  ◄──── this file
//       │  USB Serial
//       ▼
//   Arduino / tactile hardware
//
// Wire format (extension → hardware)
//   A plain string of '0'/'1' characters, one per cell in row-major order,
//   for the sub-grid the hardware represents.  E.g. "010011000101" for a 2×6
//   module.  The bridge forwards it as-is with a trailing '\n'.
//
// Wire format (hardware → extension)
//   Lines starting with 'K' carry key events: "K<row><col><type>"
//   where type is 'S' (short press) or 'L' (long press).
//   Example: "K02L" = row 0, col 2, long press.
//
//   Lines starting with 'P' carry perf/diagnostic data from the firmware
//   and are logged but not forwarded to the extension.

'use strict';

const WebSocket  = require('ws');
const { SerialPort } = require('serialport');

// ─── Configuration ───────────────────────────────────────────────────────────

const SERIAL_PORT  = process.env.SERIAL_PORT  || '/dev/cu.usbserial-210';
const BAUD_RATE    = parseInt(process.env.BAUD_RATE   || '115200', 10);
const WS_PORT      = parseInt(process.env.WS_PORT     || '8765',   10);
const VERBOSE      = process.env.VERBOSE === '1';

function log(...args)  { console.log('[bridge]', ...args); }
function info(...args) { if (VERBOSE) log(...args); }

// ─── Serial ───────────────────────────────────────────────────────────────────

const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });

port.on('open', () => log(`Serial opened: ${SERIAL_PORT} @ ${BAUD_RATE}`));
port.on('error', (err) => log('Serial error:', err.message));

let serialBuffer = '';

// ─── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocket.Server({ port: WS_PORT });
log(`WebSocket server listening on ws://localhost:${WS_PORT}`);

let latestSocket  = null;
let lastSentGrid  = null;   // last grid string sent to hardware (for diff logging)

// ─── Perf measurement helpers ─────────────────────────────────────────────────

/** Tracks round-trip time: WS message received → serial write complete. */
function measureForwardLatency(gridStr) {
    const t0 = process.hrtime.bigint();
    return () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1_000_000;
        info(`Serial forward latency: ${ms.toFixed(2)} ms`);
    };
}

// ─── Serial reliability counter ───────────────────────────────────────────────
// Keep a running tally so you can report it in your paper.

const stats = {
    wsSent:         0,   // messages received from extension
    serialWritten:  0,   // messages forwarded to serial
    serialErrors:   0,   // serial write errors
    hwMessages:     0,   // messages received from hardware
};

setInterval(() => {
    log(`Stats — WS→ext: ${stats.wsSent} | serial written: ${stats.serialWritten} | ` +
        `serial errors: ${stats.serialErrors} | HW→ext: ${stats.hwMessages}`);
}, 30_000);

// ─── Connection handler ───────────────────────────────────────────────────────

wss.on('connection', (ws) => {
    log('Extension connected');
    latestSocket = ws;

    // If the hardware is already in a known state, don't re-send stale data;
    // wait for the next render cycle from the extension.

    ws.on('message', (raw) => {
        const gridStr = raw.toString();
        stats.wsSent++;

        if (gridStr === lastSentGrid) {
            info('Skipping identical grid (bridge-level dedup)');
            return;
        }

        lastSentGrid = gridStr;
        const done = measureForwardLatency(gridStr);

        port.write(gridStr + '\n', (err) => {
            if (err) {
                log('Serial write error:', err.message);
                stats.serialErrors++;
            } else {
                stats.serialWritten++;
                done();
            }
        });
    });

    ws.on('close',   () => { log('Extension disconnected'); if (latestSocket === ws) latestSocket = null; });
    ws.on('error',   (err) => log('WS client error:', err.message));
});

// ─── Hardware → extension ─────────────────────────────────────────────────────

port.on('data', (data) => {
    serialBuffer += data.toString();

    const lines = serialBuffer.split('\n');
    serialBuffer = lines.pop();   // keep unterminated tail

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        info('HW ←', trimmed);

        if (trimmed.startsWith('P')) {
            // Perf / diagnostic from firmware – log only
            log('HW perf:', trimmed.slice(1));
            continue;
        }

        stats.hwMessages++;

        if (
            latestSocket &&
            latestSocket.readyState === WebSocket.OPEN
        ) {
            latestSocket.send(trimmed);
        }
    }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', () => {
    log('Shutting down…');
    wss.close();
    port.close(() => process.exit(0));
});