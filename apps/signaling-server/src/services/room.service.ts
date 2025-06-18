import { Logger } from "@ekd-desk/shared";

export interface Room {
  id: string;
  name: string;
  hostDeviceId: string;
  participants: string[];
  maxParticipants: number;
  isPrivate: boolean;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

export interface JoinRoomRequest {
  roomId: string;
  deviceId: string;
  password?: string;
}

export class RoomManager {
  private logger = Logger.createLogger("RoomManager");
  private rooms = new Map<string, Room>();

  constructor() {
    this.logger.info("RoomManager initialized");
  }

  createRoom(
    hostDeviceId: string,
    name: string,
    options: {
      maxParticipants?: number;
      isPrivate?: boolean;
      password?: string;
      metadata?: any;
    } = {}
  ): string {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const room: Room = {
      id: roomId,
      name,
      hostDeviceId,
      participants: [hostDeviceId],
      maxParticipants: options.maxParticipants || 10,
      isPrivate: options.isPrivate || false,
      password: options.password,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata,
    };

    this.rooms.set(roomId, room);
    this.logger.info("Room created", { roomId, hostDeviceId, name });

    return roomId;
  }

  joinRoom(request: JoinRoomRequest): boolean {
    const room = this.rooms.get(request.roomId);
    if (!room) {
      this.logger.warn("Room not found", { roomId: request.roomId });
      return false;
    }

    // Check if room is full
    if (room.participants.length >= room.maxParticipants) {
      this.logger.warn("Room is full", {
        roomId: request.roomId,
        currentCount: room.participants.length,
      });
      return false;
    }

    // Check if already in room
    if (room.participants.includes(request.deviceId)) {
      this.logger.info("Device already in room", {
        roomId: request.roomId,
        deviceId: request.deviceId,
      });
      return true;
    }

    // Check password for private rooms
    if (room.isPrivate && room.password && request.password !== room.password) {
      this.logger.warn("Invalid room password", { roomId: request.roomId });
      return false;
    }

    room.participants.push(request.deviceId);
    room.updatedAt = new Date();

    this.logger.info("Device joined room", {
      roomId: request.roomId,
      deviceId: request.deviceId,
      participantCount: room.participants.length,
    });

    return true;
  }

  leaveRoom(roomId: string, deviceId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn("Room not found for leave", { roomId });
      return false;
    }

    const index = room.participants.indexOf(deviceId);
    if (index === -1) {
      this.logger.warn("Device not in room", { roomId, deviceId });
      return false;
    }

    room.participants.splice(index, 1);
    room.updatedAt = new Date();

    this.logger.info("Device left room", {
      roomId,
      deviceId,
      remainingParticipants: room.participants.length,
    });

    // If host left and there are other participants, assign new host
    if (room.hostDeviceId === deviceId && room.participants.length > 0) {
      room.hostDeviceId = room.participants[0];
      this.logger.info("New host assigned", {
        roomId,
        newHost: room.hostDeviceId,
      });
    }

    // If no participants left, delete the room
    if (room.participants.length === 0) {
      this.rooms.delete(roomId);
      this.logger.info("Room deleted (no participants)", { roomId });
    }

    return true;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter((room) => !room.isPrivate);
  }

  getRoomsByParticipant(deviceId: string): Room[] {
    return Array.from(this.rooms.values()).filter((room) =>
      room.participants.includes(deviceId)
    );
  }

  deleteRoom(roomId: string, requestingDeviceId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn("Room not found for deletion", { roomId });
      return false;
    }

    // Only host can delete the room
    if (room.hostDeviceId !== requestingDeviceId) {
      this.logger.warn("Only host can delete room", {
        roomId,
        requestingDeviceId,
        hostDeviceId: room.hostDeviceId,
      });
      return false;
    }

    this.rooms.delete(roomId);
    this.logger.info("Room deleted by host", {
      roomId,
      hostDeviceId: room.hostDeviceId,
    });

    return true;
  }

  updateRoom(
    roomId: string,
    updates: Partial<Room>,
    requestingDeviceId: string
  ): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn("Room not found for update", { roomId });
      return false;
    }

    // Only host can update the room
    if (room.hostDeviceId !== requestingDeviceId) {
      this.logger.warn("Only host can update room", {
        roomId,
        requestingDeviceId,
        hostDeviceId: room.hostDeviceId,
      });
      return false;
    }

    // Update allowed fields
    Object.assign(room, {
      ...updates,
      id: room.id, // Prevent ID change
      hostDeviceId: room.hostDeviceId, // Prevent host change via update
      createdAt: room.createdAt, // Prevent creation date change
      updatedAt: new Date(),
    });

    this.logger.info("Room updated", { roomId, updates });

    return true;
  }

  cleanup(): void {
    // Clean up old empty rooms (if any exist due to edge cases)
    const emptyRooms = Array.from(this.rooms.entries())
      .filter(([_, room]) => room.participants.length === 0)
      .map(([roomId]) => roomId);

    emptyRooms.forEach((roomId) => {
      this.rooms.delete(roomId);
    });

    if (emptyRooms.length > 0) {
      this.logger.info("Cleaned up empty rooms", { count: emptyRooms.length });
    }
  }
}
