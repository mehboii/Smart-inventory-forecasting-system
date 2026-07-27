import { EventEmitter } from 'events';

const updates = new EventEmitter();
updates.setMaxListeners(0);

export function publishInventoryUpdate(userId, source) {
  updates.emit('inventory-update', { userId, source, updatedAt: new Date().toISOString() });
}

export function subscribeToInventoryUpdates(listener) {
  updates.on('inventory-update', listener);
  return () => updates.off('inventory-update', listener);
}
