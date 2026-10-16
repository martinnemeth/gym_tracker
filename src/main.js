import { html, render } from './lib.js';
import { App } from './screens/App.js';

render(html`<${App} />`, document.getElementById('app'));

// Service worker len mimo lokálneho vývoja (inak by cache skrývala zmeny);
// lokálne sa dá zapnúť cez ?sw v URL.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw'))) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registrácia zlyhala', err));
}
