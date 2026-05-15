import { createApp } from './server';

const port = 5000;
const app = createApp();
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
