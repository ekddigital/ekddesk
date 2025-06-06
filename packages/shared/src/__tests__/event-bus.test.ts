import { EventBus } from '../event-bus';
import { BaseEvent } from '../types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  test('should create EventBus instance', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
  });

  test('should get singleton instance', () => {
    const instance1 = EventBus.getInstance();
    const instance2 = EventBus.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should emit and listen to events', (done) => {
    const testEvent: BaseEvent = {
      type: 'test:event',
      timestamp: new Date(),
      source: 'test',
      data: { message: 'Hello World' }
    };

    eventBus.on('test:event', (event) => {
      expect(event).toEqual(testEvent);
      done();
    });

    eventBus.emit('test:event', testEvent);
  });

  test('should handle multiple listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    eventBus.on('multi:test', listener1);
    eventBus.on('multi:test', listener2);

    const testEvent: BaseEvent = {
      type: 'multi:test',
      timestamp: new Date(),
      source: 'test'
    };

    eventBus.emit('multi:test', testEvent);

    expect(listener1).toHaveBeenCalledWith(testEvent);
    expect(listener2).toHaveBeenCalledWith(testEvent);
  });

  test('should remove listeners', () => {
    const listener = jest.fn();
    
    eventBus.on('remove:test', listener);
    eventBus.off('remove:test', listener);

    const testEvent: BaseEvent = {
      type: 'remove:test',
      timestamp: new Date(),
      source: 'test'
    };

    eventBus.emit('remove:test', testEvent);
    expect(listener).not.toHaveBeenCalled();
  });

  test('should handle once listeners', () => {
    const listener = jest.fn();
    
    eventBus.once('once:test', listener);

    const testEvent: BaseEvent = {
      type: 'once:test',
      timestamp: new Date(),
      source: 'test'
    };

    eventBus.emit('once:test', testEvent);
    eventBus.emit('once:test', testEvent);

    expect(listener).toHaveBeenCalledTimes(1);
  });
  test('should emit device events', () => {
    const listener = jest.fn();
    eventBus.on('device:connected', listener);

    eventBus.emitDeviceEvent(
      'device:connected', 
      'device-123',
      'test',
      {
        id: 'device-123',
        name: 'Test Device',
        type: 'desktop',
        platform: 'windows',
        version: '1.0.0',
        ip: '192.168.1.1',
        port: 3001,
        capabilities: ['screen-share'],
        lastSeen: new Date(),
        isOnline: true
      }
    );

    expect(listener).toHaveBeenCalled();
    const calledEvent = listener.mock.calls[0][0];
    expect(calledEvent.deviceId).toBe('device-123');
  });

  test('should emit session events', () => {
    const listener = jest.fn();
    eventBus.on('session:started', listener);

    eventBus.emitSessionEvent('session:started', 'session-456', 'test');

    expect(listener).toHaveBeenCalled();
    const calledEvent = listener.mock.calls[0][0];
    expect(calledEvent.sessionId).toBe('session-456');
  });

  test('should emit network events', () => {
    const listener = jest.fn();
    eventBus.on('network:connected', listener);

    eventBus.emitNetworkEvent('network:connected', 'test', 'conn-789');

    expect(listener).toHaveBeenCalled();
    const calledEvent = listener.mock.calls[0][0];
    expect(calledEvent.connectionId).toBe('conn-789');
  });

  test('should emit media events', () => {
    const listener = jest.fn();
    eventBus.on('media:stream-started', listener);

    eventBus.emitMediaEvent('media:stream-started', 'session-123', 'video', 'test');

    expect(listener).toHaveBeenCalled();
    const calledEvent = listener.mock.calls[0][0];
    expect(calledEvent.sessionId).toBe('session-123');
    expect(calledEvent.mediaType).toBe('video');
  });

  test('should get event history', () => {
    const testEvent: BaseEvent = {
      type: 'history:test',
      timestamp: new Date(),
      source: 'test'
    };

    eventBus.emitEvent(testEvent);
    
    const history = eventBus.getEventHistory('history:test');
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('history:test');
  });

  test('should get event statistics', () => {
    eventBus.emitEvent({
      type: 'stats:test1',
      timestamp: new Date(),
      source: 'test'
    });

    eventBus.emitEvent({
      type: 'stats:test1',
      timestamp: new Date(),
      source: 'test'
    });

    eventBus.emitEvent({
      type: 'stats:test2',
      timestamp: new Date(),
      source: 'test'
    });

    const stats = eventBus.getEventStats();
    expect(stats['stats:test1']).toBe(2);
    expect(stats['stats:test2']).toBe(1);
  });
  test('should get listener count', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    eventBus.on('count:test', listener1);
    eventBus.on('count:test', listener2);

    expect(eventBus.getListenerCount('count:test')).toBe(2);
  });

  test('should list event names', () => {
    eventBus.on('event1', jest.fn());
    eventBus.on('event2', jest.fn());

    const eventNames = eventBus.getEventTypes();
    expect(eventNames).toContain('event1');
    expect(eventNames).toContain('event2');
  });

  test('should clear event history', () => {
    eventBus.emitEvent({
      type: 'clear:test',
      timestamp: new Date(),
      source: 'test'
    });

    expect(eventBus.getEventHistory()).toHaveLength(1);
    eventBus.clearHistory();
    expect(eventBus.getEventHistory()).toHaveLength(0);
  });

  test('should set max history size', () => {
    eventBus.setMaxHistorySize(2);
    
    eventBus.emitEvent({ type: 'test1', timestamp: new Date(), source: 'test' });
    eventBus.emitEvent({ type: 'test2', timestamp: new Date(), source: 'test' });
    eventBus.emitEvent({ type: 'test3', timestamp: new Date(), source: 'test' });

    const history = eventBus.getEventHistory();
    expect(history).toHaveLength(2);
    expect(history[0].type).toBe('test2');
    expect(history[1].type).toBe('test3');
  });
});
