import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { connectSocket, disconnectSocket } from '../services/socketService';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
      setOnlineUsers(new Set());
      return undefined;
    }

    const nextSocket = connectSocket(token, false);
    if (!nextSocket) return undefined;
    setSocket(nextSocket);

    const handleConnect = () => {
      setConnected(true);
      setReconnecting(false);
    };
    const handleDisconnect = () => {
      setConnected(false);
      setReconnecting(true);
    };
    const handleConnectError = () => {
      setConnected(false);
      setReconnecting(true);
    };
    const handleOnline = (userId) => setOnlineUsers((current) => new Set(current).add(String(userId)));
    const handleOnlineUsers = (userIds) => setOnlineUsers(new Set((userIds || []).map((userId) => String(userId))));
    const handleOffline = (userId) => setOnlineUsers((current) => {
      const next = new Set(current);
      next.delete(String(userId));
      return next;
    });

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('connect_error', handleConnectError);
    nextSocket.on('user-online', handleOnline);
    nextSocket.on('online-users', handleOnlineUsers);
    nextSocket.on('user-offline', handleOffline);
    if (nextSocket.connected) handleConnect();
    else nextSocket.connect();

    return () => {
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off('connect_error', handleConnectError);
      nextSocket.off('user-online', handleOnline);
      nextSocket.off('online-users', handleOnlineUsers);
      nextSocket.off('user-offline', handleOffline);
    };
  }, [token]);

  const value = useMemo(() => ({
    socket,
    connected,
    reconnecting,
    onlineUsers,
    isUserOnline: (userId) => onlineUsers.has(String(userId)),
  }), [socket, connected, reconnecting, onlineUsers]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside SocketProvider');
  return context;
}
