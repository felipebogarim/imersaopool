# Plan: Complete "Mapa Preços" Strategic Dashboard

Develop the comprehensive strategic pricing dashboard within the existing "Price" area. This plan implements the remaining features requested: detailed matrix, column control, simulation by brand, advanced filters, visual charts, and the data loading system.

## User Review Required

- **Data Seeding**: I will implement a "Load Initial Data" function for the Perfis family to populate the âncora products (FIT15, FIT25, FIT40) and identified competitors as specified. Should this happen automatically on first visit?
- **Column Persistence**: Column visibility preferences will be stored in `localStorage` for now.
- **AI Processing**: For the "Carregar dados" feature, I will prepare the structure for AI-driven PDF/Image parsing using the existing AI gateway.

## Proposed Changes

### 1. Enhanced Components (`src/components/price/mapa/`)
- `CenárioSimulador.tsx`: Sidebar for independent brand-level adjustments (e.g., Usina -5%, Interlight +3%).
- `MatrixMapa.tsx`: High-density interactive table with configurable columns and Farol indicators.
- `FiltrosMapa.tsx`: Advanced filter panel with multiple criteria (price range, technical proximity, etc.).
- `GraficosMapa.tsx`: Bar charts for price comparison and "Price x Proximidade" scatter plot.
- `ImportadorMapa.tsx`: Multi-format upload flow (PDF, Excel, Images) with family selection.

### 2. Logic & State Management
- `src/lib/price-mapa/state.ts`: Manage scenarios, brand adjustments, and filtered views.
- `src/lib/price-mapa/normalization.ts`: Handle "Price per meter" normalizations for different families.

### 3. Implementation of anchor products
- Populate `FIT15 Slim (SPE13100)`, `FIT25 Slim (SPE23100)`, and `FIT40 Slim (SPE43100)` with their detailed dimensions and anchor prices.
- Load initial competitor data for Interlight, Perfil & LED, Usina, Spotline, Astraled, and Nordecor.

### 4. Permissions & History
- Enforce `gestormaster` restrictions for editing and deleting.
- Implement an audit trail system for price changes and validation status.

## Technical Details
- **Formula**: `((Newline - Comp) / Comp) * 100`.
- **Colors**: Green (< Comp), Yellow (0-10% > Comp), Red (> 10% > Comp).
- **Proximidade Index**: 0-100 based on technical attributes (Nicho, Largura, Height).
