import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
// Breadcrumb components removed - using header breadcrumbs from DashboardLayout
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import StatusManagementModal from '../components/StatusManagementModal';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  List,
  LayoutGrid,
  GanttChart,
  Calendar,
  User,
  Flag,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  GripVertical,
  Link2,
  Clock,
  Settings,
  X,
  Folder
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Priority colors
const PRIORITY_COLORS = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300' },
  urgent: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
};

// Status colors (default)
const STATUS_COLORS = {
  todo: { bg: 'bg-gray-500', text: 'text-gray-600' },
  in_progress: { bg: 'bg-blue-500', text: 'text-blue-600' },
  review: { bg: 'bg-purple-500', text: 'text-purple-600' },
  done: { bg: 'bg-green-500', text: 'text-green-600' },
};

// Draggable Task Card for Kanban
const KanbanTaskCard = ({ task, onEdit, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isBeingDragged,
  } = useSortable({ 
    id: task.id,
    data: { type: 'task', task, status: task.status }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isBeingDragged ? 0.5 : 1,
  };

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-background border rounded mb-2 transition-all select-none ${
        isBeingDragged ? 'shadow ring-2 ring-primary/30 scale-105 z-50' : 'hover:shadow-sm'
      }`}
    >
      <div className="flex">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-6 flex-shrink-0 cursor-grab active:cursor-grabbing bg-muted/30 hover:bg-muted rounded-l touch-none"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <div 
          className="flex-1 p-3 cursor-pointer"
          onClick={() => onEdit(task)}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-sm font-medium line-clamp-2">{task.title}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs ${priorityColor.bg} ${priorityColor.text}`}>
              {task.priority}
            </Badge>
            {task.due_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
          
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              {task.subtasks.filter(s => s.status === 'done').length}/{task.subtasks.length} subtasks
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Droppable Kanban Column
const KanbanColumn = ({ status, tasks, onEdit, projectStatuses }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: { type: 'column', status: status.id }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded p-3 transition-colors ${
        isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <h3 className="font-medium text-sm">{status.name}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-300px)]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="min-h-[100px]">
            {tasks.map(task => (
              <KanbanTaskCard key={task.id} task={task} onEdit={onEdit} />
            ))}
            {tasks.length === 0 && (
              <div className={`text-center py-8 text-sm border-2 border-dashed rounded ${
                isOver ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'
              }`}>
                {isOver ? 'Drop here' : 'No tasks'}
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
};

// List View Task Row (Sortable)
const SortableTaskRow = ({ task, onEdit, onStatusChange, projectStatuses, level = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const completedSubtasks = task.subtasks?.filter(s => s.status === 'done').length || 0;
  
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

  // Get status info
  const taskStatus = projectStatuses?.find(s => s.id === task.status) || 
    projectStatuses?.find(s => s.name?.toLowerCase() === task.status);

  return (
    <>
      <div 
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors ${
          level > 0 ? 'pl-6 bg-muted/20' : ''
        } ${isDragging ? 'bg-muted/80' : ''}`}
        onClick={() => onEdit(task)}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-6 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {hasSubtasks ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-5" />
        )}
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done'); 
          }}
          className="flex-shrink-0"
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        
        <span className={`flex-1 text-sm truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </span>
        
        {/* Status Badge */}
        {taskStatus && (
          <Badge 
            variant="outline" 
            className="text-xs"
            style={{ 
              borderColor: taskStatus.color,
              color: taskStatus.color 
            }}
          >
            {taskStatus.name}
          </Badge>
        )}
        
        <Badge className={`text-xs ${priorityColor.bg} ${priorityColor.text}`}>
          {task.priority}
        </Badge>
        
        {task.due_date && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        
        {hasSubtasks && (
          <span className="text-xs text-muted-foreground">
            {completedSubtasks}/{task.subtasks.length}
          </span>
        )}
      </div>
      
      {expanded && hasSubtasks && task.subtasks.map(subtask => (
        <SortableTaskRow 
          key={subtask.id} 
          task={subtask} 
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          projectStatuses={projectStatuses}
          level={level + 1}
        />
      ))}
    </>
  );
};

// Droppable Status Column within a List
const ListStatusColumn = ({ listId, status, tasks, onEditTask, onStatusChange, projectStatuses }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `list-${listId}-status-${status.id}`,
    data: { type: 'status', listId, statusId: status.id }
  });
  
  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] rounded p-2 transition-colors ${
        isOver ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <div 
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="text-xs font-medium">{status.name}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">{tasks.length}</Badge>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1 min-h-[60px]">
          {tasks.map(task => (
            <MiniTaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onStatusChange={onStatusChange}
              projectStatuses={projectStatuses}
            />
          ))}
          {tasks.length === 0 && (
            <div className={`text-center py-4 text-xs border border-dashed rounded ${
              isOver ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'
            }`}>
              {isOver ? 'Drop here' : 'Empty'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// Mini Task Card for List View Kanban
const MiniTaskCard = ({ task, onEdit, onStatusChange, projectStatuses }) => {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-background border rounded p-2 cursor-pointer hover:shadow-sm transition-all ${
        isDragging ? 'shadow ring-1 ring-primary/30' : ''
      }`}
    >
      <div className="flex items-start gap-1.5">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0" onClick={() => onEdit(task)}>
          <p className={`text-xs font-medium truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Badge className={`text-[10px] px-1 py-0 h-4 ${priorityColor.bg} ${priorityColor.text}`}>
              {task.priority}
            </Badge>
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// List Card Component - Navigates to List Detail Page
const ListCard = ({ list, projectId, onManageStatuses }) => {
  const navigate = useNavigate();
  const taskCount = list.tasks?.length || 0;
  const completedCount = list.tasks?.filter(t => t.status === 'done').length || 0;
  
  return (
    <Card 
      className="group cursor-pointer hover:shadow-md transition-all"
      onClick={() => navigate(`/dashboard/projects/${projectId}/lists/${list.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10"
            >
              <List className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{list.name}</h3>
              <p className="text-sm text-muted-foreground">
                {completedCount}/{taskCount} tasks completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{taskCount}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManageStatuses?.(list); }}>
                  <Settings className="h-4 w-4 mr-2" /> Manage Statuses
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Task Row (for vertical list within a list)
const ListViewTaskRow = ({ task, status, onEdit, onStatusChange, projectStatuses }) => {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2 px-2 hover:bg-muted/50 rounded cursor-pointer transition-colors ${
        isDragging ? 'bg-muted/80 shadow' : ''
      }`}
      onClick={() => onEdit(task)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done'); 
        }}
        className="flex-shrink-0"
      >
        {task.status === 'done' ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      <span className={`flex-1 text-sm truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
        {task.title}
      </span>
      
      {status && (
        <Badge 
          variant="outline" 
          className="text-[10px] px-1.5 h-5"
          style={{ borderColor: status.color, color: status.color }}
        >
          {status.name}
        </Badge>
      )}
      
      <Badge className={`text-[10px] px-1.5 h-5 ${priorityColor.bg} ${priorityColor.text}`}>
        {task.priority}
      </Badge>
      
      {task.due_date && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(task.due_date), 'MMM d')}
        </span>
      )}
    </div>
  );
};

// Gantt Chart View
const GanttView = ({ tasks, dependencies, onEdit, projectStatuses }) => {
  const ganttRef = useRef(null);
  
  // Filter tasks that have dates
  const tasksWithDates = tasks.filter(t => t.start_date || t.due_date);
  
  // Calculate date range from tasks using useMemo
  const dateRange = useMemo(() => {
    if (tasksWithDates.length === 0) {
      return { start: new Date(), end: addDays(new Date(), 30) };
    }
    
    let minDate = new Date();
    let maxDate = addDays(new Date(), 30);
    
    tasksWithDates.forEach(task => {
      if (task.start_date) {
        const start = new Date(task.start_date);
        if (start < minDate) minDate = start;
      }
      if (task.due_date) {
        const end = new Date(task.due_date);
        if (end > maxDate) maxDate = end;
      }
    });
    
    return {
      start: startOfWeek(minDate),
      end: addDays(endOfWeek(maxDate), 7)
    };
  }, [tasksWithDates]);
  
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  const dayWidth = 40;
  const rowHeight = 40;
  
  // Get status color
  const getStatusColor = (status) => {
    const statusConfig = projectStatuses.find(s => s.id === status);
    return statusConfig?.color || '#6B7280';
  };
  
  // Calculate task bar position
  const getTaskBar = (task) => {
    const startDate = task.start_date ? new Date(task.start_date) : (task.due_date ? new Date(task.due_date) : null);
    const endDate = task.due_date ? new Date(task.due_date) : startDate;
    
    if (!startDate) return null;
    
    const startDiff = differenceInDays(startDate, dateRange.start);
    const duration = Math.max(1, differenceInDays(endDate, startDate) + 1);
    
    return {
      left: startDiff * dayWidth,
      width: duration * dayWidth - 4,
    };
  };
  
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex border-b bg-muted/50">
        <div className="w-64 flex-shrink-0 p-3 font-medium border-r">Task</div>
        <div 
          className="flex overflow-x-auto"
          style={{ width: `${days.length * dayWidth}px` }}
        >
          {days.map((day, i) => (
            <div 
              key={i}
              className={`flex-shrink-0 text-center text-xs py-2 border-r ${
                day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/30' : ''
              }`}
              style={{ width: dayWidth }}
            >
              <div className="font-medium">{format(day, 'd')}</div>
              <div className="text-muted-foreground">{format(day, 'EEE')}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Task rows */}
      <div className="overflow-auto max-h-[calc(100vh-350px)]" ref={ganttRef}>
        {tasksWithDates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No tasks with dates</p>
            <p className="text-sm">Add start/end dates to tasks to see them in Gantt view</p>
          </div>
        ) : (
          tasksWithDates.map((task, index) => {
            const bar = getTaskBar(task);
            
            return (
              <div key={task.id} className="flex border-b hover:bg-muted/30">
                <div 
                  className="w-64 flex-shrink-0 p-3 border-r flex items-center gap-2 cursor-pointer"
                  onClick={() => onEdit(task)}
                >
                  <div 
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getStatusColor(task.status) }}
                  />
                  <span className="text-sm truncate">{task.title}</span>
                </div>
                <div 
                  className="relative"
                  style={{ 
                    width: `${days.length * dayWidth}px`,
                    height: rowHeight 
                  }}
                >
                  {/* Day grid lines */}
                  {days.map((day, i) => (
                    <div 
                      key={i}
                      className={`absolute top-0 bottom-0 border-r ${
                        day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/20' : ''
                      }`}
                      style={{ left: i * dayWidth, width: dayWidth }}
                    />
                  ))}
                  
                  {/* Task bar */}
                  {bar && (
                    <div
                      className="absolute top-2 h-6 rounded cursor-pointer transition-all hover:opacity-80"
                      style={{
                        left: bar.left,
                        width: bar.width,
                        backgroundColor: getStatusColor(task.status),
                      }}
                      onClick={() => onEdit(task)}
                      title={`${task.title}\n${task.start_date || ''} - ${task.due_date || ''}`}
                    >
                      <span className="text-xs text-white px-2 truncate block leading-6">
                        {task.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t bg-muted/30">
        <span className="text-xs text-muted-foreground">Status:</span>
        {projectStatuses.map(status => (
          <div key={status.id} className="flex items-center gap-1">
            <div 
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="text-xs">{status.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Task Edit Dialog
const TaskDialog = ({ open, onOpenChange, task, projectId, lists, statuses, onSave, onDelete, token }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    list_id: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    start_date: '',
    estimated_hours: ''
  });
  const [checklists, setChecklists] = useState([]);
  const [newChecklistName, setNewChecklistName] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        list_id: task.list_id || (lists.length > 0 ? lists[0].id : ''),
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        due_date: task.due_date || '',
        start_date: task.start_date || '',
        estimated_hours: task.estimated_hours || ''
      });
      setChecklists(task.checklists || []);
    } else if (open && lists.length > 0) {
      setFormData({
        title: '',
        description: '',
        list_id: lists[0].id,
        status: 'todo',
        priority: 'medium',
        due_date: '',
        start_date: '',
        estimated_hours: ''
      });
      setChecklists([]);
    }
  }, [task, lists, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.list_id) {
      toast.error('Please select a list');
      return;
    }
    setLoading(true);
    try {
      await onSave(formData, checklists);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChecklist = () => {
    if (!newChecklistName.trim()) return;
    setChecklists(prev => [...prev, {
      id: `temp-${Date.now()}`,
      name: newChecklistName,
      items: []
    }]);
    setNewChecklistName('');
  };

  const handleChecklistItemToggle = (checklistId, itemId) => {
    setChecklists(prev => prev.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(item => 
            item.id === itemId ? { ...item, is_completed: !item.is_completed } : item
          )
        };
      }
      return cl;
    }));
  };

  const handleAddChecklistItem = (checklistId, text) => {
    if (!text.trim()) return;
    setChecklists(prev => prev.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: [...cl.items, { id: `temp-${Date.now()}`, text, is_completed: false }]
        };
      }
      return cl;
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Task description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>List</Label>
              <Select 
                value={formData.list_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, list_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map(list => (
                    <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
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

            <div className="space-y-2">
              <Label htmlFor="estimated">Estimated Hours</Label>
              <Input
                id="estimated"
                type="number"
                step="0.5"
                value={formData.estimated_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Checklists */}
          <div className="space-y-3">
            <Label>Checklists</Label>
            
            {checklists.map(checklist => (
              <Card key={checklist.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{checklist.name}</span>
                  <button 
                    type="button"
                    onClick={() => setChecklists(prev => prev.filter(c => c.id !== checklist.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {checklist.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox 
                        checked={item.is_completed}
                        onCheckedChange={() => handleChecklistItemToggle(checklist.id, item.id)}
                      />
                      <span className={`text-sm ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                  <Input
                    placeholder="Add item..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem(checklist.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </Card>
            ))}
            
            <div className="flex gap-2">
              <Input
                placeholder="New checklist name..."
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddChecklist}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {task && onDelete && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => { onDelete(task.id); onOpenChange(false); }}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {task ? 'Update' : 'Create'} Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Project Detail Component
const ProjectDetail = () => {
  const { projectId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'kanban', 'gantt'
  const [search, setSearch] = useState('');
  
  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showListDialog, setShowListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // Status management modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalEntity, setStatusModalEntity] = useState({ type: null, id: null, name: null });
  
  // Kanban drag state
  const [activeTask, setActiveTask] = useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Open status management modal for list
  const openListStatusModal = (list) => {
    setStatusModalEntity({ type: 'list', id: list.id, name: list.name });
    setShowStatusModal(true);
  };

  const fetchProject = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProject(response.data);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast.error('Failed to load project');
      navigate('/dashboard/projects');
    } finally {
      setLoading(false);
    }
  }, [projectId, token, navigate]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleCreateTask = async (formData, checklists) => {
    try {
      // Clean up empty values
      const cleanedData = {
        title: formData.title,
        list_id: formData.list_id,
        status: formData.status || 'todo',
        priority: formData.priority || 'medium',
      };
      
      // Only add optional fields if they have values
      if (formData.description) cleanedData.description = formData.description;
      if (formData.due_date) cleanedData.due_date = formData.due_date;
      if (formData.start_date) cleanedData.start_date = formData.start_date;
      if (formData.estimated_hours) cleanedData.estimated_hours = parseFloat(formData.estimated_hours);
      
      const response = await axios.post(
        `${API}/projects/${projectId}/tasks`,
        cleanedData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Add checklists if any
      if (checklists.length > 0) {
        for (const checklist of checklists) {
          await axios.post(
            `${API}/projects/${projectId}/tasks/${response.data.id}/checklists`,
            { name: checklist.name, items: checklist.items },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      }
      
      toast.success('Task created');
      fetchProject();
    } catch (error) {
      console.error('Task creation error:', error.response?.data);
      toast.error(error.response?.data?.detail || 'Failed to create task');
      throw error;
    }
  };

  const handleUpdateTask = async (formData, checklists) => {
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${editingTask.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task updated');
      fetchProject();
    } catch (error) {
      toast.error('Failed to update task');
      throw error;
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await axios.delete(
        `${API}/projects/${projectId}/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task deleted');
      fetchProject();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${taskId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchProject();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await axios.post(
        `${API}/projects/${projectId}/lists`,
        { name: newListName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewListName('');
      setShowListDialog(false);
      toast.success('List created');
      fetchProject();
    } catch (error) {
      toast.error('Failed to create list');
    }
  };

  const handleDragStart = (event) => {
    const task = project.all_tasks?.find(t => t.id === event.active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    
    if (!over) return;
    
    const taskId = active.id;
    const newStatus = over.data?.current?.status || over.id;
    
    const task = project.all_tasks?.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    
    // Optimistic update
    setProject(prev => ({
      ...prev,
      all_tasks: prev.all_tasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    }));
    
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${taskId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      fetchProject(); // Revert on error
      toast.error('Failed to update task');
    }
  };

  // Handler for List View drag and drop (moving tasks between status columns within lists)
  const handleListDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    
    if (!over) return;
    
    const taskId = active.id;
    const task = project.all_tasks?.find(t => t.id === taskId);
    if (!task) return;
    
    // Check if dropped on a status column within a list
    const overData = over.data?.current;
    
    if (overData?.type === 'status') {
      const newStatusId = overData.statusId;
      const targetListId = overData.listId;
      
      // Check if status changed
      if (task.status === newStatusId && task.list_id === targetListId) return;
      
      const oldListId = task.list_id;
      const updates = { status: newStatusId };
      
      // If moving to a different list as well
      if (task.list_id !== targetListId) {
        updates.list_id = targetListId;
      }
      
      // Optimistic update
      setProject(prev => {
        const updatedTask = { ...task, ...updates };
        
        return {
          ...prev,
          all_tasks: prev.all_tasks.map(t => 
            t.id === taskId ? updatedTask : t
          ),
          lists: prev.lists.map(list => {
            if (list.id === oldListId && oldListId !== targetListId) {
              return {
                ...list,
                tasks: (list.tasks || []).filter(t => t.id !== taskId)
              };
            }
            if (list.id === targetListId) {
              if (oldListId === targetListId) {
                // Same list, just update the task
                return {
                  ...list,
                  tasks: (list.tasks || []).map(t => t.id === taskId ? updatedTask : t)
                };
              } else {
                // Different list, add the task
                return {
                  ...list,
                  tasks: [...(list.tasks || []), updatedTask]
                };
              }
            }
            return list;
          })
        };
      });
      
      try {
        await axios.put(
          `${API}/projects/${projectId}/tasks/${taskId}`,
          updates,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        fetchProject();
        toast.error('Failed to update task');
      }
    }
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-96 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  const taskStatuses = project.task_statuses || [];
  const lists = project.lists || [];
  const allTasks = project.all_tasks || [];
  
  // Group tasks by status for Kanban
  const tasksByStatus = taskStatuses.reduce((acc, status) => {
    acc[status.id] = allTasks.filter(t => t.status === status.id && !t.parent_task_id);
    return acc;
  }, {});

  // Filter tasks by search
  const filteredTasks = allTasks.filter(task => 
    task.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: project.color ? `${project.color}20` : '#6366F120' }}
            >
              <Folder className="h-5 w-5" style={{ color: project.color || '#6366F1' }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-7 px-2"
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-7 px-2"
                title="Kanban View"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('gantt')}
                className="h-7 px-2"
                title="Gantt View"
              >
                <GanttChart className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={openCreateTask}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
        
        {/* Search and filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowListDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add List
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* List View */}
        {viewMode === 'list' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleListDragEnd}
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {lists.map(list => (
                  <ListCard
                    key={list.id}
                    list={list}
                    projectId={projectId}
                    onManageStatuses={openListStatusModal}
                  />
                ))}
              </div>
            </ScrollArea>
            <DragOverlay>
              {activeTask && (
                <div className="bg-background border rounded p-2 shadow-lg w-64">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{activeTask.title}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 p-4 overflow-x-auto h-full">
              {taskStatuses.map(status => (
                <KanbanColumn
                  key={status.id}
                  status={status}
                  tasks={tasksByStatus[status.id]?.filter(t => 
                    t.title.toLowerCase().includes(search.toLowerCase())
                  ) || []}
                  onEdit={openEditTask}
                  projectStatuses={taskStatuses}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="w-72">
                  <KanbanTaskCard task={activeTask} isDragging />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Gantt View */}
        {viewMode === 'gantt' && (
          <div className="p-4 h-full overflow-auto">
            <GanttView
              tasks={filteredTasks.filter(t => !t.parent_task_id)}
              dependencies={project.dependencies || []}
              onEdit={openEditTask}
              projectStatuses={taskStatuses}
            />
          </div>
        )}
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        task={editingTask}
        projectId={projectId}
        lists={lists}
        statuses={taskStatuses}
        onSave={editingTask ? handleUpdateTask : handleCreateTask}
        onDelete={editingTask ? handleDeleteTask : null}
        token={token}
      />

      {/* Add List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add List</DialogTitle>
            <DialogDescription>Create a new list to organize tasks</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Backlog, In Review"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateList}>Create List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Management Modal */}
      <StatusManagementModal
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        entityType={statusModalEntity.type}
        entityId={statusModalEntity.id}
        entityName={statusModalEntity.name}
        onStatusesUpdated={fetchProject}
      />
    </div>
  );
};

export default ProjectDetail;
