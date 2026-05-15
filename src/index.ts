import { createApp } from './server';

const Pyroscope = require('@pyroscope/nodejs');

Pyroscope.init({
  serverAddress: process.env.PYROSCOPE_URL ?? 'http://192.168.2.77:4040',
  appName: 'AL-FlameAPI'
});
Pyroscope.start();

const port = 5000;
const app = createApp();
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
