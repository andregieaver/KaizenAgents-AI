import { Badge } from "@/components/ui/badge";

/**
 * StatusBadge Component
 * Displays a colored badge based on conversation/item status
 *
 * @param {Object} props
 * @param {string} props.status - Status value ('open', 'waiting', 'resolved', 'closed', etc.)
 * @returns {JSX.Element}
 */
const StatusBadge = ({ status }) => {
  const variants = {
    open: { variant: 'default', label: 'Open' },
    waiting: { variant: 'secondary', label: 'Waiting' },
    resolved: { variant: 'outline', label: 'Resolved' },
    closed: { variant: 'outline', label: 'Closed' },
    pending: { variant: 'secondary', label: 'Pending' },
    active: { variant: 'default', label: 'Active' },
    inactive: { variant: 'destructive', label: 'Inactive' },
  };

  const config = variants[status?.toLowerCase()] || variants.open;

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default StatusBadge;
