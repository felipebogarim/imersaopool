# Plan: Make Central de Mensagens Buttons Functional

The goal is to implement the full CRUD and operational logic for the "Central de Mensagens" module, ensuring all buttons (New, Edit, Delete, Send) perform their intended actions.

## User Review Required

> [!NOTE]
> The "Send Email" and "WhatsApp" actions will currently simulate the sending process (logging and showing a toast) as there is no integrated external ESP/Gateway configured yet.

## Proposed Changes

### Components - Central de Mensagens (`src/components/central-mensagens/`)

- **Create `TemplateDialog.tsx`**: A modal component to create and edit message templates.
    - Fields: Name, Subject, Intro Text, Farewell Text, Status (Draft/Published).
    - Logic for upserting into `app_update_templates`.

- **Create `ContactDialog.tsx`**: A modal component to create and edit contacts.
    - Fields: Name, Email, Phone, Tags (multi-select/comma separated), Notes, Active status.
    - Logic for upserting into `app_email_contacts`.

- **Create `GroupManagerDialog.tsx`**: A modal to manage contact groups and their members.
    - List of groups with ability to add/edit/delete.
    - Member selection interface.

- **Update `TemplateManager.tsx`**:
    - Integrate `TemplateDialog` for creation and editing.
    - Implement deletion logic with confirmation.
    - Implement "Send" flow (selecting a group/contacts and "sending").

- **Update `EmailContactsManager.tsx`**:
    - Integrate `ContactDialog` for creation and editing.
    - Integrate `GroupManagerDialog`.
    - Implement contact deletion logic.

### Database Logic
- Use `supabase` client for direct table operations.
- Ensure `updated_at` is handled on templates.

## Technical Details

- Use `react-hook-form` and `zod` for form validation within dialogs.
- Use `sonner` for feedback (success/error toasts).
- Use `shadcn/ui` components (Dialog, Form, Input, Select, etc.).

## Verification Plan

### Automated Tests
- Run Playwright scripts to:
    1. Create a new template and verify it appears in the list.
    2. Edit the template and verify changes persist.
    3. Delete the template and verify it's removed.
    4. Create a new contact and verify it appears in the list.
    5. Perform a simulated "Send" action and check for success toast.

### Manual Verification
- Verify the modal interactions are smooth and validation works as expected.
- Check the Supabase tables (`app_update_templates`, `app_email_contacts`) to ensure data is correctly stored.
