import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import StatusManagementModal from '../components/StatusManagementModal';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
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
  ArrowLeft,
  Plus,
  Search,
  Settings,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  User,
  Flag,
  GripVertical,
  Loader2,
  CheckCircle2,
  Circle,
  List,
  LayoutGrid,
  GanttChart,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Priority colors
const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

// Sortable Task Card Component
const SortableTaskCard = ({ task, onEdit, onDelete, onStatusChange, statuses }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityClass = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const currentStatus = statuses.find(s => s.id === task.status);

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group hover:shadow-md transition-all cursor-pointer mb-1.5 sm:mb-2">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-start gap-1.5 sm:gap-2">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-0.5 sm:p-1 rounded hover:bg-muted text-muted-foreground touch-none mt-0.5"
            >
              <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1 sm:gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-xs sm:text-sm truncate">{task.title}</h4>
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 sm:mt-1 hidden sm:block">
                      {task.description}
                    </p>
                  )}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:opacity-0 sm:group-hover:opacity-100">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(task)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(task)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Task metadata */}
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                {task.priority && (
                  <Badge variant="secondary" className={`text-[10px] sm:text-xs py-0 ${priorityClass}`}>
                    <Flag className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    {task.priority}
                  </Badge>
                )}
                {task.due_date && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-0.5 sm:gap-1">
                    <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {format(new Date(task.due_date), 'MMM d')}
                  </span>
                )}
                {task.assigned_to_name && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-0.5 sm:gap-1 hidden sm:flex">
                    <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {task.assigned_to_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Droppable Status Column Component
const StatusColumn = ({ status, tasks, onEditTask, onDeleteTask, statuses }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  const taskIds = tasks.map(t => t.id);

  return (
    <div className="flex-1 min-w-[240px] sm:min-w-[280px] max-w-[350px]">
      {/* Status Header */}
      <div 
        className="flex items-center gap-2 mb-2 sm:mb-3 pb-2 border-b"
        style={{ borderBottomColor: status.color }}
      >
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <h3 className="font-medium text-xs sm:text-sm truncate">{status.name}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tasks.length}
        </Badge>
        {status.is_final && (
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        )}
      </div>
      
      {/* Tasks Container */}
      <div
        ref={setNodeRef}
        className={`min-h-[150px] sm:min-h-[200px] p-1.5 sm:p-2 rounded-lg transition-colors ${
          isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length > 0 ? (
            tasks.map(task => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                statuses={statuses}
              />
            ))
          ) : (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
              <Circle className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
              No tasks
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

// Task Dialog Component
const TaskDialog = ({ open, onOpenChange, task, listId, statuses, onSave, onDelete }) => {
  // Initialize form data based on task prop
  const initialFormData = task ? {
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    due_date: task.due_date ? task.due_date.split('T')[0] : '',
    assigned_to: task.assigned_to || '',
  } : {
    title: '',
    description: '',
    status: statuses[0]?.id || 'todo',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
  };

  const [formData, setFormData] = useState(initialFormData);

  // Reset form when dialog opens with different task
  const prevTaskIdRef = useRef(task?.id);
  if (prevTaskIdRef.current !== task?.id) {
    prevTaskIdRef.current = task?.id;
    // This is safe - we're updating during render based on prop change
    if (formData.title !== initialFormData.title || formData.status !== initialFormData.status) {
      setFormData(initialFormData);
    }
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Add Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update task details' : 'Create a new task in this list'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Task description (optional)"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>
        </div>
        
        <DialogFooter>
          {task && (
            <Button 
              variant="destructive" 
              onClick={() => onDelete(task)}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main List Detail Component
const ListDetail = () => {
  const { projectId, listId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [list, setList] = useState(null);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'list', 'kanban', 'gantt'
  
  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  // Drag state
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch list data
  const fetchListData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch project details (includes lists and tasks)
      const projectResponse = await axios.get(`${API}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProject(projectResponse.data);
      
      // Find the current list
      const currentList = projectResponse.data.lists?.find(l => l.id === listId);
      if (currentList) {
        setList(currentList);
        setTasks(currentList.tasks || []);
      }
      
      // Fetch statuses for this list (with inheritance)
      const statusResponse = await axios.get(`${API}/projects/lists/${listId}/statuses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatuses(statusResponse.data.statuses || []);
    } catch (error) {
      console.error('Failed to fetch list data:', error);
      toast.error('Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [projectId, listId, token]);

  useEffect(() => {
    fetchListData();
  }, [fetchListData]);

  // Group tasks by status
  const tasksByStatus = statuses.reduce((acc, status) => {
    acc[status.id] = tasks
      .filter(t => t.status === status.id)
      .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return acc;
  }, {});

  // Handle drag start
  const handleDragStart = (event) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task);
  };

  // Handle drag end
  const handleDragEnd = async (event) => {
    setActiveTask(null);
    const { active, over } = event;
    
    if (!over) return;
    
    const activeTaskId = active.id;
    const overId = over.id;
    
    // Find the task being dragged
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (!activeTask) return;
    
    // Determine target status
    let targetStatus = overId;
    let targetIndex = 0;
    
    // Check if dropped on another task
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      targetStatus = overTask.status;
      // Get position within status
      const statusTasks = tasks.filter(t => t.status === targetStatus);
      targetIndex = statusTasks.findIndex(t => t.id === overId);
    } else {
      // Dropped on status column itself
      targetStatus = overId;
      const statusTasks = tasks.filter(t => t.status === targetStatus);
      targetIndex = statusTasks.length;
    }
    
    // Check if status changed
    const statusChanged = activeTask.status !== targetStatus;
    
    // Update locally first (optimistic)
    let newTasks = [...tasks];
    const activeIndex = newTasks.findIndex(t => t.id === activeTaskId);
    
    if (statusChanged) {
      // Update task status
      newTasks[activeIndex] = { ...newTasks[activeIndex], status: targetStatus };
    }
    
    // Reorder within the status
    const statusTasks = newTasks
      .filter(t => t.status === targetStatus)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const oldIndexInStatus = statusTasks.findIndex(t => t.id === activeTaskId);
    if (oldIndexInStatus !== -1 && oldIndexInStatus !== targetIndex) {
      const reorderedTasks = arrayMove(statusTasks, oldIndexInStatus, targetIndex);
      // Update order values
      reorderedTasks.forEach((t, i) => {
        const idx = newTasks.findIndex(nt => nt.id === t.id);
        if (idx !== -1) {
          newTasks[idx] = { ...newTasks[idx], order: i };
        }
      });
    }
    
    setTasks(newTasks);
    
    // Save to backend
    try {
      if (statusChanged) {
        await axios.put(
          `${API}/projects/${projectId}/tasks/${activeTaskId}`,
          { status: targetStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      // Save order
      const orderedTaskIds = newTasks
        .filter(t => t.status === targetStatus)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(t => t.id);
      
      await axios.post(
        `${API}/projects/lists/${listId}/tasks/reorder`,
        { task_ids: orderedTaskIds, status: targetStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
      fetchListData(); // Revert on error
    }
  };

  // Create task
  const handleCreateTask = async (formData) => {
    try {
      const response = await axios.post(
        `${API}/projects/${projectId}/tasks`,
        {
          ...formData,
          list_id: listId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(prev => [...prev, response.data]);
      setShowTaskDialog(false);
      toast.success('Task created');
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    }
  };

  // Update task
  const handleUpdateTask = async (formData) => {
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${editingTask.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(prev => prev.map(t => 
        t.id === editingTask.id ? { ...t, ...formData } : t
      ));
      setShowTaskDialog(false);
      setEditingTask(null);
      toast.success('Task updated');
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  // Delete task
  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    
    try {
      await axios.delete(`${API}/projects/${projectId}/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(prev => prev.filter(t => t.id !== task.id));
      setShowTaskDialog(false);
      setEditingTask(null);
      toast.success('Task deleted');
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  };

  // Open edit task dialog
  const openEditTask = (task) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  };

  // Open create task dialog
  const openCreateTask = () => {
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <h2 className="text-lg font-medium mb-2">List not found</h2>
        <Button variant="outline" onClick={() => navigate(`/dashboard/projects/${projectId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={() => navigate(`/dashboard/projects/${projectId}`)}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold truncate">{list.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {project?.name} • {tasks.length} tasks
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-muted rounded-lg p-0.5 sm:p-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-7 w-7 sm:h-7 sm:w-auto sm:px-2 p-0"
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-7 w-7 sm:h-7 sm:w-auto sm:px-2 p-0"
                title="Kanban View"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('gantt')}
                className="h-7 w-7 sm:h-7 sm:w-auto sm:px-2 p-0"
                title="Gantt View"
              >
                <GanttChart className="h-4 w-4" />
              </Button>
            </div>
            
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowStatusModal(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" className="h-8" onClick={openCreateTask}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Task</span>
            </Button>
          </div>
        </div>
        
        {/* Search - Always visible but responsive */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      {/* Content based on View Mode */}
      {viewMode === 'kanban' && (
        <ScrollArea className="flex-1">
          <div className="p-2 sm:p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-2 sm:gap-4 min-w-max pb-4">
                {statuses.map(status => (
                  <StatusColumn
                    key={status.id}
                    status={status}
                    tasks={tasksByStatus[status.id] || []}
                    onEditTask={openEditTask}
                    onDeleteTask={handleDeleteTask}
                    statuses={statuses}
                  />
                ))}
              </div>
              
              <DragOverlay>
                {activeTask && (
                  <Card className="shadow-xl w-[240px] sm:w-[280px]">
                    <CardContent className="p-2 sm:p-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{activeTask.title}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </ScrollArea>
      )}
      
      {viewMode === 'list' && (
        <ScrollArea className="flex-1">
          <div className="p-2 sm:p-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header - Desktop */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-sm font-medium border-b">
                <div className="col-span-5">Task</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Priority</div>
                <div className="col-span-2">Due Date</div>
                <div className="col-span-1"></div>
              </div>
              
              {/* Task Rows */}
              {tasks
                .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(task => {
                  const taskStatus = statuses.find(s => s.id === task.status);
                  const priorityClass = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
                  
                  return (
                    <div 
                      key={task.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => openEditTask(task)}
                    >
                      {/* Mobile Layout */}
                      <div className="sm:hidden p-3">
                        <div className="flex items-start gap-2">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleUpdateTask({ status: task.status === 'done' ? statuses[0]?.id : 'done' }); 
                            }}
                            className="flex-shrink-0 mt-0.5"
                          >
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {taskStatus && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                  style={{ borderColor: taskStatus.color, color: taskStatus.color }}
                                >
                                  {taskStatus.name}
                                </Badge>
                              )}
                              <Badge variant="secondary" className={`text-xs ${priorityClass}`}>
                                {task.priority}
                              </Badge>
                              {task.due_date && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(task.due_date), 'MMM d')}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Desktop Layout */}
                      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                        <div className="col-span-5 flex items-center gap-2">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleUpdateTask({ status: task.status === 'done' ? statuses[0]?.id : 'done' }); 
                            }}
                            className="flex-shrink-0"
                          >
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <span className={`truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                        <div className="col-span-2">
                          {taskStatus && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: taskStatus.color, color: taskStatus.color }}
                            >
                              {taskStatus.name}
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-2">
                          <Badge variant="secondary" className={`text-xs ${priorityClass}`}>
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="col-span-2 text-sm text-muted-foreground">
                          {task.due_date ? format(new Date(task.due_date), 'MMM d') : '-'}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              
              {tasks.length === 0 && (
                <div className="text-center py-8 sm:py-12 text-muted-foreground">
                  <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tasks yet</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      )}
      
      {viewMode === 'gantt' && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
          <div className="text-center">
            <GanttChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Gantt View</p>
            <p className="text-sm">Coming soon - add start and due dates to tasks to use Gantt view</p>
          </div>
        </div>
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        task={editingTask}
        listId={listId}
        statuses={statuses}
        onSave={editingTask ? handleUpdateTask : handleCreateTask}
        onDelete={handleDeleteTask}
      />

      {/* Status Management Modal */}
      <StatusManagementModal
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        entityType="list"
        entityId={listId}
        entityName={list.name}
        onStatusesUpdated={fetchListData}
      />
    </div>
  );
};

export default ListDetail;
