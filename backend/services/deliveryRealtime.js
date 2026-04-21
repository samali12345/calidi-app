const clientsByDeliveryId = new Map();

function addClient(deliveryId, res) {
  if (!clientsByDeliveryId.has(deliveryId)) {
    clientsByDeliveryId.set(deliveryId, new Set());
  }
  clientsByDeliveryId.get(deliveryId).add(res);
}

function removeClient(deliveryId, res) {
  const set = clientsByDeliveryId.get(deliveryId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    clientsByDeliveryId.delete(deliveryId);
  }
}

function writeEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastDeliveryUpdate(delivery) {
  if (!delivery || !delivery.deliveryId) return;
  const set = clientsByDeliveryId.get(delivery.deliveryId);
  if (!set || set.size === 0) return;

  const payload = {
    type: "delivery_update",
    delivery,
    at: new Date().toISOString(),
  };

  for (const res of set) {
    try {
      writeEvent(res, "delivery_update", payload);
    } catch (_) {
      // Ignore broken client stream; cleanup is handled on close.
    }
  }
}

module.exports = {
  addClient,
  removeClient,
  writeEvent,
  broadcastDeliveryUpdate,
};

