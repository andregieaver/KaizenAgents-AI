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
  Tag,
  X,
} from 'lucide-react';
import { format, differenceInDays, addDays, startOfDay, endOfDay, eachDayOfInterval, isWithinInterval, parseISO, min, max } from 'date-fns';
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
const SortableTaskCard = ({ task, onEdit, onDelete, onStatusChange, statuses, availableTags = [] }) => {
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
  
  // Get tag objects for this task
  const taskTags = (task.tags || [])
    .map(tagId => availableTags.find(t => t.id === tagId))
    .filter(Boolean);

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
              
              {/* Tags */}
              {taskTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {taskTags.slice(0, 3).map(tag => (
                    <Badge 
                      key={tag.id}
                      variant="outline"
                      className="text-[9px] sm:text-[10px] py-0 px-1.5"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {taskTags.length > 3 && (
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 px-1.5">
                      +{taskTags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              
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

// Sortable List Row Component for List View
const SortableListRow = ({ task, onEdit, onDelete, statuses }) => {
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
  const taskStatus = statuses.find(s => s.id === task.status);

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer ${isDragging ? 'bg-muted/50' : ''}`}
      onClick={() => onEdit(task)}
    >
      {/* Mobile Layout */}
      <div className="sm:hidden p-2.5">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground touch-none mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge variant="secondary" className={`text-xs py-0 ${priorityClass}`}>
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
            className="h-7 w-7 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      
      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center gap-3 px-3 py-2.5">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </span>
        </div>
        <Badge variant="secondary" className={`text-xs ${priorityClass}`}>
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

// Droppable List Status Zone for List View
const ListStatusDropZone = ({ status, tasks, onEditTask, onDeleteTask, statuses }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  const taskIds = tasks.map(t => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[40px] transition-colors ${
        isOver ? 'bg-primary/5' : ''
      }`}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        {tasks.length > 0 ? (
          tasks.map(task => (
            <SortableListRow
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              statuses={statuses}
            />
          ))
        ) : (
          <div className="text-center py-4 text-muted-foreground text-xs">
            No tasks in this status
          </div>
        )}
      </SortableContext>
    </div>
  );
};

// Sortable Gantt Row Component
const SortableGanttRow = ({ task, statuses, days, startDate, dayWidth, today, onEdit }) => {
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

  const taskStart = task.start_date ? parseISO(task.start_date) : (task.due_date ? parseISO(task.due_date) : today);
  const taskEnd = task.due_date ? parseISO(task.due_date) : taskStart;
  
  const startOffset = differenceInDays(taskStart, startDate);
  const duration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
  
  const priorityClass = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const statusColor = statuses.find(s => s.id === task.status)?.color || '#6B7280';

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex border-b last:border-b-0 hover:bg-muted/20 cursor-pointer ${isDragging ? 'bg-muted/30' : ''}`}
    >
      {/* Task name with drag handle */}
      <div className="w-[180px] sm:w-[250px] flex-shrink-0 px-2 sm:px-3 py-2 border-r">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 sm:p-1 rounded hover:bg-muted text-muted-foreground touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
          />
          <span 
            className="text-xs sm:text-sm truncate font-medium flex-1 cursor-pointer"
            onClick={() => onEdit(task)}
          >
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 ml-6 sm:ml-7">
          <Badge variant="secondary" className={`text-[9px] sm:text-[10px] py-0 ${priorityClass}`}>
            {task.priority}
          </Badge>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">
            {task.start_date && format(parseISO(task.start_date), 'MMM d')}
            {task.start_date && task.due_date && ' - '}
            {task.due_date && format(parseISO(task.due_date), 'MMM d')}
          </span>
        </div>
      </div>
      
      {/* Timeline bar */}
      <div className="flex-1 relative min-w-0">
        <div 
          className="flex h-full items-center" 
          style={{ minWidth: days.length * dayWidth }}
        >
          {/* Background grid */}
          {days.map((day, i) => {
            const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div 
                key={i}
                className={`h-full border-r flex-shrink-0 ${
                  isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20' : ''
                }`}
                style={{ width: dayWidth, minHeight: 44 }}
              />
            );
          })}
          
          {/* Task bar */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-5 sm:h-6 rounded-md shadow-sm flex items-center px-1.5 sm:px-2 text-white text-[10px] sm:text-xs font-medium overflow-hidden cursor-pointer"
            style={{
              left: startOffset * dayWidth + 4,
              width: Math.max(duration * dayWidth - 8, 24),
              backgroundColor: statusColor,
            }}
            onClick={() => onEdit(task)}
          >
            <span className="truncate">{task.title}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Droppable Gantt Status Section
const GanttStatusSection = ({ status, tasks, statuses, days, startDate, dayWidth, today, onEditTask }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  const taskIds = tasks.map(t => t.id);

  return (
    <div className="border-b last:border-b-0">
      {/* Status Header */}
      <div 
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-muted/50 border-b sticky left-0"
        style={{ borderLeftWidth: '4px', borderLeftColor: status.color }}
      >
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <h3 className="font-medium text-xs sm:text-sm">{status.name}</h3>
        <Badge variant="secondary" className="ml-auto text-[10px] sm:text-xs">
          {tasks.length}
        </Badge>
      </div>
      
      {/* Task Rows */}
      <div
        ref={setNodeRef}
        className={`min-h-[40px] transition-colors ${isOver ? 'bg-primary/5' : ''}`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length > 0 ? (
            tasks.map(task => (
              <SortableGanttRow
                key={task.id}
                task={task}
                statuses={statuses}
                days={days}
                startDate={startDate}
                dayWidth={dayWidth}
                today={today}
                onEdit={onEditTask}
              />
            ))
          ) : (
            <div className="text-center py-3 text-muted-foreground text-xs">
              No tasks with dates
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

// Gantt View Component
const GanttView = ({ tasks, statuses, onEditTask, onDragStart, onDragEnd, sensors, activeTask }) => {
  // Calculate date range for the chart
  const today = startOfDay(new Date());
  const tasksWithDates = tasks.filter(t => t.start_date || t.due_date);
  
  const allDates = tasksWithDates.flatMap(t => {
    const dates = [];
    if (t.start_date) dates.push(parseISO(t.start_date));
    if (t.due_date) dates.push(parseISO(t.due_date));
    return dates;
  });
  
  const minDate = allDates.length > 0 ? min([today, ...allDates]) : today;
  const maxDate = allDates.length > 0 ? max([addDays(today, 14), ...allDates]) : addDays(today, 14);
  
  // Add buffer days
  const startDate = addDays(startOfDay(minDate), -2);
  const endDate = addDays(endOfDay(maxDate), 5);
  
  // Generate array of days for the timeline
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const dayWidth = 36; // pixels per day (slightly smaller for mobile)
  
  // Group tasks by status
  const tasksByStatus = {};
  statuses.forEach(status => {
    tasksByStatus[status.id] = tasksWithDates
      .filter(t => t.status === status.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  });
  
  // Check if there are any tasks with dates
  const hasTasksWithDates = tasksWithDates.length > 0;
  const tasksWithoutDates = tasks.length - tasksWithDates.length;

  if (!hasTasksWithDates) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <GanttChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No tasks with dates</p>
          <p className="text-sm">Add start and due dates to tasks to see them in Gantt view</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Gantt Container with synchronized scrolling */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            {/* Header with dates */}
            <div className="flex border-b bg-muted/50 sticky top-0 z-10">
              {/* Task name column header */}
              <div className="w-[180px] sm:w-[250px] flex-shrink-0 px-2 sm:px-3 py-2 border-r font-medium text-xs sm:text-sm bg-muted/50 sticky left-0 z-20">
                Task
              </div>
              {/* Timeline header */}
              <div className="flex">
                {days.map((day, i) => {
                  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div 
                      key={i} 
                      className={`flex-shrink-0 text-center text-[10px] sm:text-xs py-1 border-r ${
                        isToday ? 'bg-primary/10 font-medium' : isWeekend ? 'bg-muted/30' : 'bg-muted/50'
                      }`}
                      style={{ width: dayWidth }}
                    >
                      <div className="text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={isToday ? 'text-primary' : ''}>{format(day, 'd')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Status sections with tasks */}
            <div className="border rounded-b-lg overflow-hidden">
              {statuses.map(status => (
                <GanttStatusSection
                  key={status.id}
                  status={status}
                  tasks={tasksByStatus[status.id] || []}
                  statuses={statuses}
                  days={days}
                  startDate={startDate}
                  dayWidth={dayWidth}
                  today={today}
                  onEditTask={onEditTask}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && (
            <div className="bg-background border rounded-lg shadow-xl p-2 sm:p-3 w-[180px] sm:w-[250px]">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-xs sm:text-sm truncate">{activeTask.title}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      
      {/* Hidden tasks message */}
      {tasksWithoutDates > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-muted/30 text-xs sm:text-sm text-muted-foreground border-t flex-shrink-0">
          <span className="font-medium">{tasksWithoutDates}</span> task(s) hidden - add start/due dates to show them
        </div>
      )}
    </div>
  );
};

// Task Dialog Component
const TaskDialog = ({ open, onOpenChange, task, listId, statuses, onSave, onDelete, availableTags = [] }) => {
  // Initialize form data based on task prop
  const initialFormData = task ? {
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    start_date: task.start_date ? task.start_date.split('T')[0] : '',
    due_date: task.due_date ? task.due_date.split('T')[0] : '',
    assigned_to: task.assigned_to || '',
    tags: task.tags || [],
  } : {
    title: '',
    description: '',
    status: statuses[0]?.id || 'todo',
    priority: 'medium',
    start_date: '',
    due_date: '',
    assigned_to: '',
    tags: [],
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

  const toggleTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId) 
        ? prev.tags.filter(t => t !== tagId)
        : [...prev.tags, tagId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
          
          {/* Tags Section */}
          <div className="space-y-2">
            <Label>Tags</Label>
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
                {availableTags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={formData.tags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer transition-all hover:opacity-80"
                    style={formData.tags.includes(tag.id) ? { 
                      backgroundColor: tag.color, 
                      borderColor: tag.color 
                    } : { 
                      borderColor: tag.color,
                      color: tag.color 
                    }}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag.name}
                    {formData.tags.includes(tag.id) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags available. Create tags from the settings menu.</p>
            )}
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

// Tag Management Modal Component
const TagManagementModal = ({ open, onOpenChange, tags, onTagsUpdated }) => {
  const { token } = useAuth();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6B7280');
  const [editingTag, setEditingTag] = useState(null);
  const [saving, setSaving] = useState(false);

  const predefinedColors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#6B7280', '#78716C', '#000000',
  ];

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(
        `${API}/projects/tags`,
        { name: newTagName.trim(), color: newTagColor },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tag created');
      setNewTagName('');
      setNewTagColor('#6B7280');
      onTagsUpdated();
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error(error.response?.data?.detail || 'Failed to create tag');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTag.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    
    setSaving(true);
    try {
      await axios.put(
        `${API}/projects/tags/${editingTag.id}`,
        { name: editingTag.name.trim(), color: editingTag.color },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tag updated');
      setEditingTag(null);
      onTagsUpdated();
    } catch (error) {
      console.error('Failed to update tag:', error);
      toast.error(error.response?.data?.detail || 'Failed to update tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!window.confirm('Delete this tag? It will be removed from all tasks.')) return;
    
    try {
      await axios.delete(
        `${API}/projects/tags/${tagId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tag deleted');
      onTagsUpdated();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Create, edit, and delete tags for your tasks
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Create new tag */}
          <div className="space-y-2">
            <Label>Create New Tag</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1"
              />
              <div className="relative">
                <Input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-10 h-10 p-1 cursor-pointer"
                />
              </div>
              <Button onClick={handleCreateTag} disabled={saving || !newTagName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Color palette */}
            <div className="flex flex-wrap gap-1">
              {predefinedColors.map(color => (
                <button
                  key={color}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewTagColor(color)}
                />
              ))}
            </div>
          </div>
          
          {/* Existing tags */}
          <div className="space-y-2">
            <Label>Existing Tags ({tags.length})</Label>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tags created yet
                </p>
              ) : (
                tags.map(tag => (
                  <div 
                    key={tag.id} 
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    {editingTag?.id === tag.id ? (
                      <>
                        <Input
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="flex-1 h-8"
                        />
                        <Input
                          type="color"
                          value={editingTag.color}
                          onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                          className="w-8 h-8 p-0.5 cursor-pointer"
                        />
                        <Button size="sm" variant="ghost" onClick={handleUpdateTag} disabled={saving}>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTag(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingTag({ ...tag })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => handleDeleteTag(tag.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
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
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'list', 'kanban', 'gantt'
  
  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  
  // Drag state
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/tags/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTags(response.data || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [token]);

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
    fetchTags();
  }, [fetchListData, fetchTags]);

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
    
    if (!over || active.id === over.id) return;
    
    const activeTaskId = active.id;
    const overId = over.id;
    
    // Find the task being dragged
    const draggedTask = tasks.find(t => t.id === activeTaskId);
    if (!draggedTask) return;
    
    // Determine target status and position
    let targetStatus = draggedTask.status;
    let targetIndex = 0;
    
    // Check if dropped on another task or on a status column
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      // Dropped on another task
      targetStatus = overTask.status;
    } else if (statuses.some(s => s.id === overId)) {
      // Dropped on status column
      targetStatus = overId;
    }
    
    // Check if status changed
    const statusChanged = draggedTask.status !== targetStatus;
    
    // Get tasks in target status (before any updates)
    let statusTasks = tasks
      .filter(t => t.status === targetStatus)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // If moving to a new status, add the dragged task to the list
    if (statusChanged) {
      statusTasks = [...statusTasks];
    }
    
    // Find indices
    const oldIndex = statusTasks.findIndex(t => t.id === activeTaskId);
    let newIndex = overTask 
      ? statusTasks.findIndex(t => t.id === overId)
      : statusTasks.length; // Dropped on empty column or end
    
    // If same status reorder
    if (!statusChanged && oldIndex !== -1) {
      // Use arrayMove for same-status reordering
      const reorderedTasks = arrayMove(statusTasks, oldIndex, newIndex);
      
      // Update order values
      const newTasksList = tasks.map(t => {
        const reorderedIndex = reorderedTasks.findIndex(rt => rt.id === t.id);
        if (reorderedIndex !== -1) {
          return { ...t, order: reorderedIndex };
        }
        return t;
      });
      
      setTasks(newTasksList);
      
      // Save order to backend
      try {
        const orderedTaskIds = reorderedTasks.map(t => t.id);
        await axios.post(
          `${API}/projects/lists/${listId}/tasks/reorder`,
          { task_ids: orderedTaskIds, status: targetStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('Failed to reorder tasks:', error);
        toast.error('Failed to reorder tasks');
        fetchListData();
      }
    } else if (statusChanged) {
      // Moving to different status
      // Update task status locally
      const newTasksList = tasks.map(t => {
        if (t.id === activeTaskId) {
          return { ...t, status: targetStatus, order: newIndex };
        }
        // Update order of tasks in target status that come after
        if (t.status === targetStatus && (t.order || 0) >= newIndex) {
          return { ...t, order: (t.order || 0) + 1 };
        }
        return t;
      });
      
      setTasks(newTasksList);
      
      // Save to backend
      try {
        // First update the status
        await axios.put(
          `${API}/projects/${projectId}/tasks/${activeTaskId}`,
          { status: targetStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Then reorder
        const orderedTaskIds = newTasksList
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
        fetchListData();
      }
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
            
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowTagModal(true)} title="Manage Tags">
              <Tag className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowStatusModal(true)} title="Manage Statuses">
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
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="p-2 sm:p-4 min-w-max">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-2 sm:gap-4 pb-4">
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
        </div>
      )}
      
      {viewMode === 'list' && (
        <ScrollArea className="flex-1">
          <div className="p-2 sm:p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-4">
                {statuses.map(status => {
                  const statusTasks = tasks
                    .filter(t => t.status === status.id && t.title.toLowerCase().includes(search.toLowerCase()))
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                  
                  return (
                    <div key={status.id} className="border overflow-hidden">
                      {/* Status Header */}
                      <div 
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted/50 border-b"
                        style={{ borderLeftWidth: '4px', borderLeftColor: status.color }}
                      >
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: status.color }}
                        />
                        <h3 className="font-medium text-sm">{status.name}</h3>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {statusTasks.length}
                        </Badge>
                        {status.is_final && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      
                      {/* Droppable Task Container */}
                      <ListStatusDropZone 
                        status={status} 
                        tasks={statusTasks}
                        onEditTask={openEditTask}
                        onDeleteTask={handleDeleteTask}
                        statuses={statuses}
                      />
                    </div>
                  );
                })}
              </div>
              
              <DragOverlay>
                {activeTask && (
                  <div className="bg-background border rounded-lg shadow-xl p-3 w-full max-w-md">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{activeTask.title}</span>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            
            {tasks.length === 0 && (
              <div className="text-center py-8 sm:py-12 text-muted-foreground border">
                <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
      
      {viewMode === 'gantt' && (
        <GanttView 
          tasks={tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))}
          statuses={statuses}
          onEditTask={openEditTask}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          activeTask={activeTask}
        />
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
        availableTags={tags}
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

      {/* Tag Management Modal */}
      <TagManagementModal
        open={showTagModal}
        onOpenChange={setShowTagModal}
        tags={tags}
        onTagsUpdated={fetchTags}
      />
    </div>
  );
};

export default ListDetail;
