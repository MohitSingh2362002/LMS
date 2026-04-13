import { useEffect, useRef } from 'react';
import { useSession } from '../context/SessionContext';

export function useChatMessages() {
  const { state, sendChatMessage, dispatch } = useSession();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatMessages]);

  const clearUnread = () => dispatch({ type: 'CLEAR_UNREAD' });

  return {
    messages: state.chatMessages,
    sendChatMessage,
    unreadCount: state.unreadCount,
    clearUnread,
    bottomRef,
  };
}
