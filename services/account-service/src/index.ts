import { app, seedAccounts } from './app.js';

const PORT = process.env.PORT || 8001;

seedAccounts().then(() => {
  let retries = 8;
  const start = () => {
    const srv = app.listen(PORT, () => console.log(`[Account Service] running on http://localhost:${PORT}`));
    srv.once('error', (e: any) => {
      srv.close();
      if (e.code === 'EADDRINUSE' && retries-- > 0) {
        console.log(`[Account Service] port ${PORT} busy, retrying in 600ms...`);
        setTimeout(start, 600);
      } else { console.error(e); process.exit(1); }
    });
    const shutdown = () => {
      (srv as any).closeAllConnections?.();
      srv.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 500);
    };
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.on('SIGTERM', shutdown);
    process.on('SIGINT',  shutdown);
  };
  start();
});
