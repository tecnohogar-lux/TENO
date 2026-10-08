import { create } from 'zustand';

// Estado de la animación "¡Nueva venta!": solo hay una a la vez (una nueva reemplaza a la anterior).
const useNuevaVentaStore = create((set) => ({
  current: null,
  show: (opts) => set((state) => ({ current: { ...opts, key: (state.current?.key || 0) + 1 } })),
  hide: () => set({ current: null }),
}));

// type: 'retiro' | 'delivery'. Se puede llamar desde cualquier parte (no solo desde componentes).
export function showNewSale({ type = 'delivery', seller = '', orderId = '', total = null, duration = 5600, sound = true } = {}) {
  useNuevaVentaStore.getState().show({ type, seller, orderId, total, duration, sound });
}

export default useNuevaVentaStore;
