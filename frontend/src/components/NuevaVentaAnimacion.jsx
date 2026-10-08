import { useCallback, useEffect, useRef, useState } from 'react';
import useNuevaVentaStore from '../store/useNuevaVentaStore';
import { installSoundUnlock, playNewSaleSound, stopNewSaleSound } from '../utils/nuevaVentaSound';

// Animación "¡Nueva venta!" que aparece cuando un vendedor registra un retiro en tienda o un
// delivery. Se monta una sola vez en App; se dispara con showNewSale() (store/useNuevaVentaStore).

const ICONS = {
  delivery: (
    <svg viewBox="0 0 110 90" className="ns-icon" aria-hidden="true">
      <rect x="8" y="22" width="56" height="40" rx="6" fill="var(--accent)" />
      <path d="M64 34h22l14 16v12H64z" fill="var(--accent)" opacity=".85" />
      <path d="M70 38h14l9 11H70z" fill="#fff" opacity=".9" />
      <rect x="18" y="32" width="36" height="6" rx="3" fill="#fff" opacity=".7" />
      <rect x="18" y="44" width="24" height="6" rx="3" fill="#fff" opacity=".5" />
      <circle cx="28" cy="66" r="10" fill="#1d2433" /><circle cx="28" cy="66" r="4" fill="#fff" />
      <circle cx="84" cy="66" r="10" fill="#1d2433" /><circle cx="84" cy="66" r="4" fill="#fff" />
    </svg>
  ),
  retiro: (
    <svg viewBox="0 0 110 90" className="ns-icon" aria-hidden="true">
      <path d="M40 28v-6a15 15 0 0 1 30 0v6" fill="none" stroke="#1d2433" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 28h62l-5 56H29z" fill="var(--accent)" />
      <path d="M24 28h62l-1 10H25z" fill="#000" opacity=".12" />
      <path d="M55 50l3.5 7 7.5 1-5.5 5.5 1.3 7.5L55 67.5 48.2 71l1.3-7.5L44 58l7.5-1z" fill="#fff" />
    </svg>
  ),
};

const formatTotal = (n) => (typeof n === 'number' ? `$${n.toLocaleString('es-CL')}` : (n || ''));

function confetti(colors) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('div');
    c.className = 'ns-confetti';
    c.style.background = colors[i % colors.length];
    document.body.appendChild(c);
    const angle = Math.random() * Math.PI * 2;
    const dist = 140 + Math.random() * 260;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist - 120;
    const anim = c.animate([
      { transform: 'translate(-50%,-50%) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${x}px, ${y}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x * 1.1}px, ${y + 320}px) rotate(${Math.random() * 1080}deg) scale(.6)`, opacity: 0 },
    ], { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.15,.7,.4,1)' });
    anim.onfinish = () => c.remove();
    setTimeout(() => c.remove(), 3500); // por si la animación no llega a terminar (pestaña en segundo plano)
  }
}

export default function NuevaVentaAnimacion() {
  const sale = useNuevaVentaStore((s) => s.current);
  const hide = useNuevaVentaStore((s) => s.hide);
  const [closing, setClosing] = useState(false);
  const totalRef = useRef(null);
  const closeTimers = useRef([]);

  // iPhone: deja el audio habilitado desde el primer toque del usuario
  useEffect(() => installSoundUnlock(), []);

  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimers.current.push(setTimeout(() => { stopNewSaleSound(); hide(); }, 350));
  }, [hide]);

  useEffect(() => {
    if (!sale) return undefined;
    closingRef.current = false;
    setClosing(false);
    const timers = [];
    let raf = 0;
    const isRetiro = sale.type === 'retiro';

    // El total sube contando hasta su valor
    if (typeof sale.total === 'number') {
      const start = performance.now() + 650;
      const len = 800;
      const tick = (t) => {
        const p = Math.min(Math.max((t - start) / len, 0), 1);
        if (totalRef.current) totalRef.current.textContent = formatTotal(Math.round(sale.total * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    timers.push(setTimeout(() => confetti(isRetiro ? ['#7c3aed', '#a78bfa', '#f59e0b', '#22c55e'] : ['#0ea5e9', '#38bdf8', '#f59e0b', '#22c55e']), 900));
    if (sale.sound) playNewSaleSound();
    timers.push(setTimeout(close, sale.duration));

    return () => {
      timers.forEach(clearTimeout);
      closeTimers.current.forEach(clearTimeout);
      closeTimers.current = [];
      cancelAnimationFrame(raf);
    };
  }, [sale, close]);

  if (!sale) return null;
  const isRetiro = sale.type === 'retiro';
  const subtitulo = [sale.orderId && `Pedido #${sale.orderId}`, sale.seller && `por ${sale.seller}`].filter(Boolean).join(' · ');

  return (
    <div key={sale.key} className={`ns-overlay${closing ? ' ns-out' : ''}`} role="alertdialog" aria-live="assertive" aria-label="Nueva venta registrada" onClick={close}>
      <div className={`ns-card ${isRetiro ? 'retiro' : 'delivery'}`}>
        <div className="ns-check">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="ns-stage">
          <div className="ns-road" />
          <div className="ns-speed" /><div className="ns-speed" /><div className="ns-speed" />
          <div className="ns-shadow" />
          {isRetiro ? ICONS.retiro : ICONS.delivery}
        </div>
        <span className="ns-badge">{isRetiro ? '🏬 Retiro en tienda' : '🛵 Delivery'}</span>
        <h2 className="ns-title">¡Nueva venta!</h2>
        {subtitulo && <p className="ns-sub">{subtitulo}</p>}
        {typeof sale.total === 'number' && <p className="ns-total" ref={totalRef}>{formatTotal(0)}</p>}
        <div className="ns-bar" style={{ animationDuration: `${sale.duration}ms` }} />
      </div>
    </div>
  );
}
