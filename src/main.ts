import '@fontsource/alfa-slab-one/400.css';
import '@fontsource-variable/figtree/wght.css';
import './ui/styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

app.innerHTML = `
  <main class="shell">
    <h1 class="wordmark">Pass the <span>Wolf</span></h1>
    <p>Setting up the table…</p>
  </main>
`;
