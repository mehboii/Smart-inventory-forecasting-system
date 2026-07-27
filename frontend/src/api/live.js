import { API_BASE_URL } from './client.js';

export function subscribeToInventoryUpdates({ onUpdate, onStatusChange }) {
  let cancelled = false;
  let controller;
  let retryTimer;

  async function connect() {
    const token = localStorage.getItem('token');
    if (!token || cancelled) return;

    controller = new AbortController();
    try {
      const response = await fetch(`${API_BASE_URL}/live`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      if (!response.ok || !response.body) throw new Error('Live updates unavailable');

      onStatusChange(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        events.forEach((event) => {
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) return;
          try {
            onUpdate(JSON.parse(dataLine.slice(6)));
          } catch {}
        });
      }
    } catch {
    } finally {
      onStatusChange(false);
      if (!cancelled) retryTimer = window.setTimeout(connect, 2000);
    }
  }

  connect();
  return () => {
    cancelled = true;
    controller?.abort();
    window.clearTimeout(retryTimer);
  };
}
