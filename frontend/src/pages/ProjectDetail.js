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
import { Progress } from '../components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
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
  closestCorners,
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
  arrayMove,
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
  Folder,
  ListChecks,
  Tag,
  Filter,
  Layers
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

// Sortable List Card Component - Navigates to List Detail Page
const SortableListCard = ({ list, projectId, onManageStatuses, onEditList, onDeleteList }) => {
  const navigate = useNavigate();
  const taskCount = list.tasks?.length || 0;
  const completedCount = list.tasks?.filter(t => t.status === 'done').length || 0;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`group cursor-pointer hover:shadow-md transition-all ${isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
      onClick={() => navigate(`/dashboard/projects/${projectId}/lists/${list.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="flex items-center justify-center w-8 h-8 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted rounded touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>
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
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditList?.(list); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManageStatuses?.(list); }}>
                  <Settings className="h-4 w-4 mr-2" /> Manage Statuses
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDeleteList?.(list); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete List
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


// =============================================================================
// PROJECT-LEVEL TASK VIEW COMPONENTS
// =============================================================================

// Sortable Task Card for Project-level Kanban
const SortableProjectTaskCard = ({ task, onEdit, onDelete, projectLists }) => {
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
  const listName = projectLists.find(l => l.id === task.list_id)?.name || 'Unknown List';
  
  // Calculate subtask progress
  const subtasks = task.subtasks || [];
  const subtaskCount = subtasks.length;
  const completedSubtasks = subtasks.filter(st => st.status === 'done' || st.completed).length;
  const subtaskProgress = subtaskCount > 0 ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group hover:shadow-md transition-all cursor-pointer mb-2">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground touch-none mt-0.5"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm truncate" onClick={() => onEdit(task)}>
                  {task.title}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(task)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* List indicator */}
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {listName}
              </p>
              
              {/* Subtask Progress */}
              {subtaskCount > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ListChecks className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {completedSubtasks}/{subtaskCount}
                    </span>
                    <span className="text-xs font-medium text-primary ml-auto">
                      {subtaskProgress}%
                    </span>
                  </div>
                  <Progress value={subtaskProgress} className="h-1.5" />
                </div>
              )}
              
              {/* Metadata */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className={`text-xs py-0 ${priorityClass.text} ${priorityClass.bg}`}>
                  <Flag className="h-3 w-3 mr-1" />
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Phase Column for Kanban View
const PhaseColumn = ({ phase, tasks, onEditTask, onDeleteTask, phases, projectLists }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: phase.id,
  });

  const taskIds = tasks.map(t => t.id);

  return (
    <div className="flex-shrink-0 w-[300px]">
      {/* Phase Header */}
      <div 
        className="flex items-center gap-2 mb-3 pb-2 border-b"
        style={{ borderBottomColor: phase.color }}
      >
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: phase.color }}
        />
        <h3 className="font-medium text-sm truncate">{phase.name}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tasks.length}
        </Badge>
        {phase.is_final && (
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        )}
      </div>
      
      {/* Tasks Container */}
      <div
        ref={setNodeRef}
        className={`min-h-[200px] p-2 rounded-lg transition-colors ${
          isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length > 0 ? (
            tasks.map(task => (
              <SortableProjectTaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                projectLists={projectLists}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No tasks
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

// Phase List Section for List View
const PhaseListSection = ({ phase, tasks, onEditTask, onDeleteTask, projectLists }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: phase.id,
  });

  const taskIds = tasks.map(t => t.id);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Phase Header */}
      <div 
        className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b"
        style={{ borderLeftWidth: '4px', borderLeftColor: phase.color }}
      >
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: phase.color }}
        />
        <h3 className="font-medium text-sm">{phase.name}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tasks.length}
        </Badge>
        {phase.is_final && (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
      </div>
      
      {/* Tasks List */}
      <div
        ref={setNodeRef}
        className={`min-h-[40px] transition-colors ${isOver ? 'bg-primary/5' : ''}`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length > 0 ? (
            tasks.map(task => (
              <SortableProjectListRow
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                projectLists={projectLists}
              />
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground text-xs">
              No tasks in this phase
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

// Sortable List Row for Project List View
const SortableProjectListRow = ({ task, onEdit, onDelete, projectLists }) => {
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
  const listName = projectLists.find(l => l.id === task.list_id)?.name || 'Unknown';
  
  const subtasks = task.subtasks || [];
  const subtaskCount = subtasks.length;
  const completedSubtasks = subtasks.filter(st => st.status === 'done' || st.completed).length;
  const subtaskProgress = subtaskCount > 0 ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer ${isDragging ? 'bg-muted/50' : ''}`}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{task.title}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {listName}
        </Badge>
        {subtaskCount > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ListChecks className="h-3.5 w-3.5" />
            {completedSubtasks}/{subtaskCount}
            <span className="text-primary font-medium">{subtaskProgress}%</span>
          </span>
        )}
        <Badge variant="secondary" className={`text-xs ${priorityClass.text} ${priorityClass.bg}`}>
          {task.priority}
        </Badge>
        {task.due_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-[70px]">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
};

// Project Gantt View
const ProjectGanttView = ({ tasks, phases, onEditTask, projectLists }) => {
  const today = new Date();
  const startDate = startOfWeek(addDays(today, -7));
  const endDate = endOfWeek(addDays(today, 28));
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped = {};
    phases.forEach(phase => {
      grouped[phase.id] = tasks.filter(t => (t.phase || 'planning') === phase.id);
    });
    return grouped;
  }, [tasks, phases]);

  return (
    <div className="h-full flex flex-col">
      {/* Timeline Header */}
      <div className="flex border-b bg-muted/30 sticky top-0 z-10">
        <div className="w-[250px] min-w-[250px] p-2 border-r font-medium text-sm">
          Task
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex min-w-max">
            {days.map((day, i) => (
              <div
                key={i}
                className={`w-10 min-w-[40px] p-1 text-center text-xs border-r ${
                  format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                    ? 'bg-primary/10 font-medium'
                    : ''
                }`}
              >
                <div className="text-muted-foreground">{format(day, 'EEE')}</div>
                <div>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tasks by Phase */}
      <ScrollArea className="flex-1">
        <div>
          {phases.map(phase => {
            const phaseTasks = tasksByPhase[phase.id] || [];
            if (phaseTasks.length === 0) return null;
            
            return (
              <div key={phase.id}>
                {/* Phase Header */}
                <div 
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b sticky top-0"
                  style={{ borderLeftWidth: '3px', borderLeftColor: phase.color }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: phase.color }}
                  />
                  <span className="text-xs font-medium">{phase.name}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {phaseTasks.length}
                  </Badge>
                </div>
                
                {/* Phase Tasks */}
                {phaseTasks.map(task => {
                  const taskStart = task.start_date ? parseISO(task.start_date) : null;
                  const taskEnd = task.due_date ? parseISO(task.due_date) : null;
                  const listName = projectLists.find(l => l.id === task.list_id)?.name || '';
                  
                  return (
                    <div 
                      key={task.id} 
                      className="flex border-b hover:bg-muted/30 cursor-pointer"
                      onClick={() => onEditTask(task)}
                    >
                      <div className="w-[250px] min-w-[250px] p-2 border-r">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{listName}</p>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        <div className="flex min-w-max relative h-full items-center">
                          {days.map((day, i) => {
                            const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                            const isInRange = taskStart && taskEnd && isWithinInterval(day, { 
                              start: taskStart, 
                              end: taskEnd 
                            });
                            const isStart = taskStart && format(day, 'yyyy-MM-dd') === format(taskStart, 'yyyy-MM-dd');
                            const isEnd = taskEnd && format(day, 'yyyy-MM-dd') === format(taskEnd, 'yyyy-MM-dd');
                            
                            return (
                              <div
                                key={i}
                                className={`w-10 min-w-[40px] h-8 border-r flex items-center justify-center ${
                                  isToday ? 'bg-primary/5' : ''
                                }`}
                              >
                                {isInRange && (
                                  <div 
                                    className={`h-5 ${
                                      isStart && isEnd ? 'w-6 rounded' :
                                      isStart ? 'w-full rounded-l ml-1' : 
                                      isEnd ? 'w-full rounded-r mr-1' : 
                                      'w-full'
                                    }`}
                                    style={{ backgroundColor: phase.color }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};


// =============================================================================
// PHASE MANAGEMENT MODAL
// =============================================================================

const PhaseManagementModal = ({ open, onOpenChange, projectId, phases, onPhasesUpdated }) => {
  const { token } = useAuth();
  const [localPhases, setLocalPhases] = useState(phases);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalPhases(phases);
  }, [phases]);

  const handleAddPhase = () => {
    if (!newPhaseName.trim()) return;
    const newPhase = {
      id: `phase_${Date.now()}`,
      name: newPhaseName.trim(),
      color: '#6B7280',
      is_final: false,
      order: localPhases.length
    };
    setLocalPhases([...localPhases, newPhase]);
    setNewPhaseName('');
  };

  const handleUpdatePhase = (index, field, value) => {
    const updated = [...localPhases];
    updated[index] = { ...updated[index], [field]: value };
    setLocalPhases(updated);
  };

  const handleDeletePhase = (index) => {
    if (localPhases.length <= 1) {
      toast.error('At least one phase is required');
      return;
    }
    setLocalPhases(localPhases.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/projects/${projectId}/phases`,
        { phases: localPhases },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Phases updated');
      onPhasesUpdated(localPhases);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save phases:', error);
      toast.error('Failed to save phases');
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    '#6B7280', '#3B82F6', '#10B981', '#F59E0B', 
    '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Phases</DialogTitle>
          <DialogDescription>
            Customize project phases for organizing tasks
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Existing Phases */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {localPhases.map((phase, index) => (
              <div key={phase.id} className="flex items-center gap-2 p-2 border rounded-md">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-6 h-6 rounded-full border-2 flex-shrink-0"
                      style={{ backgroundColor: phase.color }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {colorOptions.map(color => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded-full ${phase.color === color ? 'ring-2 ring-offset-2' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleUpdatePhase(index, 'color', color)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Input
                  value={phase.name}
                  onChange={(e) => handleUpdatePhase(index, 'name', e.target.value)}
                  className="h-8 flex-1"
                />
                
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={phase.is_final}
                    onCheckedChange={(checked) => handleUpdatePhase(index, 'is_final', checked)}
                  />
                  <span className="text-xs text-muted-foreground">Final</span>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDeletePhase(index)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          
          {/* Add New Phase */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="New phase name..."
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && handleAddPhase()}
            />
            <Button variant="outline" size="sm" onClick={handleAddPhase}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// =============================================================================
// PROJECT TASK DIALOG (for editing tasks at project level)
// =============================================================================

const ProjectTaskDialog = ({ open, onOpenChange, task, projectId, phases, projectLists, onSave, onDelete, onSubtaskChange }) => {
  const { token } = useAuth();
  
  const initialFormData = {
    title: task?.title || '',
    description: task?.description || '',
    phase: task?.phase || 'planning',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    start_date: task?.start_date ? task.start_date.split('T')[0] : '',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
  };
  
  const [formData, setFormData] = useState(initialFormData);
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');

  // Reset form when task changes using ref pattern
  const prevTaskIdRef = useRef(task?.id);
  if (prevTaskIdRef.current !== task?.id) {
    prevTaskIdRef.current = task?.id;
    setFormData({
      title: task?.title || '',
      description: task?.description || '',
      phase: task?.phase || 'planning',
      status: task?.status || 'todo',
      priority: task?.priority || 'medium',
      start_date: task?.start_date ? task.start_date.split('T')[0] : '',
      due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    });
    setSubtasks(task?.subtasks || []);
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    onSave(formData);
  };

  // Subtask handlers
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !task?.id) return;
    
    try {
      const response = await axios.post(
        `${API}/projects/${projectId}/tasks`,
        {
          title: newSubtaskTitle.trim(),
          list_id: task.list_id,
          parent_task_id: task.id,
          status: 'todo',
          priority: 'medium',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newSubtask = response.data;
      setSubtasks(prev => [...prev, newSubtask]);
      setNewSubtaskTitle('');
      toast.success('Subtask added');
      onSubtaskChange?.(task.id, prev => [...prev, newSubtask]);
    } catch (error) {
      console.error('Failed to add subtask:', error);
      toast.error('Failed to add subtask');
    }
  };

  const handleToggleSubtaskComplete = async (subtask) => {
    try {
      const newStatus = subtask.status === 'done' ? 'todo' : 'done';
      
      await axios.put(
        `${API}/projects/${projectId}/tasks/${subtask.id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const updatedSubtask = { ...subtask, status: newStatus, completed: newStatus === 'done' };
      setSubtasks(prev => prev.map(st => 
        st.id === subtask.id ? updatedSubtask : st
      ));
      onSubtaskChange?.(task.id, prev => prev.map(st => 
        st.id === subtask.id ? updatedSubtask : st
      ));
    } catch (error) {
      console.error('Failed to toggle subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  const handleEditSubtask = async (subtaskId) => {
    if (!editingSubtaskTitle.trim()) return;
    
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${subtaskId}`,
        { title: editingSubtaskTitle.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newTitle = editingSubtaskTitle.trim();
      setSubtasks(prev => prev.map(st => 
        st.id === subtaskId ? { ...st, title: newTitle } : st
      ));
      setEditingSubtaskId(null);
      setEditingSubtaskTitle('');
      toast.success('Subtask updated');
      onSubtaskChange?.(task.id, prev => prev.map(st => 
        st.id === subtaskId ? { ...st, title: newTitle } : st
      ));
    } catch (error) {
      console.error('Failed to edit subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await axios.delete(
        `${API}/projects/${projectId}/tasks/${subtaskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSubtasks(prev => prev.filter(st => st.id !== subtaskId));
      toast.success('Subtask deleted');
      onSubtaskChange?.(task.id, prev => prev.filter(st => st.id !== subtaskId));
    } catch (error) {
      console.error('Failed to delete subtask:', error);
      toast.error('Failed to delete subtask');
    }
  };

  const startEditSubtask = (subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const cancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  };

  // Calculate subtask progress
  const completedCount = subtasks.filter(st => st.status === 'done' || st.completed).length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const listName = projectLists.find(l => l.id === task?.list_id)?.name || 'Unknown List';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task details • {listName}
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
              <Label>Phase</Label>
              <Select 
                value={formData.phase} 
                onValueChange={(value) => setFormData({ ...formData, phase: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phases.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
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
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
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
          
          {/* Subtasks Section */}
          {task && (
            <div className="space-y-3 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Subtasks
                  {subtasks.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {completedCount}/{subtasks.length}
                    </Badge>
                  )}
                </Label>
                {subtasks.length > 0 && (
                  <span className="text-sm font-medium text-primary">{progress}%</span>
                )}
              </div>
              
              {subtasks.length > 0 && (
                <Progress value={progress} className="h-2" />
              )}
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {subtasks.map(subtask => (
                  <div 
                    key={subtask.id} 
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
                  >
                    <Checkbox
                      checked={subtask.status === 'done' || subtask.completed}
                      onCheckedChange={() => handleToggleSubtaskComplete(subtask)}
                      className="h-4 w-4"
                    />
                    
                    {editingSubtaskId === subtask.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editingSubtaskTitle}
                          onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSubtask(subtask.id);
                            if (e.key === 'Escape') cancelEditSubtask();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditSubtask(subtask.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditSubtask}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm ${(subtask.status === 'done' || subtask.completed) ? 'line-through text-muted-foreground' : ''}`}>
                          {subtask.title}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={() => startEditSubtask(subtask)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSubtask(subtask.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add a subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubtask();
                  }}
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 px-3"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
            Update
          </Button>
        </DialogFooter>
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
  const [search, setSearch] = useState('');
  
  // Main view mode: 'lists' or 'tasks'
  const [mainView, setMainView] = useState('lists');
  
  // Task view mode for tasks view
  const [taskViewMode, setTaskViewMode] = useState('kanban');
  
  // All tasks data (for project-level views)
  const [allTasks, setAllTasks] = useState([]);
  const [phases, setPhases] = useState([]);
  const [projectLists, setProjectLists] = useState([]);
  
  // Task drag state (for project-level D&D)
  const [activeTask, setActiveTask] = useState(null);
  
  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showListDialog, setShowListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // Edit list dialog state
  const [showEditListDialog, setShowEditListDialog] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [editListName, setEditListName] = useState('');
  
  // Phase management modal state
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  
  // Status management modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalEntity, setStatusModalEntity] = useState({ type: null, id: null, name: null });
  
  // List drag state
  const [activeList, setActiveList] = useState(null);
  
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
  
  // Open edit list dialog
  const openEditListDialog = (list) => {
    setEditingList(list);
    setEditListName(list.name);
    setShowEditListDialog(true);
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

  // Fetch all tasks for project-level views
  const fetchAllTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/${projectId}/all-tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTasks(response.data.tasks || []);
      setPhases(response.data.phases || []);
      setProjectLists(response.data.lists || []);
    } catch (error) {
      console.error('Failed to fetch all tasks:', error);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Fetch all tasks when switching to tasks view
  useEffect(() => {
    if (mainView === 'tasks') {
      fetchAllTasks();
    }
  }, [mainView, fetchAllTasks]);

  const handleCreateTask = async (formData, checklists) => {
    try {
      // Clean up empty values
      const cleanedData = {
        title: formData.title,
        list_id: formData.list_id,
        status: formData.status || 'todo',
        phase: formData.phase || 'planning',
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

  // Handle phase change for project-level views
  const handlePhaseChange = async (taskId, newPhase) => {
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${taskId}`,
        { phase: newPhase },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Optimistic update
      setAllTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, phase: newPhase } : t
      ));
      setEditingTask(prev => 
        prev && prev.id === taskId ? { ...prev, phase: newPhase } : prev
      );
    } catch (error) {
      toast.error('Failed to update task phase');
      fetchAllTasks(); // Revert on error
    }
  };

  // Handle task D&D in project-level views
  const handleTaskDragStart = (event) => {
    const task = allTasks.find(t => t.id === event.active.id);
    setActiveTask(task);
  };

  const handleTaskDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    
    if (!over) return;
    
    const taskId = active.id;
    const overId = over.id;
    
    // Find the task and check if dropping on a phase
    const draggedTask = allTasks.find(t => t.id === taskId);
    if (!draggedTask) return;
    
    // Check if dropping on a phase column
    const targetPhase = phases.find(p => p.id === overId);
    if (targetPhase && draggedTask.phase !== targetPhase.id) {
      await handlePhaseChange(taskId, targetPhase.id);
      return;
    }
    
    // Check if dropping on another task (reordering within same phase)
    const targetTask = allTasks.find(t => t.id === overId);
    if (targetTask && targetTask.phase !== draggedTask.phase) {
      // Moving to different phase
      await handlePhaseChange(taskId, targetTask.phase);
    }
  };

  // Open task dialog for editing from project-level view
  const openProjectTaskEdit = (task) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  };

  // Handle task update from project-level dialog
  const handleProjectTaskUpdate = async (formData) => {
    try {
      await axios.put(
        `${API}/projects/${projectId}/tasks/${editingTask.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task updated');
      fetchAllTasks();
      setShowTaskDialog(false);
      setEditingTask(null);
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  // Handle task delete from project-level view
  const handleProjectTaskDelete = async (task) => {
    if (!confirm('Delete this task?')) return;
    try {
      await axios.delete(
        `${API}/projects/${projectId}/tasks/${task.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task deleted');
      setAllTasks(prev => prev.filter(t => t.id !== task.id));
      setShowTaskDialog(false);
      setEditingTask(null);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  // Update task subtasks for real-time UI updates
  const updateTaskSubtasks = useCallback((taskId, subtasksUpdater) => {
    setAllTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newSubtasks = typeof subtasksUpdater === 'function' 
          ? subtasksUpdater(t.subtasks || [])
          : subtasksUpdater;
        return { ...t, subtasks: newSubtasks };
      }
      return t;
    }));
    setEditingTask(prev => {
      if (prev && prev.id === taskId) {
        const newSubtasks = typeof subtasksUpdater === 'function' 
          ? subtasksUpdater(prev.subtasks || [])
          : subtasksUpdater;
        return { ...prev, subtasks: newSubtasks };
      }
      return prev;
    });
  }, []);

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

  const handleUpdateList = async () => {
    if (!editListName.trim() || !editingList) return;
    try {
      await axios.put(
        `${API}/projects/${projectId}/lists/${editingList.id}`,
        { name: editListName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditListName('');
      setEditingList(null);
      setShowEditListDialog(false);
      toast.success('List updated');
      fetchProject();
    } catch (error) {
      console.error('Failed to update list:', error);
      toast.error('Failed to update list');
    }
  };

  const handleDeleteList = async (list) => {
    const taskCount = list.tasks?.length || 0;
    const confirmMessage = taskCount > 0 
      ? `Delete "${list.name}"? This will also delete ${taskCount} task(s) in this list.`
      : `Delete "${list.name}"?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      await axios.delete(
        `${API}/projects/${projectId}/lists/${list.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('List deleted');
      fetchProject();
    } catch (error) {
      console.error('Failed to delete list:', error);
      toast.error('Failed to delete list');
    }
  };

  const handleDragStart = (event) => {
    const list = lists?.find(l => l.id === event.active.id);
    setActiveList(list);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveList(null);
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = lists.findIndex(l => l.id === active.id);
    const newIndex = lists.findIndex(l => l.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Reorder lists locally (optimistic)
    const reorderedLists = [...lists];
    const [movedList] = reorderedLists.splice(oldIndex, 1);
    reorderedLists.splice(newIndex, 0, movedList);
    
    setProject(prev => ({
      ...prev,
      lists: reorderedLists
    }));
    
    // Save to backend
    try {
      await axios.post(
        `${API}/projects/${projectId}/lists/reorder`,
        { list_ids: reorderedLists.map(l => l.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to reorder lists:', error);
      toast.error('Failed to reorder lists');
      fetchProject(); // Revert on error
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

  // Group tasks by phase for project-level views
  const tasksByPhase = useMemo(() => {
    const grouped = {};
    phases.forEach(phase => {
      grouped[phase.id] = [];
    });
    allTasks.forEach(task => {
      const phaseId = task.phase || 'planning';
      if (grouped[phaseId]) {
        grouped[phaseId].push(task);
      } else {
        const firstPhase = phases[0]?.id || 'planning';
        if (!grouped[firstPhase]) grouped[firstPhase] = [];
        grouped[firstPhase].push(task);
      }
    });
    return grouped;
  }, [allTasks, phases]);
  
  // Filter tasks by search for project-level views
  const filteredTasks = useMemo(() => {
    if (!search) return allTasks;
    return allTasks.filter(task =>
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allTasks, search]);
  
  // Group filtered tasks by phase
  const filteredTasksByPhase = useMemo(() => {
    const grouped = {};
    phases.forEach(phase => {
      grouped[phase.id] = [];
    });
    filteredTasks.forEach(task => {
      const phaseId = task.phase || 'planning';
      if (grouped[phaseId]) {
        grouped[phaseId].push(task);
      } else {
        const firstPhase = phases[0]?.id || 'planning';
        if (!grouped[firstPhase]) grouped[firstPhase] = [];
        grouped[firstPhase].push(task);
      }
    });
    return grouped;
  }, [filteredTasks, phases]);

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
  const projectAllTasks = project.all_tasks || [];
  
  // Filter lists by search
  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(search.toLowerCase()) ||
    list.tasks?.some(t => t.title.toLowerCase().includes(search.toLowerCase()))
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
            {/* Main View Toggle */}
            <div className="flex items-center border rounded-lg p-0.5">
              <Button 
                variant={mainView === 'lists' ? 'default' : 'ghost'} 
                size="sm" 
                className="h-7 px-3"
                onClick={() => setMainView('lists')}
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Lists
              </Button>
              <Button 
                variant={mainView === 'tasks' ? 'default' : 'ghost'} 
                size="sm" 
                className="h-7 px-3"
                onClick={() => setMainView('tasks')}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                All Tasks
              </Button>
            </div>
            
            {mainView === 'lists' && (
              <Button variant="outline" size="sm" onClick={() => setShowListDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add List
              </Button>
            )}
            
            {mainView === 'tasks' && (
              <>
                {/* Task View Mode Toggle */}
                <div className="flex items-center border rounded-lg p-0.5">
                  <Button 
                    variant={taskViewMode === 'kanban' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => setTaskViewMode('kanban')}
                    title="Kanban View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={taskViewMode === 'list' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => setTaskViewMode('list')}
                    title="List View"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={taskViewMode === 'gantt' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => setTaskViewMode('gantt')}
                    title="Gantt View"
                  >
                    <GanttChart className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button variant="outline" size="sm" onClick={() => setShowPhaseModal(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Phases
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={mainView === 'lists' ? "Search lists..." : "Search tasks..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {mainView === 'lists' 
              ? `${lists.length} ${lists.length === 1 ? 'list' : 'lists'}`
              : `${filteredTasks.length} ${filteredTasks.length === 1 ? 'task' : 'tasks'}`
            }
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Lists View */}
        {mainView === 'lists' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredLists.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {filteredLists.length > 0 ? (
                    filteredLists.map(list => (
                      <SortableListCard
                        key={list.id}
                        list={list}
                        projectId={projectId}
                        onManageStatuses={openListStatusModal}
                        onEditList={openEditListDialog}
                        onDeleteList={handleDeleteList}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No lists found</p>
                      <p className="text-sm">Create a list to start organizing your tasks</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </SortableContext>
            <DragOverlay>
              {activeList && (
                <Card className="shadow-xl cursor-grabbing">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                        <List className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{activeList.name}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Tasks View - Kanban */}
        {mainView === 'tasks' && taskViewMode === 'kanban' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleTaskDragStart}
            onDragEnd={handleTaskDragEnd}
          >
            <ScrollArea className="h-full">
              <div className="flex gap-4 p-4 min-w-max">
                {phases.map(phase => (
                  <PhaseColumn
                    key={phase.id}
                    phase={phase}
                    tasks={filteredTasksByPhase[phase.id] || []}
                    onEditTask={openProjectTaskEdit}
                    onDeleteTask={handleProjectTaskDelete}
                    phases={phases}
                    projectLists={projectLists}
                  />
                ))}
              </div>
            </ScrollArea>
            <DragOverlay>
              {activeTask && (
                <Card className="shadow-xl w-[280px]">
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm">{activeTask.title}</h4>
                  </CardContent>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Tasks View - List */}
        {mainView === 'tasks' && taskViewMode === 'list' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleTaskDragStart}
            onDragEnd={handleTaskDragEnd}
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {phases.map(phase => {
                  const phaseTasks = filteredTasksByPhase[phase.id] || [];
                  return (
                    <PhaseListSection
                      key={phase.id}
                      phase={phase}
                      tasks={phaseTasks}
                      onEditTask={openProjectTaskEdit}
                      onDeleteTask={handleProjectTaskDelete}
                      projectLists={projectLists}
                    />
                  );
                })}
              </div>
            </ScrollArea>
            <DragOverlay>
              {activeTask && (
                <div className="bg-background border rounded-md shadow-xl p-3">
                  <span className="text-sm font-medium">{activeTask.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Tasks View - Gantt */}
        {mainView === 'tasks' && taskViewMode === 'gantt' && (
          <ProjectGanttView
            tasks={filteredTasks}
            phases={phases}
            onEditTask={openProjectTaskEdit}
            projectLists={projectLists}
          />
        )}
      </div>

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

      {/* Edit List Dialog */}
      <Dialog open={showEditListDialog} onOpenChange={setShowEditListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
            <DialogDescription>Update the list name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">Name</Label>
              <Input
                id="edit-list-name"
                value={editListName}
                onChange={(e) => setEditListName(e.target.value)}
                placeholder="List name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditListDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateList}>Save Changes</Button>
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
      
      {/* Phase Management Modal */}
      <PhaseManagementModal
        open={showPhaseModal}
        onOpenChange={setShowPhaseModal}
        projectId={projectId}
        phases={phases}
        onPhasesUpdated={(newPhases) => {
          setPhases(newPhases);
          fetchAllTasks();
        }}
      />
      
      {/* Project-level Task Dialog */}
      {mainView === 'tasks' && editingTask && (
        <ProjectTaskDialog
          open={showTaskDialog}
          onOpenChange={(open) => {
            setShowTaskDialog(open);
            if (!open) setEditingTask(null);
          }}
          task={editingTask}
          projectId={projectId}
          phases={phases}
          projectLists={projectLists}
          onSave={handleProjectTaskUpdate}
          onDelete={handleProjectTaskDelete}
          onSubtaskChange={updateTaskSubtasks}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
