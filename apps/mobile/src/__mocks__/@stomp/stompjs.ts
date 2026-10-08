// Mock for @stomp/stompjs
export class Client {
  connectHeaders: Record<string, string> = {};
  reconnectDelay = 0;
  connectionTimeout = 0;
  appendMissingNULLonIncoming = false;
  debug: (() => void) | null = null;
  onConnect: (() => void) | null = null;
  onStompError: (() => void) | null = null;
  onWebSocketClose: (() => void) | null = null;
  onWebSocketError: (() => void) | null = null;
  brokerURL = '';

  private _subscriptions: Map<string, (frame: { body: string }) => void> = new Map();
  private _active = false;

  constructor(config: Partial<Client>) {
    Object.assign(this, config);
  }

  activate() {
    this._active = true;
    // Simulate immediate connect in tests
    if (this.onConnect) {
      this.onConnect();
    }
  }

  async deactivate() {
    this._active = false;
  }

  subscribe(destination: string, callback: (frame: { body: string }) => void): { unsubscribe: () => void } {
    this._subscriptions.set(destination, callback);
    return {
      unsubscribe: () => {
        this._subscriptions.delete(destination);
      },
    };
  }

  // Test helper: simulate receiving a message
  _simulateMessage(body: string) {
    for (const callback of this._subscriptions.values()) {
      callback({ body });
    }
  }

  // Test helper: simulate error
  _simulateError() {
    if (this.onStompError) {
      this.onStompError();
    }
  }

  // Test helper: simulate disconnect
  _simulateDisconnect() {
    if (this.onWebSocketClose) {
      this.onWebSocketClose();
    }
  }
}

export type IMessage = { body: string };
export type StompSubscription = { unsubscribe: () => void };
