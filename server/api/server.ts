import { createServer } from 'node:http';
import { createApiApp } from './app';

const port = Number(process.env.API_PORT || 8787);
const app = createApiApp();
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`Kkumideun local API listening on http://0.0.0.0:${port}`);
});
