// Texto para comparar en búsquedas: minúsculas y sin tildes ("Cámara" == "camara").
export function normalizarTexto(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
