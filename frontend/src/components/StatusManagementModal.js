import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  RotateCcw,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Predefined color palette
const COLOR_PALETTE = [
  '#6B7280', // Gray
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
];

// Sortable Status Item Component
const SortableStatusItem = ({ status, onEdit, onDelete, isEditing, editData, setEditData, onSaveEdit, onCancelEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <div {...attributes} {...listeners} className="cursor-grab p-1 touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          className="flex-1 h-8"
          placeholder="Status name"
        />
        <div className="flex items-center gap-1">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setEditData({ ...editData, color })}
              className={`w-5 h-5 rounded-full border-2 ${editData.color === color ? 'border-foreground' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`final-${status.id}`}
            checked={editData.is_final}
            onCheckedChange={(checked) => setEditData({ ...editData, is_final: checked })}
          />
          <Label htmlFor={`final-${status.id}`} className="text-xs whitespace-nowrap">Final</Label>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveEdit}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelEdit}>
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-card border rounded-lg group">
      <div {...attributes} {...listeners} className="cursor-grab p-1 touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div 
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <span className="flex-1 font-medium">{status.name}</span>
      {status.is_final && (
        <Badge variant="secondary" className="text-xs">Final</Badge>
      )}
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={() => onEdit(status)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
        onClick={() => onDelete(status)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const StatusManagementModal = ({ 
  open, 
  onOpenChange, 
  entityType, // 'space', 'project', or 'list'
  entityId,
  entityName,
  onStatusesUpdated 
}) => {
  const { token } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [inheritedFrom, setInheritedFrom] = useState(null);
  
  // Edit state
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editData, setEditData] = useState({ name: '', color: '#6B7280', is_final: false });
  
  // New status state
  const [showAddNew, setShowAddNew] = useState(false);
  const [newStatus, setNewStatus] = useState({ name: '', color: '#6B7280', is_final: false });
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [reassignTo, setReassignTo] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Get API endpoint based on entity type
  const getEndpoint = (suffix = '') => {
    switch (entityType) {
      case 'space':
        return `${API}/projects/spaces/${entityId}/statuses${suffix}`;
      case 'project':
        return `${API}/projects/${entityId}/statuses${suffix}`;
      case 'list':
        return `${API}/projects/lists/${entityId}/statuses${suffix}`;
      default:
        return '';
    }
  };

  // Fetch statuses when modal opens
  useEffect(() => {
    if (open && entityId) {
      const loadStatuses = async () => {
        setLoading(true);
        try {
          const response = await axios.get(getEndpoint(), {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStatuses(response.data.statuses || []);
          setIsCustom(response.data.is_custom);
          setInheritedFrom(response.data.inherited_from);
        } catch (error) {
          console.error('Failed to fetch statuses:', error);
          toast.error('Failed to load statuses');
        } finally {
          setLoading(false);
        }
      };
      loadStatuses();
    }
  }, [open, entityId, token, getEndpoint]);

  // Save statuses
  const saveStatuses = async (newStatuses) => {
    setSaving(true);
    try {
      await axios.put(getEndpoint(), 
        { statuses: newStatuses },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatuses(newStatuses);
      setIsCustom(true);
      setInheritedFrom(null);
      toast.success('Statuses updated');
      onStatusesUpdated?.();
    } catch (error) {
      console.error('Failed to save statuses:', error);
      toast.error('Failed to save statuses');
    } finally {
      setSaving(false);
    }
  };

  // Reset to inherited
  const resetToInherited = async () => {
    setSaving(true);
    try {
      const response = await axios.delete(getEndpoint(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatuses(response.data.statuses || []);
      setIsCustom(false);
      toast.success('Statuses reset to inherited');
      onStatusesUpdated?.();
    } catch (error) {
      console.error('Failed to reset statuses:', error);
      toast.error('Failed to reset statuses');
    } finally {
      setSaving(false);
    }
  };

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = statuses.findIndex(s => s.id === active.id);
    const newIndex = statuses.findIndex(s => s.id === over.id);
    
    const newOrder = arrayMove(statuses, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
    saveStatuses(newOrder);
  };

  // Add new status
  const handleAddStatus = () => {
    if (!newStatus.name.trim()) {
      toast.error('Status name is required');
      return;
    }

    const newStatusObj = {
      id: `status_${Date.now()}`,
      name: newStatus.name.trim(),
      color: newStatus.color,
      is_final: newStatus.is_final,
      order: statuses.length
    };

    saveStatuses([...statuses, newStatusObj]);
    setNewStatus({ name: '', color: '#6B7280', is_final: false });
    setShowAddNew(false);
  };

  // Edit status
  const startEdit = (status) => {
    setEditingStatusId(status.id);
    setEditData({ name: status.name, color: status.color, is_final: status.is_final });
  };

  const saveEdit = () => {
    if (!editData.name.trim()) {
      toast.error('Status name is required');
      return;
    }

    const updated = statuses.map(s => 
      s.id === editingStatusId 
        ? { ...s, name: editData.name.trim(), color: editData.color, is_final: editData.is_final }
        : s
    );
    saveStatuses(updated);
    setEditingStatusId(null);
  };

  const cancelEdit = () => {
    setEditingStatusId(null);
    setEditData({ name: '', color: '#6B7280', is_final: false });
  };

  // Delete status
  const handleDeleteClick = async (status) => {
    // Check if any tasks use this status
    try {
      const response = await axios.get(getEndpoint(`/${status.id}/tasks-count`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTaskCount(response.data.count);
      setDeleteConfirm(status);
      
      // Set default reassign target
      const otherStatuses = statuses.filter(s => s.id !== status.id);
      if (otherStatuses.length > 0) {
        setReassignTo(otherStatuses[0].id);
      }
    } catch (error) {
      console.error('Failed to check task count:', error);
      toast.error('Failed to check task usage');
    }
  };

  const confirmDelete = async () => {
    if (statuses.length <= 1) {
      toast.error('Cannot delete the last status');
      return;
    }

    // Reassign tasks if needed
    if (taskCount > 0 && reassignTo) {
      try {
        const params = new URLSearchParams();
        if (entityType === 'space') params.append('space_id', entityId);
        if (entityType === 'project') params.append('project_id', entityId);
        if (entityType === 'list') params.append('list_id', entityId);

        await axios.post(
          `${API}/projects/tasks/reassign-status?${params.toString()}`,
          { from_status_id: deleteConfirm.id, to_status_id: reassignTo },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('Failed to reassign tasks:', error);
        toast.error('Failed to reassign tasks');
        return;
      }
    }

    // Remove the status
    const updated = statuses.filter(s => s.id !== deleteConfirm.id).map((s, i) => ({ ...s, order: i }));
    await saveStatuses(updated);
    setDeleteConfirm(null);
    setTaskCount(0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Statuses</DialogTitle>
            <DialogDescription>
              Configure task statuses for {entityName || entityType}
              {inheritedFrom && !isCustom && (
                <span className="block text-xs mt-1">
                  Currently inheriting from {inheritedFrom}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status list with drag and drop */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={statuses.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {statuses.map((status) => (
                      <SortableStatusItem
                        key={status.id}
                        status={status}
                        onEdit={startEdit}
                        onDelete={handleDeleteClick}
                        isEditing={editingStatusId === status.id}
                        editData={editData}
                        setEditData={setEditData}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add new status form */}
              {showAddNew ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Input
                    value={newStatus.name}
                    onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                    className="flex-1 h-8"
                    placeholder="New status name"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    {COLOR_PALETTE.slice(0, 5).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewStatus({ ...newStatus, color })}
                        className={`w-5 h-5 rounded-full border-2 ${newStatus.color === color ? 'border-foreground' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new-final"
                      checked={newStatus.is_final}
                      onCheckedChange={(checked) => setNewStatus({ ...newStatus, is_final: checked })}
                    />
                    <Label htmlFor="new-final" className="text-xs">Final</Label>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddStatus}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAddNew(false)}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setShowAddNew(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Status
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isCustom && entityType !== 'space' && (
              <Button 
                variant="outline" 
                onClick={resetToInherited}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Inherited
              </Button>
            )}
            <Button 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Status</AlertDialogTitle>
            <AlertDialogDescription>
              {taskCount > 0 ? (
                <>
                  <span className="block mb-3">
                    There are <strong>{taskCount} tasks</strong> using the "{deleteConfirm?.name}" status.
                    Please select a status to reassign them to:
                  </span>
                  <Select value={reassignTo} onValueChange={setReassignTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses
                        .filter(s => s.id !== deleteConfirm?.id)
                        .map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </>
              ) : (
                `Are you sure you want to delete the "${deleteConfirm?.name}" status?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StatusManagementModal;
