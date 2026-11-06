const net = require('node:net');
const path = require('node:path');

async function isProjectMetro(port, root, { timeoutMs = 15000 } = {}) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    const project = response.headers.get('x-react-native-project-root');
    const body = await response.text();
    if (!response.ok || body.trim() !== 'packager-status:running' || !project) return false;
    const normalize = (value) => {
      const resolved = path.resolve(value);
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return normalize(decodeURIComponent(project)) === normalize(root);
  } catch {
    return false;
  }
}

async function isPortAvailable(port) {
  // Windows can allow a wildcard bind while a loopback-only listener exists.
  // Check both address families and the address used by the app's ADB forwarding.
  for (const host of [undefined, '127.0.0.1', 'localhost']) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen({ port, host }, () => server.close(() => resolve(true)));
    });
    if (!free) return false;
  }
  return true;
}

async function selectMetroServer(
  root,
  {
    ports = Array.from({ length: 10 }, (_, index) => 8081 + index),
    probe = isProjectMetro,
    available = isPortAvailable,
  } = {},
) {
  // A slow status response is not proof that a port is free. Check all common
  // launcher ports before starting anything, and only reuse this exact checkout.
  const running = await Promise.all(ports.map((port) => probe(port, root)));
  const existing = ports.find((_, index) => running[index]);
  if (existing !== undefined) return { port: existing, reused: true };
  for (const port of ports) {
    if (await available(port)) return { port, reused: false };
  }
  throw new Error(
    'Ports 8081–8090 are busy, and no responding Metro server belongs to this project. Close an unused Metro terminal and retry.',
  );
}

module.exports = { isProjectMetro, isPortAvailable, selectMetroServer };
