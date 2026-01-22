import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * ConfirmDialog Component
 * Accessible alternative to window.confirm()
 *
 * Features:
 * - Keyboard accessible (Tab, Enter, Escape)
 * - Screen reader friendly with proper ARIA labels
 * - Customizable title, description, and button labels
 * - Focus management
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {function} props.onOpenChange - Callback when dialog open state changes
 * @param {function} props.onConfirm - Callback when user confirms
 * @param {string} props.title - Dialog title
 * @param {string} props.description - Dialog description/message
 * @param {string} [props.confirmText] - Confirm button text (default: "Confirm")
 * @param {string} [props.cancelText] - Cancel button text (default: "Cancel")
 * @param {string} [props.variant] - Confirm button variant ("default" or "destructive")
 * @returns {JSX.Element}
 *
 * @example
 * const [showConfirm, setShowConfirm] = useState(false);
 *
 * <ConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   onConfirm={() => deleteItem()}
 *   title="Delete Item"
 *   description="Are you sure you want to delete this item? This action cannot be undone."
 *   confirmText="Delete"
 *   variant="destructive"
 * />
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default"
}) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDialog;
