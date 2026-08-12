import { MapaProduct } from "./types";

export const PERFIS_ANCHORS: MapaProduct[] = [
  {
    id: "spe13100",
    marca: "Newline",
    sku: "SPE13100",
    referencia: "FIT15 Slim",
    nome: "FIT15 Slim",
    descricao: "Perfil vazio para fita LED, Embutir, 1.000 mm",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "25 mm", normalized_value: "25", value_numeric: 25, value_text: null },
      altura: { attribute_key: "altura", original_value: "40 mm", normalized_value: "40", value_numeric: 40, value_text: null },
      nicho: { attribute_key: "nicho", original_value: "21 mm", normalized_value: "21", value_numeric: 21, value_text: null },
    },
    preco_base: 46.20,
    preco_normalizado: 46.20,
    price_availability: "informado",
    is_base: true,
    status: "validado"
  },
  {
    id: "spe23100",
    marca: "Newline",
    sku: "SPE23100",
    referencia: "FIT25 Slim",
    nome: "FIT25 Slim",
    descricao: "Perfil vazio para fita LED, Embutir, 1.000 mm",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "40 mm", normalized_value: "40", value_numeric: 40, value_text: null },
      altura: { attribute_key: "altura", original_value: "40 mm", normalized_value: "40", value_numeric: 40, value_text: null },
      nicho: { attribute_key: "nicho", original_value: "31 mm", normalized_value: "31", value_numeric: 31, value_text: null },
    },
    preco_base: 74.90,
    preco_normalizado: 74.90,
    price_availability: "informado",
    is_base: true,
    status: "validado"
  },
  {
    id: "spe43100",
    marca: "Newline",
    sku: "SPE43100",
    referencia: "FIT40 Slim",
    nome: "FIT40 Slim",
    descricao: "Perfil vazio para fita LED, Embutir, 1.000 mm",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "51 mm", normalized_value: "51", value_numeric: 51, value_text: null },
      altura: { attribute_key: "altura", original_value: "30 mm", normalized_value: "30", value_numeric: 30, value_text: null },
      nicho: { attribute_key: "nicho", original_value: "43 mm", normalized_value: "43", value_numeric: 43, value_text: null },
    },
    preco_base: 92.10,
    preco_normalizado: 92.10,
    price_availability: "informado",
    is_base: true,
    status: "validado"
  }
];

export const PERFIS_COMPETITORS: MapaProduct[] = [
  // FIT15 Competitors
  {
    id: "interlight-w15ep",
    marca: "Interlight",
    sku: "W15EP",
    referencia: "W15EP",
    nome: "W15EP",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "28 mm", normalized_value: "28", value_numeric: 28, value_text: null },
      altura: { attribute_key: "altura", original_value: "37 mm", normalized_value: "37", value_numeric: 37, value_text: null },
    },
    preco_base: 107.10,
    preco_normalizado: 107.10,
    price_availability: "informado",
    is_base: false,
    base_product_id: "spe13100",
    classificacao_tecnica: "direto",
    proximidade_tecnica: 95,
    status: "validado"
  },
  {
    id: "perfil-led-2325er",
    marca: "Perfil & LED",
    sku: "2325ER",
    referencia: "2325ER",
    nome: "2325ER",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "23 mm", normalized_value: "23", value_numeric: 23, value_text: null },
      altura: { attribute_key: "altura", original_value: "25 mm", normalized_value: "25", value_numeric: 25, value_text: null },
    },
    preco_base: 42.76,
    preco_normalizado: 42.76,
    price_availability: "informado",
    is_base: false,
    base_product_id: "spe13100",
    classificacao_tecnica: "aproximado",
    proximidade_tecnica: 80,
    status: "validado"
  },
  // FIT25 Competitors
  {
    id: "interlight-w25ep",
    marca: "Interlight",
    sku: "W25EP",
    referencia: "W25EP",
    nome: "W25EP",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "35 mm", normalized_value: "35", value_numeric: 35, value_text: null },
      altura: { attribute_key: "altura", original_value: "37 mm", normalized_value: "37", value_numeric: 37, value_text: null },
    },
    preco_base: 132.00,
    preco_normalizado: 132.00,
    price_availability: "informado",
    is_base: false,
    base_product_id: "spe23100",
    classificacao_tecnica: "aproximado",
    proximidade_tecnica: 85,
    status: "validado"
  },
  {
    id: "usina-polo-30695",
    marca: "Usina",
    sku: "30695",
    referencia: "Polo 30695",
    nome: "Polo 30695",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "45 mm", normalized_value: "45", value_numeric: 45, value_text: null },
      altura: { attribute_key: "altura", original_value: "27 mm", normalized_value: "27", value_numeric: 27, value_text: null },
    },
    preco_base: 93.39,
    preco_normalizado: 93.39,
    price_availability: "informado",
    is_base: false,
    base_product_id: "spe23100",
    classificacao_tecnica: "aproximado",
    proximidade_tecnica: 82,
    status: "validado"
  },
  // FIT40 Competitors
  {
    id: "interlight-w40e",
    marca: "Interlight",
    sku: "W40E",
    referencia: "W40E",
    nome: "W40E",
    specs: {
      largura_ext: { attribute_key: "largura_ext", original_value: "54 mm", normalized_value: "54", value_numeric: 54, value_text: null },
      altura: { attribute_key: "altura", original_value: "54 mm", normalized_value: "54", value_numeric: 54, value_text: null },
    },
    preco_base: 152.50,
    preco_normalizado: 152.50,
    price_availability: "informado",
    is_base: false,
    base_product_id: "spe43100",
    classificacao_tecnica: "aproximado",
    proximidade_tecnica: 88,
    status: "validado"
  }
];
