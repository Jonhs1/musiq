// Guarda qual conversa está aberta para não mostrar banner da própria conversa
let activeChatId: string | null = null;
export const setActiveChat = (id: string | null) => {
  activeChatId = id;
};
export const getActiveChat = () => activeChatId;