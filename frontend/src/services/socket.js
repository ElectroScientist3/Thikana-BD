export { socket, connectSocket, disconnectSocket } from './socketService';

import { socket } from './socketService';

export function getSocket() {
  return socket;
}
