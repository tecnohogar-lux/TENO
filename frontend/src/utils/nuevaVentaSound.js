// Sonido de la animación "¡Nueva venta!" (public/sounds/nueva-venta.mp3).
//
// iPhone/Safari solo deja reproducir audio si el elemento <audio> fue "desbloqueado" dentro de un
// toque del usuario; el sonido de una venta suena después de que el servidor responde, ya fuera de
// ese toque. Por eso el primer toque/tecla en cualquier parte de la app reproduce el audio en
// silencio (muted) para dejarlo habilitado, y después se puede reproducir cuando haga falta.
// Se usa <audio> (no Web Audio) porque en iPhone no queda mudo con el interruptor de silencio.

const SRC = `${import.meta.env.BASE_URL}sounds/nueva-venta.mp3`;
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'];

let audio = null;
let unlocked = false;
// En computador y Android el sonido entra 0,5 s después de que parte la animación, para que vaya
// acompasado con ella. iPhone/iPad (iOS) lo reproducen sin demora.
const SOUND_DELAY_MS = 500;

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS se identifica como Mac
}

let delayTimer = null;
let playing = false; // mientras suena la venta, un toque del usuario no debe tocar el audio

function getAudio() {
  if (!audio) {
    audio = new Audio(SRC);
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
  }
  return audio;
}

function unlock() {
  if (unlocked || playing) return;
  const a = getAudio();
  a.muted = true;
  Promise.resolve(a.play())
    .then(() => {
      unlocked = true;
      UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlock));
      if (playing) return; // justo empezó a sonar una venta: no se interrumpe
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      if (!playing) a.muted = false; // no se pudo desbloquear con este gesto: se reintenta con el siguiente
    });
}

// Se llama una vez al montar la app.
export function installSoundUnlock() {
  if (unlocked) return () => {};
  UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));
  return () => UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlock));
}

export function playNewSaleSound() {
  playing = true; // reservado desde ya: ningún toque del usuario debe tocar el audio mientras tanto
  clearTimeout(delayTimer);

  const start = () => {
    try {
      const a = getAudio();
      a.muted = false;
      a.currentTime = 0;
      Promise.resolve(a.play()).catch(() => { playing = false; }); // si el navegador lo bloquea, la animación sigue sin sonido
    } catch {
      playing = false; // el audio puede no estar disponible
    }
  };

  const delay = isIOS() ? 0 : SOUND_DELAY_MS;
  if (delay > 0) delayTimer = setTimeout(start, delay);
  else start();
}

export function stopNewSaleSound() {
  clearTimeout(delayTimer);
  playing = false;
  if (audio) audio.pause();
}
