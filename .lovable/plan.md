# Plan: Implement "Mapa Preços" Dashboard

Implement a new strategic pricing intelligence dashboard within the existing "Price" area. This tool will allow competitive analysis, price simulation, and technical comparison for key product families, starting with "Perfis".

## User Review Required

- **Data Source**: Should the initial data (anchor products and competitors) be seeded directly into the database via migration or should I provide a "Load Demo Data" button for the first run? (Recommended: Migration for immediate availability).
- **Price Simulation Storage**: Should brand-level price simulations be saved per user session (local storage) or persisted to the backend to be shared across the team? (Recommended: Session-based first, with "Save Scenario" as a future backend feature).

## Proposed Changes

### 1. Database Schema
- Create `public.price_brands` for brand-level configurations (logo, global settings).
- Create `public.price_scenarios` to store user-defined simulation presets.
- Update `price_comparison_rules` to ensure "Perfis" specific attributes (nicho, largura externa, altura) are included.
- Add `GRANT` statements for all new tables.

### 2. Backend Logic (TanStack Start)
- Create `src/lib/price-mapa.functions.ts` to handle complex calculations:
    - Normalization of prices (e.g., per meter).
    - Price positioning formula (Farol: Green if cheaper, Yellow if up to 10% more, Red if >10%).
    - Scenario application (Brand A: -5%).
    - Technical proximity scoring for "Perfis".

### 3. Navigation
- Update `src/lib/nav-tree.ts` to include the "Mapa de Preços" leaf under the "Preços" group.
- Ensure proper routing in `src/routes/_authenticated/price/route.tsx`.

### 4. UI Components (`src/components/price/mapa/`)
- `MapaHeader.tsx`: Context selection (Family, Table reference), indicators, and global actions.
- `SimuladorCenarios.tsx`: Sidebar/Popover for brand-level price adjustments.
- `MapaTabela.tsx`: The main interactive matrix with configurable columns and "Farol" indicators.
- `MapaGrafico.tsx`: Visual price comparison bars and "Preço x Proximidade" scatter plot.
- `ImportadorMapa.tsx`: Enhanced upload flow with family-specific field mapping.

### 5. Routes
- Create `src/routes/_authenticated/price/mapa.tsx`: The main orchestration page.

## Technical Details
- **Farol Rule**: `((Price_Newline - Price_Comp) / Price_Comp) * 100`.
- **Perfis Anchor Products**: FIT15 Slim (SPE13100), FIT25 Slim (SPE23100), FIT40 Slim (SPE43100).
- **Permissions**: Edits restricted to `gestormaster` using existing `useIsMasterAdmin` hook.
- **Responsiveness**: Use `ScrollArea` for the large matrix on desktop; card-based summary for mobile.

