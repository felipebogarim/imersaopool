import { describe, expect, it } from "vitest";
import type { ProductRow } from "./price-comparativos-data";
import { buildPricingResolvedProduct, type PricingPriceRow } from "./pricing-lookup";
import {
  effectivePricingSide,
  emptyPricingSide,
  pricingSnapshot,
  sideFromResolution,
} from "./pricing-workspace";

describe("Pricing workspace", () => {
  it("não usa preço total da bobina como R$/m em entrada manual", () => {
    const side = emptyPricingSide();
    side.identity = {
      code: "MANUAL-1",
      brand: "Marca",
      description: "Fita manual",
      family: "Fitas e Fontes",
      category: "Fitas LED",
      type: "",
    };
    side.manualPrice.originalPrice = "59,90";
    side.manualPrice.originalUnit = "bobina";
    const effective = effectivePricingSide(side);
    expect(effective.originalPrice).toBe(59.9);
    expect(effective.comparablePrice).toBeNull();
  });

  it("mantém preço original no snapshot e aplica R$/m somente quando informado", () => {
    const side = emptyPricingSide();
    side.identity = {
      code: "FT2307",
      brand: "Studio",
      description: "Fita",
      family: "Fitas e Fontes",
      category: "Fitas LED",
      type: "",
    };
    side.manualPrice.originalPrice = "59.90";
    side.manualPrice.originalUnit = "bobina";
    side.manualPrice.pricePerMeter = "11.98";
    const snapshot = pricingSnapshot(effectivePricingSide(side));
    expect(snapshot.price.comparable_price).toBe(11.98);
    expect(snapshot.price.original_price).toBe(59.9);
  });

  it("preserva o preço original encontrado ao complementar somente o preço por metro", () => {
    const product = {
      id: "studio-ft2307",
      marca: "Studio",
      is_base: true,
      familia: "Fitas e Fontes",
      categoria: "Fitas LED",
      tipo: null,
      sku: "FT2307",
      referencia: null,
      nome: "FT2307",
      descricao: "Fita",
      imagem_url: null,
      status: "ativo",
      source_file: "catalogo.xlsx",
      source_page: null,
      source_date: null,
      updated_at: "2026-09-29T00:00:00Z",
    } satisfies ProductRow;
    const price = {
      id: "price-1",
      product_id: product.id,
      price: 59.9,
      price_unit: "bobina",
      price_per_meter: null,
      price_list_name: null,
      effective_date: null,
      source_file: "precos.xlsx",
      region: null,
      price_availability: "informado",
    } satisfies PricingPriceRow;
    const resolution = buildPricingResolvedProduct(product, {}, [price]);
    const side = sideFromResolution("FT2307", resolution);
    side.manualPrice.pricePerMeter = "11,98";

    const effective = effectivePricingSide(side);
    expect(effective.comparablePrice).toBe(11.98);
    expect(effective.originalPrice).toBe(59.9);
    expect(effective.originalUnit).toBe("bobina");
  });
});
