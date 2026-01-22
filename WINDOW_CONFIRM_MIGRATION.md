# Migrating from window.confirm to Accessible Dialogs

## Why Migrate?

The native `window.confirm()` dialog has several issues:
- **Not accessible**: Poor screen reader support and limited keyboard navigation
- **Not customizable**: Cannot style or brand to match your app
- **Blocks the UI thread**: Freezes the entire application until user responds
- **Poor UX**: Looks different across browsers and operating systems

## New Accessible Solution

We've created an accessible confirmation dialog system that:
- ✅ Full keyboard navigation (Tab, Enter, Escape)
- ✅ Screen reader friendly with proper ARIA labels
- ✅ Customizable appearance matching our design system
- ✅ Non-blocking with Promise-based API
- ✅ Focus management and trap

## Implementation Options

### Option 1: Using the useConfirm Hook (Recommended)

The `useConfirm` hook provides a clean API similar to `window.confirm()` but fully accessible.

**Before:**
```javascript
const handleDelete = () => {
  if (window.confirm('Are you sure you want to delete this item?')) {
    deleteItem();
  }
};
```

**After:**
```javascript
import { useConfirm } from '@/hooks/useConfirm';

function MyComponent() {
  const { confirm, ConfirmDialog } = useConfirm();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Item',
      description: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive' // Use 'destructive' for dangerous actions
    });

    if (confirmed) {
      deleteItem();
    }
  };

  return (
    <>
      <button onClick={handleDelete}>Delete</button>
      <ConfirmDialog />
    </>
  );
}
```

### Option 2: Using ConfirmDialog Component Directly

For more control, use the component directly with state management.

```javascript
import { useState } from 'react';
import { ConfirmDialog } from '@/components/shared';

function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    deleteItem();
    setShowConfirm(false);
  };

  return (
    <>
      <button onClick={handleDelete}>Delete</button>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={confirmDelete}
        title="Delete Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
```

## Files to Migrate

The following files currently use `window.confirm` and should be migrated:

1. **frontend/src/pages/RateLimits.js** - Delete rate limit confirmation
2. **frontend/src/pages/PlanManagement.js** - Delete plan confirmation
3. **frontend/src/pages/MenusList.js** - Delete menu confirmation
4. **frontend/src/pages/DiscountCodes.js** - Delete discount code confirmation
5. **frontend/src/pages/EmailTemplates.js** - Delete template confirmation
6. **frontend/src/pages/Billing.js** - Cancel subscription confirmation
7. **frontend/src/pages/Agents.js** - Delete agent confirmation
8. **frontend/src/pages/AgentVersionHistory.js** - Delete version confirmation
9. **frontend/src/pages/AgentConfiguration.js** - Delete configuration confirmation

## Migration Steps

For each file:

1. **Import the hook**:
   ```javascript
   import { useConfirm } from '@/hooks/useConfirm';
   ```

2. **Initialize in component**:
   ```javascript
   const { confirm, ConfirmDialog } = useConfirm();
   ```

3. **Replace window.confirm**:
   - Find: `if (window.confirm('message'))`
   - Replace with: `if (await confirm({ title: '...', description: '...' }))`

4. **Add ConfirmDialog to JSX**:
   ```javascript
   return (
     <>
       {/* Your existing JSX */}
       <ConfirmDialog />
     </>
   );
   ```

5. **Make function async** (if not already):
   ```javascript
   const handleDelete = async () => {
     // Now you can use await
   };
   ```

## Examples by Use Case

### Destructive Actions (Delete, Cancel, etc.)

```javascript
const confirmed = await confirm({
  title: 'Delete Item',
  description: 'This action cannot be undone.',
  confirmText: 'Delete',
  variant: 'destructive'
});
```

### Confirmation Actions (Save, Continue, etc.)

```javascript
const confirmed = await confirm({
  title: 'Save Changes',
  description: 'Do you want to save your changes?',
  confirmText: 'Save',
  cancelText: 'Discard'
});
```

### Warning Actions

```javascript
const confirmed = await confirm({
  title: 'Cancel Subscription',
  description: 'You will lose access to premium features. Are you sure?',
  confirmText: 'Yes, Cancel',
  cancelText: 'Keep Subscription',
  variant: 'destructive'
});
```

## Testing Accessibility

After migration, test:

1. **Keyboard Navigation**:
   - Tab to move between buttons
   - Enter to confirm
   - Escape to cancel

2. **Screen Reader**:
   - Dialog announces title and description
   - Buttons are properly labeled
   - Focus returns to trigger after closing

3. **Visual**:
   - Dialog is centered and prominent
   - Backdrop dims the background
   - Buttons are clearly distinguishable

## Benefits

- ✅ **Accessibility**: WCAG 2.1 AA compliant
- ✅ **UX**: Consistent, branded experience
- ✅ **Maintainability**: Centralized component
- ✅ **Testability**: Easier to test than native dialogs
- ✅ **Customization**: Can add icons, custom actions, etc.

## Questions?

See the component documentation in:
- `/frontend/src/components/shared/ConfirmDialog.js`
- `/frontend/src/hooks/useConfirm.js`
