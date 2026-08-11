# Navigation and Menu Restructuring

Restructure the system's navigation and menu to follow a new 10-section architecture, and implement the new executive Home page.

## User Review Required

> [!IMPORTANT]
> The "Home" page implementation includes placeholders for "Mercado & Concorrência" and "Plano de Voo 2026" as these features are currently in development.

## Proposed Changes

### Navigation (NAV_TREE)
Reorganize the `NAV_TREE` in `src/lib/nav-tree.ts` into 10 mandatory sections:
1. **HOME**: Dashboard-style entry point.
2. **PERFORMANCE**: Includes Performance Reps and BI Clientes.
3. **IMERSÕES**: Analytical views (Consolidated, Rep View, Immersions).
4. **PREÇOS**: Comparativos, Mapa de Preços (WIP), Simulador (WIP).
5. **MAPA DE AÇÕES**: New section for strategic planning.
6. **INPUTS E RELATÓRIOS**: Raw data collection (Immersions, Insights, Interviews, Forms).
7. **DADOS DE MERCADO**: Tables and Competitors.
8. **BASES**: Core records (Reps, Clients, Scripts).
9. **FERRAMENTAS**: Productivity tools (Gen Performance, Transcription, Tasks, Manuals, Price Table).
10. **ADMIN**: Governance (Security, Compliance, MFA, Audit, LGPD, Backup, Users).

### Home Page
Implement the executive `Home` page in `src/routes/_authenticated/home.tsx` with 4 main areas:
- **Painel Geral de Performance**: Attainment and Family views.
- **Ecossistema de Imersões**: Radar chart and Rep view links.
- **Estratégia & Price**: Link to Comparativos and placeholders.
- **Central de Ações e Gestão**: Links to Kanban and Tools.

### Components & Routes
- Update `src/components/AppShell.tsx` to handle new navigation groups and icons.
- Create/Update functional routes for the new structure:
    - `/performance/reps` (formerly `representantes/performance`)
    - `/performance/bi-clientes` (new analytical route)
    - `/mapa-acoes` (new placeholder)
    - `/precos/mapa` and `/precos/simulador` (placeholders)

## Technical Details

### File Structure Changes
- **src/lib/nav-tree.ts**: Complete rewrite of `NAV_TREE` constant.
- **src/routes/_authenticated/home.tsx**: Implementation of the executive dashboard using Tailwind v4.
- **src/components/AppShell.tsx**: Update `ICONS` mapping and navigation rendering logic.
- **New Routes**:
    - `src/routes/_authenticated/performance.reps.tsx`: Wrapper for existing performance logic.
    - `src/routes/_authenticated/performance.bi-clientes.tsx`: New component using `BISection`.
    - `src/routes/_authenticated/mapa-acoes.index.tsx`: Placeholder for Action Map.
    - `src/routes/_authenticated/precos.mapa.tsx`: Placeholder.
    - `src/routes/_authenticated/precos.simulador.tsx`: Placeholder.

### Permissions Mapping
Ensuring all existing admin and management permissions (e.g., `has_role(..., 'admin')`) are correctly mapped to the new navigation keys.
