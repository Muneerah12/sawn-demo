/**
 * Live adapter: subscribes to a WebSocket that pushes wireless observations as JSON
 * (one object, an array, or { observations: [...] }). Reconnects with capped backoff.
 * Expected fields: id|mac|address|bssid, protocol ("wifi"|"ble"), sensorId, timestamp, rssi, addressType.
 * Messages with type "sensor" (heartbeat), "bridge" (local bridge status) or "lan" (IP/hostname
 * table for this PC's own network) are routed separately.
 */
// Console messages from the server (not observations): app updates, config changes, incidents,
// audit entries, session notices and simulator events.
const CONTROL_TYPES = new Set(['server', 'config', 'incident', 'audit', 'session', 'sim', 'notification', 'approval', 'gate', 'reader_event', 'health', 'threats', 'presence', 'aircraft', 'space']);

export function createLiveSocketSource({
  url,
  onObservation,
  onSensor = () => {},
  onBridge = () => {},
  onLan = () => {},
  onControl = () => {},
  onStatus = () => {},
  WebSocketImpl = globalThis.WebSocket,
  maxBackoffMs = 15_000,
}) {
  if (!/^wss?:\/\//i.test(String(url))) throw new Error('Live feed URL must start with ws:// or wss://');
  if (!WebSocketImpl) throw new Error('WebSocket is not available in this environment');

  let ws = null;
  let timer = null;
  let attempt = 0;
  let stopped = false;

  function connect() {
    onStatus('connecting');
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      attempt = 0;
      onStatus('connected');
    };
    ws.onmessage = (msg) => handle(msg.data);
    ws.onclose = () => {
      if (stopped) return onStatus('disconnected');
      onStatus('reconnecting');
      timer = setTimeout(connect, Math.min(maxBackoffMs, 500 * 2 ** attempt++));
    };
  }

  function handle(data) {
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.observations) ? parsed.observations : [parsed];
    for (const item of items) {
      if (item?.type === 'sensor') onSensor(item);
      else if (item?.type === 'bridge') onBridge(item);
      else if (item?.type === 'lan') onLan(item);
      else if (CONTROL_TYPES.has(item?.type)) onControl(item);
      else onObservation(item);
    }
  }

  connect();

  return {
    close() {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
