# Assets inline do e-mail Newline

Os PNGs oficiais do e-mail Newline agora ficam versionados em:

- `src/lib/internal-tickets/email/assets/logo-newline.png`
- `src/lib/internal-tickets/email/assets/icon-newline.png`

Eles são incorporados diretamente ao bundle server via Vite (`?inline`) sem dependência de filesystem local.
Content-IDs: `newline-logo` e `newline-icon`. Não substituir por imagens geradas ou URLs públicas.
