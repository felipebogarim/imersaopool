/**
 * Utilitários de enquadramento geográfico e cálculo de viewBox para o mapa do Brasil.
 * Permite dar zoom automático e enquadrar a região dos estados atendidos pelo representante,
 * mantendo contexto dos estados vizinhos e proporção adequada.
 */

export interface StateBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FramedViewBoxResult {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  viewBox: string;
}

/**
 * Bounding boxes exatas das 27 UFs do Brasil na projeção linear 800x800 de BRAZIL_STATE_PATHS.
 */
export const BRAZIL_STATE_BBOXES: Record<string, StateBBox> = {
  RO: { minX: 143.8, minY: 272.9, maxX: 284.4, maxY: 388.7 },
  AC: { minX: 0.3, minY: 255.4, maxX: 147.5, maxY: 337.1 },
  AM: { minX: 4.0, minY: 65.9, maxX: 358.0, maxY: 310.2 },
  RR: { minX: 183.8, minY: 4.6, maxX: 302.1, maxY: 143.4 },
  PA: { minX: 302.1, minY: 59.1, maxX: 558.7, maxY: 310.7 },
  AP: { minX: 382.6, minY: 20.1, maxX: 482.4, maxY: 136.0 },
  TO: { minX: 465.2, minY: 216.1, maxX: 566.0, maxY: 384.2 },
  MA: { minX: 504.9, minY: 132.7, maxX: 644.1, maxY: 319.2 },
  PI: { minX: 559.8, minY: 167.2, maxX: 672.6, maxY: 332.5 },
  CE: { minX: 651.7, minY: 168.2, maxX: 734.9, maxY: 270.5 },
  RN: { minX: 708.6, minY: 209.2, maxX: 780.6, maxY: 251.7 },
  PB: { minX: 704.7, minY: 233.5, maxX: 783.9, maxY: 279.5 },
  PE: { minX: 652.8, minY: 258.7, maxX: 783.4, maxY: 303.5 },
  AL: { minX: 715.2, minY: 290.0, maxX: 776.9, maxY: 324.0 },
  SE: { minX: 715.2, minY: 304.1, maxX: 752.1, maxY: 345.7 },
  BA: { minX: 548.8, minY: 284.5, maxX: 733.2, maxY: 482.8 },
  MG: { minX: 459.2, minY: 400.1, maxX: 682.9, maxY: 575.3 },
  ES: { minX: 642.5, minY: 473.8, maxX: 686.6, maxY: 542.8 },
  RJ: { minX: 582.3, minY: 532.0, maxX: 660.8, maxY: 584.7 },
  SP: { minX: 417.9, minY: 512.1, maxX: 596.7, maxY: 624.0 },
  PR: { minX: 387.6, minY: 567.6, maxX: 518.1, maxY: 652.5 },
  SC: { minX: 403.3, minY: 637.5, maxX: 512.6, maxY: 705.9 },
  RS: { minX: 328.1, minY: 660.1, maxX: 485.9, maxY: 794.8 },
  MS: { minX: 316.6, minY: 459.2, maxX: 461.4, maxY: 598.8 },
  MT: { minX: 247.4, minY: 260.4, maxX: 475.5, maxY: 476.8 },
  GO: { minX: 415.2, minY: 362.4, maxX: 561.9, maxY: 505.8 },
  DF: { minX: 514.4, minY: 425.4, maxX: 533.8, maxY: 436.5 },
};

export const DEFAULT_BRAZIL_VIEWBOX: FramedViewBoxResult = {
  x: 0,
  y: 0,
  width: 800,
  height: 800,
  centerX: 400,
  centerY: 400,
  viewBox: "0 0 800 800",
};

/**
 * Calcula o viewBox otimizado para enquadrar a região dos estados atendidos.
 * Mantém aspecto 1:1, adiciona respiro proporcional e garante que o mapa
 * mostre o contorno e contexto dos estados vizinhos.
 */
export function computeFramedViewBox(estados: string[] = []): FramedViewBoxResult {
  if (!estados || estados.length === 0) {
    return DEFAULT_BRAZIL_VIEWBOX;
  }

  const validBoxes = estados
    .map((uf) => BRAZIL_STATE_BBOXES[uf.toUpperCase()])
    .filter(Boolean);

  if (validBoxes.length === 0) {
    return DEFAULT_BRAZIL_VIEWBOX;
  }

  // Se atende mais de 18 estados (abrangência quase nacional), foca o mapa completo
  if (validBoxes.length >= 18) {
    return DEFAULT_BRAZIL_VIEWBOX;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const box of validBoxes) {
    if (box.minX < minX) minX = box.minX;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxY > maxY) maxY = box.maxY;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Padding proporcional aos limites da região atendida
  const paddingX = Math.max(50, rawW * 0.24);
  const paddingY = Math.max(50, rawH * 0.24);

  let targetW = rawW + paddingX * 2;
  let targetH = rawH + paddingY * 2;

  // Tamanho mínimo para não super-aproximar estados muito pequenos (ex: DF, SE, AL)
  const MIN_SIZE = 240;
  if (targetW < MIN_SIZE) targetW = MIN_SIZE;
  if (targetH < MIN_SIZE) targetH = MIN_SIZE;

  // Manter proporção 1:1 (quadrado)
  const size = Math.min(800, Math.max(targetW, targetH));

  // Centraliza o enquadramento na região atendida
  let x = centerX - size / 2;
  let y = centerY - size / 2;

  // Clampa nos limites [0, 800] para não vazar a malha SVG do Brasil
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + size > 800) x = Math.max(0, 800 - size);
  if (y + size > 800) y = Math.max(0, 800 - size);

  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const roundedSize = Math.round(size);

  return {
    x: roundedX,
    y: roundedY,
    width: roundedSize,
    height: roundedSize,
    centerX: Math.round(centerX),
    centerY: Math.round(centerY),
    viewBox: `${roundedX} ${roundedY} ${roundedSize} ${roundedSize}`,
  };
}
