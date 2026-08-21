# Plan: Implement Block-based Email Template Editor

The goal is to replace the simple template dialog with a full-page, block-based editor as per the user's reference image. This will allow structuring messages with multiple blocks containing media and rich text.

## Proposed Changes

### Routes
- **Create `src/routes/_authenticated/admin.central-mensagens.template.$id.tsx`**:
    - Full-page layout with two columns.
    - Left column: Editor form.
    - Right column: Live preview.
    - Handle `$id` being "new" or an existing UUID.

### Components - Template Editor (`src/components/central-mensagens/`)
- **Create `TemplateEditor.tsx`**: The main component for the new editor page.
    - States for intro, name, blocks, farewell, and status.
    - Logic to add/remove/reorder content blocks.
- **Create `ContentBlockEditor.tsx`**: Sub-component for individual blocks.
    - Media upload placeholder.
    - Video URL input.
    - Rich text editor for "Texto descritivo" (using a simple editor or standard textarea with formatting buttons as in the image).
- **Create `TemplatePreview.tsx`**: Live preview component that renders the current state of the template.

### Navigation & Integration
- **Update `TemplateManager.tsx`**:
    - Redirect "Novo Template" to `/admin/central-mensagens/template/new`.
    - Redirect "Edit" action to `/admin/central-mensagens/template/[id]`.
    - Remove the `TemplateDialog` integration.

### Database
- Ensure the `blocks` column in `app_update_templates` stores the array of content blocks.
- Update persistence logic to handle the full structure.

## Technical Details
- Use `shadcn/ui` components for the layout (Card, Button, Input, Textarea).
- Implement image upload to Supabase Storage (already bucket `app-assets` or similar).
- For rich text, use a simple implementation with `selectionStart/End` for the toolbar buttons if a full lib like Tiptap is overkill, or just follow the visual pattern.

## Verification Plan
- Manual testing of the full flow:
    1. Navigate to "Novo Template".
    2. Fill intro, name, add 2 blocks with images and text.
    3. Verify the live preview updates in real-time.
    4. Save as draft and verify it appears in the list.
    5. Re-edit and verify all data is restored correctly.
