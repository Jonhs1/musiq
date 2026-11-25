// Rascunho entre a tela de envio e a de revisão. Só em memória: não persiste.
import { create } from 'zustand';
import type { MaterialDraft } from './normalize';

type DraftState = {
  draft: MaterialDraft | null;
  setDraft: (draft: MaterialDraft) => void;
  update: (change: (draft: MaterialDraft) => MaterialDraft) => void;
  clear: () => void;
};

export const useDraftStore = create<DraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  update: (change) => set((state) => (state.draft ? { draft: change(state.draft) } : {})),
  clear: () => set({ draft: null }),
}));
