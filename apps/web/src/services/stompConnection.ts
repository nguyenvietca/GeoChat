import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { apiBaseUrl } from '../api/client';

export type StompConnectionState = 'connecting' | 'connected' | 'reconnecting';

export type StompDestinationHandlers = {
  onFrame: (body: string) => void;
  onStateChange: (state: StompConnectionState) => void;
};

type ActiveSubscriber = StompDestinationHandlers & {
  id: symbol;
  destination: string;
  subscription: StompSubscription | null;
};

type SharedConnection = {
  client: Client;
  subscribers: Map<symbol, ActiveSubscriber>;
  connected: boolean;
  active: boolean;
  state: StompConnectionState;
};

const activeConnections = new Map<string, SharedConnection>();

export function buildWebSocketUrl() {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  return url.toString();
}

export function subscribeToStompDestination(
  token: string,
  destination: string,
  handlers: StompDestinationHandlers,
) {
  let connection = activeConnections.get(token);
  if (!connection) {
    connection = createConnection(token);
    activeConnections.set(token, connection);
    connection.client.activate();
  }

  const subscriber: ActiveSubscriber = {
    ...handlers,
    id: Symbol(destination),
    destination,
    subscription: null,
  };
  connection.subscribers.set(subscriber.id, subscriber);

  if (connection.connected) {
    handlers.onStateChange('connected');
    subscribe(connection, subscriber);
  } else {
    handlers.onStateChange(connection.state);
  }

  return () => {
    const currentConnection = activeConnections.get(token);
    if (currentConnection !== connection || !connection) return;
    connection.subscribers.delete(subscriber.id);
    subscriber.subscription?.unsubscribe();
    subscriber.subscription = null;
    if (connection.subscribers.size === 0) {
      stopConnection(token, connection);
    }
  };
}

export function disconnectAllStompConnections() {
  for (const [token, connection] of [...activeConnections]) {
    stopConnection(token, connection);
  }
}

function createConnection(token: string): SharedConnection {
  const connection: SharedConnection = {
    client: null as unknown as Client,
    subscribers: new Map(),
    connected: false,
    active: true,
    state: 'connecting',
  };

  connection.client = new Client({
    brokerURL: buildWebSocketUrl(),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 3000,
    connectionTimeout: 10000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => undefined,
    onConnect: () => {
      if (!connection.active) return;
      connection.connected = true;
      setConnectionState(connection, 'connected');
      for (const subscriber of connection.subscribers.values()) {
        subscriber.subscription?.unsubscribe();
        subscribe(connection, subscriber);
      }
    },
    onStompError: () => setConnectionState(connection, 'reconnecting'),
    onWebSocketClose: () => {
      connection.connected = false;
      setConnectionState(connection, 'reconnecting');
    },
    onWebSocketError: () => setConnectionState(connection, 'reconnecting'),
  });

  return connection;
}

function subscribe(connection: SharedConnection, subscriber: ActiveSubscriber) {
  if (!connection.active) return;
  subscriber.subscription = connection.client.subscribe(subscriber.destination, (frame: IMessage) => {
    if (connection.active && connection.subscribers.has(subscriber.id)) {
      subscriber.onFrame(frame.body);
    }
  });
}

function setConnectionState(connection: SharedConnection, state: StompConnectionState) {
  if (!connection.active) return;
  connection.state = state;
  for (const subscriber of connection.subscribers.values()) {
    subscriber.onStateChange(state);
  }
}

function stopConnection(token: string, connection: SharedConnection) {
  if (!connection.active) return;
  connection.active = false;
  connection.connected = false;
  activeConnections.delete(token);
  for (const subscriber of connection.subscribers.values()) {
    subscriber.subscription?.unsubscribe();
    subscriber.subscription = null;
  }
  connection.subscribers.clear();
  void connection.client.deactivate().catch(() => undefined);
}