import { useState } from 'react';

/**
 * useConfirm Hook
 * Provides an accessible confirmation dialog as a replacement for window.confirm()
 *
 * @returns {Object} Object containing confirm function and ConfirmDialog component
 *
 * @example
 * import { useConfirm } from '@/hooks/useConfirm';
 *
 * function MyComponent() {
 *   const { confirm, ConfirmDialog } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: 'Delete Item',
 *       description: 'Are you sure? This action cannot be undone.',
 *       confirmText: 'Delete',
 *       variant: 'destructive'
 *     });
 *
 *     if (confirmed) {
 *       // User confirmed - proceed with deletion
 *       deleteItem();
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       <ConfirmDialog />
 *     </>
 *   );
 * }
 */
export const useConfirm = () => {
  const [dialogConfig, setDialogConfig] = useState({
    open: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    resolve: null
  });

  /**
   * Show confirmation dialog
   * @param {Object} config - Dialog configuration
   * @param {string} config.title - Dialog title
   * @param {string} config.description - Dialog description
   * @param {string} [config.confirmText] - Confirm button text
   * @param {string} [config.cancelText] - Cancel button text
   * @param {string} [config.variant] - Button variant ('default' or 'destructive')
   * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled
   */
  const confirm = ({
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default'
  }) => {
    return new Promise((resolve) => {
      setDialogConfig({
        open: true,
        title,
        description,
        confirmText,
        cancelText,
        variant,
        resolve
      });
    });
  };

  const handleConfirm = () => {
    if (dialogConfig.resolve) {
      dialogConfig.resolve(true);
    }
    setDialogConfig((prev) => ({ ...prev, open: false }));
  };

  const handleCancel = () => {
    if (dialogConfig.resolve) {
      dialogConfig.resolve(false);
    }
    setDialogConfig((prev) => ({ ...prev, open: false }));
  };

  const ConfirmDialog = () => {
    // Import here to avoid circular dependencies
    const ConfirmDialogComponent = require('@/components/shared/ConfirmDialog').default;

    return (
      <ConfirmDialogComponent
        open={dialogConfig.open}
        onOpenChange={handleCancel}
        onConfirm={handleConfirm}
        title={dialogConfig.title}
        description={dialogConfig.description}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
        variant={dialogConfig.variant}
      />
    );
  };

  return { confirm, ConfirmDialog };
};

export default useConfirm;
