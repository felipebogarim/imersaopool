export type StatePath = {
  id: string;
  name: string;
  d: string;
  centroid: { x: number; y: number };
};

// SVG Paths das 27 Unidades Federativas do Brasil mapeadas no sistema 800x800
export const BRAZIL_STATE_PATHS: StatePath[] = [
  {
    id: "SP",
    name: "São Paulo",
    centroid: { x: 504, y: 566 },
    d: "M 464 544 L 496 524 L 540 520 L 560 550 L 536 580 L 496 588 L 468 568 Z",
  },
  {
    id: "RJ",
    name: "Rio de Janeiro",
    centroid: { x: 574, y: 562 },
    d: "M 556 552 L 588 546 L 596 564 L 564 574 Z",
  },
  {
    id: "MG",
    name: "Minas Gerais",
    centroid: { x: 546, y: 486 },
    d: "M 496 524 L 520 440 L 584 430 L 610 500 L 588 546 L 556 552 L 540 520 Z",
  },
  {
    id: "ES",
    name: "Espírito Santo",
    centroid: { x: 610, y: 524 },
    d: "M 596 512 L 620 508 L 614 542 L 592 544 Z",
  },
  {
    id: "PR",
    name: "Paraná",
    centroid: { x: 472, y: 618 },
    d: "M 444 590 L 504 584 L 520 626 L 448 644 Z",
  },
  {
    id: "SC",
    name: "Santa Catarina",
    centroid: { x: 486, y: 662 },
    d: "M 452 642 L 520 638 L 512 676 L 460 678 Z",
  },
  {
    id: "RS",
    name: "Rio Grande do Sul",
    centroid: { x: 456, y: 720 },
    d: "M 440 674 L 512 676 L 490 766 L 424 740 Z",
  },
  {
    id: "MS",
    name: "Mato Grosso do Sul",
    centroid: { x: 412, y: 524 },
    d: "M 368 476 L 444 472 L 464 544 L 436 578 L 364 542 Z",
  },
  {
    id: "MT",
    name: "Mato Grosso",
    centroid: { x: 364, y: 396 },
    d: "M 296 324 L 424 316 L 444 472 L 368 476 L 304 420 Z",
  },
  {
    id: "GO",
    name: "Goiás",
    centroid: { x: 486, y: 440 },
    d: "M 448 420 L 516 392 L 520 440 L 496 524 L 444 472 Z",
  },
  {
    id: "DF",
    name: "Distrito Federal",
    centroid: { x: 504, y: 440 },
    d: "M 498 436 L 510 436 L 510 444 L 498 444 Z",
  },
  {
    id: "BA",
    name: "Bahia",
    centroid: { x: 606, y: 384 },
    d: "M 540 336 L 634 314 L 664 396 L 610 500 L 546 430 Z",
  },
  {
    id: "TO",
    name: "Tocantins",
    centroid: { x: 494, y: 326 },
    d: "M 464 266 L 520 256 L 524 374 L 468 376 Z",
  },
  {
    id: "MA",
    name: "Maranhão",
    centroid: { x: 546, y: 226 },
    d: "M 504 176 L 576 186 L 568 274 L 510 264 Z",
  },
  {
    id: "PI",
    name: "Piauí",
    centroid: { x: 596, y: 256 },
    d: "M 568 214 L 618 206 L 624 304 L 566 280 Z",
  },
  {
    id: "CE",
    name: "Ceará",
    centroid: { x: 652, y: 204 },
    d: "M 624 176 L 678 184 L 670 234 L 626 216 Z",
  },
  {
    id: "RN",
    name: "Rio Grande do Norte",
    centroid: { x: 700, y: 206 },
    d: "M 678 194 L 720 196 L 716 220 L 676 216 Z",
  },
  {
    id: "PB",
    name: "Paraíba",
    centroid: { x: 704, y: 230 },
    d: "M 670 220 L 736 218 L 730 240 L 666 238 Z",
  },
  {
    id: "PE",
    name: "Pernambuco",
    centroid: { x: 672, y: 256 },
    d: "M 618 252 L 742 240 L 734 268 L 624 274 Z",
  },
  {
    id: "AL",
    name: "Alagoas",
    centroid: { x: 692, y: 284 },
    d: "M 672 272 L 714 268 L 706 294 L 668 290 Z",
  },
  {
    id: "SE",
    name: "Sergipe",
    centroid: { x: 672, y: 310 },
    d: "M 658 296 L 688 294 L 678 322 L 650 316 Z",
  },
  {
    id: "PA",
    name: "Pará",
    centroid: { x: 432, y: 214 },
    d: "M 344 120 L 514 136 L 504 266 L 416 312 L 324 240 Z",
  },
  {
    id: "AP",
    name: "Amapá",
    centroid: { x: 456, y: 104 },
    d: "M 428 66 L 476 74 L 468 142 L 432 136 Z",
  },
  {
    id: "AM",
    name: "Amazonas",
    centroid: { x: 236, y: 214 },
    d: "M 100 136 L 344 120 L 324 240 L 264 316 L 90 274 Z",
  },
  {
    id: "RR",
    name: "Roraima",
    centroid: { x: 256, y: 90 },
    d: "M 224 40 L 296 46 L 286 136 L 216 128 Z",
  },
  {
    id: "RO",
    name: "Rondônia",
    centroid: { x: 236, y: 326 },
    d: "M 180 286 L 264 300 L 296 354 L 210 376 Z",
  },
  {
    id: "AC",
    name: "Acre",
    centroid: { x: 108, y: 296 },
    d: "M 44 266 L 140 256 L 176 304 L 88 322 Z",
  },
];
