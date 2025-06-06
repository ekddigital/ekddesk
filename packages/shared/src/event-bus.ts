import { EventEmitter } from 'eventemitter3';
import { BaseEvent, DeviceEvent, SessionEvent, NetworkEvent, MediaEvent } from './types';
import { Logger } from './logger';

/**
 * Centralized event bus for EKD Desk application
 * Provides type-safe event handling with automatic logging
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private logger: Logger;
  private eventHistory: BaseEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    super();
    this.logger = Logger.createLogger('EventBus');
    this.setupErrorHandling();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  private setupErrorHandling(): void {
    this.on('error', (error: Error) => {
      this.logger.error('EventBus error', error);
    });
  }

  private addToHistory(event: BaseEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private createBaseEvent(type: string, source: string, data?: any): BaseEvent {
    return {
      type,
      timestamp: new Date(),
      source,
      data
    };
  }

  // Generic event methods
  emitEvent<T extends BaseEvent>(event: T): void {
    this.addToHistory(event);
    this.logger.debug(`Emitting event: ${event.type}`, { 
      source: event.source, 
      timestamp: event.timestamp 
    });
    this.emit(event.type, event);
  }

  onEvent<T extends BaseEvent>(eventType: string, listener: (event: T) => void): void {
    this.on(eventType, listener);
  }

  onceEvent<T extends BaseEvent>(eventType: string, listener: (event: T) => void): void {
    this.once(eventType, listener);
  }

  offEvent(eventType: string, listener?: (...args: any[]) => void): void {
    if (listener) {
      this.off(eventType, listener);
    } else {
      this.removeAllListeners(eventType);
    }
  }

  // Device events
  emitDeviceEvent(
    type: string, 
    deviceId: string, 
    source: string, 
    data?: any
  ): void {
    const event: DeviceEvent = {
      ...this.createBaseEvent(type, source, data),
      deviceId
    };
    this.emitEvent(event);
  }

  onDeviceEvent(eventType: string, listener: (event: DeviceEvent) => void): void {
    this.onEvent<DeviceEvent>(eventType, listener);
  }

  // Session events
  emitSessionEvent(
    type: string,
    sessionId: string,
    source: string,
    data?: any
  ): void {
    const event: SessionEvent = {
      ...this.createBaseEvent(type, source, data),
      sessionId
    };
    this.emitEvent(event);
  }

  onSessionEvent(eventType: string, listener: (event: SessionEvent) => void): void {
    this.onEvent<SessionEvent>(eventType, listener);
  }

  // Network events
  emitNetworkEvent(
    type: string,
    source: string,
    connectionId?: string,
    error?: Error,
    data?: any
  ): void {
    const event: NetworkEvent = {
      ...this.createBaseEvent(type, source, data),
      connectionId,
      error
    };
    this.emitEvent(event);
  }

  onNetworkEvent(eventType: string, listener: (event: NetworkEvent) => void): void {
    this.onEvent<NetworkEvent>(eventType, listener);
  }

  // Media events
  emitMediaEvent(
    type: string,
    sessionId: string,
    mediaType: 'video' | 'audio',
    source: string,
    data?: any
  ): void {
    const event: MediaEvent = {
      ...this.createBaseEvent(type, source, data),
      sessionId,
      mediaType
    };
    this.emitEvent(event);
  }

  onMediaEvent(eventType: string, listener: (event: MediaEvent) => void): void {
    this.onEvent<MediaEvent>(eventType, listener);
  }

  // Utility methods
  getEventHistory(eventType?: string, limit?: number): BaseEvent[] {
    let events = this.eventHistory;
    
    if (eventType) {
      events = events.filter(event => event.type === eventType);
    }
    
    if (limit) {
      events = events.slice(-limit);
    }
    
    return events;
  }

  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    this.eventHistory.forEach(event => {
      stats[event.type] = (stats[event.type] || 0) + 1;
    });
    
    return stats;
  }

  clearHistory(): void {
    this.eventHistory = [];
    this.logger.info('Event history cleared');
  }

  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    if (this.eventHistory.length > size) {
      this.eventHistory = this.eventHistory.slice(-size);
    }
  }

  // Debug methods
  getListenerCount(eventType?: string): number {
    if (eventType) {
      return this.listenerCount(eventType);
    }
    return this.eventNames().reduce((total, event) => {
      return total + this.listenerCount(event as string);
    }, 0);
  }

  getEventTypes(): string[] {
    return this.eventNames() as string[];
  }

  // Cleanup
  destroy(): void {
    this.removeAllListeners();
    this.eventHistory = [];
    this.logger.info('EventBus destroyed');
  }
}
