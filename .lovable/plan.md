# Plan: Fix Visão Imersão 2 Client Resolution and Hydration Error

The user is experiencing a loop when trying to confirm a commercial link in the "Visão Imersão 2" report, specifically for the client "V LAMPADARIO ILUMINACAO E DECORACAO LTDA". Additionally, a hydration mismatch error has been identified in the authentication page.

## User Review Required

> [!NOTE]
> No critical items requiring user attention at this stage.

## Proposed Changes

### Visão Imersão 2 (`src/routes/_authenticated/visao-imersao-2.tsx`)
- **Fix Resolution Persistence:** Ensure `confirmarVinculo` correctly updates the `structured_data` in the database and that the local state (`avulso`) is updated immediately to reflect the change, preventing the UI from reverting to the "ambiguous" state.
- **Avoid Search Loop:** Add a check to skip fuzzy search if a valid `resolved_client_id` is already present in the `avulso.data`.
- **Reliable Data Fetching:** Ensure the commercial data query (`vi2-commercial`) correctly prioritizes the newly linked ID.

### Authentication (`src/routes/auth.tsx`)
- **Fix Hydration Mismatch:** Wrap the main content of `AuthPage` in a check or component that ensures it only renders on the client, or use `useHydrated` hook to avoid rendering elements like `PoolFlowLogo` based on search params that might not be available during SSR.

## Technical Details
- The loop in `visao-imersao-2.tsx` likely happens because the `useQuery` for commercial data triggers a refetch that might find multiple candidates again if the persistence hasn't fully propagated to the query's dependency keys.
- I will ensure the `queryKey` includes the `resolved_client_id` if present in state.
- For the hydration fix, I'll use a `mounted` state in `AuthPage` to delay rendering until after the first client-side effect.

## Verification Plan

### Automated Tests
- Run Playwright scripts to:
  1. Navigate to `/visao-imersao-2`.
  2. Open a report with ambiguity.
  3. Click "Confirmar vínculo".
  4. Verify that the "Ambiguidade comercial" alert disappears and performance data is loaded.
  5. Reload the page and verify the link is preserved.

### Manual Verification
- Check the authentication page at `/auth` to ensure the hydration warning is no longer present in the console.
