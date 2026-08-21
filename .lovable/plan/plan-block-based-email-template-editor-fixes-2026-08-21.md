# Plan - Block-based Email Template Editor Fixes

Fix the routing structure to allow the new template editor to render and refine the UI to strictly follow the block-based mockup provided.

## User Review Required

> [!IMPORTANT]
> The editor will allow adding multiple blocks, each with its own media (image/video) and description. Are there any specific character limits for these descriptions?

## Proposed Changes

### Routing Hierarchy
- Move current `CentralMensagensPage` from `admin.central-mensagens.tsx` to a new `admin.central-mensagens.index.tsx` file.
- Update `admin.central-mensagens.tsx` to be a layout route that only renders an `<Outlet />`. This ensures sub-routes like `/template/$id` can be displayed.

### Template Editor Refinement
- **UI Structure**: Ensure the two-column layout (Editor vs Preview) is responsive and follows the visual style of the mockup.
- **Rich Text Controls**: Add visual formatting buttons (Bold, Italic, Link, etc.) to each block's description field.
- **Media Handling**: 
  - Ensure the "app_update_assets" bucket is used for all uploads.
  - Implement paste-to-upload (print/clipboard) functionality in the media block.
- **Data Persistence**: Verify the `blocks` JSONB column in `app_update_templates` stores the array of blocks correctly.

### Components
- **TemplateEditor.tsx**: Refine the layout and add a "Voltar" button that confirms if there are unsaved changes.
- **ContentBlockEditor.tsx**: Improve the drag-and-drop/upload area appearance.
- **TemplatePreview.tsx**: Ensure the blue header and block separation match the mockup exactly.

## Technical Details
- TanStack Router hierarchical routing.
- Supabase Storage for media.
- React state for live preview synchronization.
- JSONB storage for block arrays.

## Verification Plan

### Automated Tests
- Run Playwright to verify that navigating to `/admin/central-mensagens/template/new` renders the editor.
- Verify that clicking "Add Block" inserts a new section in both the editor and preview.

### Manual Verification
- Upload an image to a block and see it reflect in the preview.
- Save a draft and verify it appears in the `TemplateManager` list.
- Navigate back to the list and re-edit the draft.
