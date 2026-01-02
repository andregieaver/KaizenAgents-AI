import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
// Breadcrumb components removed - using header breadcrumbs from DashboardLayout
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
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Folder,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderOpen,
  Loader2,
  LayoutGrid,
  ListFilter,
  Calendar,
  Users,
  CheckCircle2,
  Copy,
  GripVertical
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Color options for spaces
const SPACE_COLORS = [
  { id: 'indigo', value: '#6366F1', label: 'Indigo' },
  { id: 'blue', value: '#3B82F6', label: 'Blue' },
  { id: 'green', value: '#10B981', label: 'Green' },
  { id: 'amber', value: '#F59E0B', label: 'Amber' },
  { id: 'red', value: '#EF4444', label: 'Red' },
  { id: 'purple', value: '#8B5CF6', label: 'Purple' },
  { id: 'pink', value: '#EC4899', label: 'Pink' },
  { id: 'gray', value: '#6B7280', label: 'Gray' },
];

// Space Card Component
const SpaceCard = ({ space, onClick, onEdit, onDelete }) => {
  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg transition-all border-l-4"
      style={{ borderLeftColor: space.color || '#6366F1' }}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${space.color}20` || '#6366F120' }}
            >
              <Folder className="h-5 w-5" style={{ color: space.color || '#6366F1' }} />
            </div>
            <div>
              <CardTitle className="text-base">{space.name}</CardTitle>
              {space.description && (
                <CardDescription className="text-xs mt-0.5 line-clamp-1">
                  {space.description}
                </CardDescription>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(space); }}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(space); }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FolderOpen className="h-4 w-4" />
            <span>{space.project_count || 0} projects</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{space.created_at && formatDistanceToNow(new Date(space.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Project Card Component (for Space Detail view) - Sortable
const SortableProjectCard = ({ project, onClick, onEdit, onDelete, onDuplicate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const progress = project.task_count > 0 
    ? Math.round((project.completed_count / project.task_count) * 100) 
    : 0;

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className="group cursor-pointer hover:shadow-md transition-all"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Drag Handle - Always visible */}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div 
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: project.color || '#6366F1' }}
              />
              <h3 className="font-medium">{project.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {project.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(project); }}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {project.description}
            </p>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{project.completed_count || 0} / {project.task_count || 0} tasks</span>
              {project.end_date && (
                <span>Due {new Date(project.end_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Create/Edit Space Dialog
const SpaceDialog = ({ open, onOpenChange, space, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1'
  });

  useEffect(() => {
    if (space) {
      setFormData({
        name: space.name || '',
        description: space.description || '',
        color: space.color || '#6366F1'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#6366F1'
      });
    }
  }, [space, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{space ? 'Edit Space' : 'Create Space'}</DialogTitle>
          <DialogDescription>
            {space ? 'Update your space details.' : 'Create a new space to organize your projects.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Marketing, Development, HR"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What is this space for?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {SPACE_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`h-8 w-8 rounded-full transition-all ${
                    formData.color === color.value 
                      ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {space ? 'Update' : 'Create'} Space
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Create Project Dialog
const ProjectDialog = ({ open, onOpenChange, spaceId, project, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    start_date: '',
    end_date: '',
    status: 'active'
  });

  useEffect(() => {
    if (open) {
      if (project) {
        setFormData({
          name: project.name || '',
          description: project.description || '',
          color: project.color || '#6366F1',
          start_date: project.start_date || '',
          end_date: project.end_date || '',
          status: project.status || 'active'
        });
      } else {
        setFormData({
          name: '',
          description: '',
          color: '#6366F1',
          start_date: '',
          end_date: '',
          status: 'active'
        });
      }
    }
  }, [open, project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      await onSave({ ...formData, space_id: spaceId });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!project;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project' : 'Create Project'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update project details.' : 'Create a new project in this space.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name *</Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Q1 Campaign, Website Redesign"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What is this project about?"
              rows={2}
            />
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger id="project-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {SPACE_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`h-8 w-8 rounded-full transition-all ${
                    formData.color === color.value 
                      ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? 'Update' : 'Create'} Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Duplicate Project Dialog
const DuplicateProjectDialog = ({ open, onOpenChange, project, onDuplicate }) => {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [options, setOptions] = useState({
    keepLists: true,
    keepTasks: true,
    keepChecklists: true,
    keepAssignees: false
  });

  useEffect(() => {
    if (open && project) {
      setNewName(`${project.name} (Copy)`);
      setOptions({
        keepLists: true,
        keepTasks: true,
        keepChecklists: true,
        keepAssignees: false
      });
    }
  }, [open, project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      await onDuplicate({
        new_name: newName.trim(),
        keep_lists: options.keepLists,
        keep_tasks: options.keepTasks,
        keep_checklists: options.keepChecklists,
        keep_assignees: options.keepAssignees
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Project</DialogTitle>
          <DialogDescription>
            Create a copy of "{project.name}" with selected content.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">New Project Name *</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter name for the duplicated project"
            />
          </div>

          <div className="space-y-3">
            <Label>Include in duplicate:</Label>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keep-lists"
                  checked={options.keepLists}
                  onCheckedChange={(checked) => {
                    setOptions(prev => ({
                      ...prev,
                      keepLists: checked,
                      keepTasks: checked ? prev.keepTasks : false,
                      keepChecklists: checked ? prev.keepChecklists : false
                    }));
                  }}
                />
                <label htmlFor="keep-lists" className="text-sm font-medium cursor-pointer">
                  Lists
                </label>
              </div>

              <div className="flex items-center space-x-2 ml-6">
                <Checkbox
                  id="keep-tasks"
                  checked={options.keepTasks}
                  disabled={!options.keepLists}
                  onCheckedChange={(checked) => {
                    setOptions(prev => ({
                      ...prev,
                      keepTasks: checked,
                      keepChecklists: checked ? prev.keepChecklists : false,
                      keepAssignees: checked ? prev.keepAssignees : false
                    }));
                  }}
                />
                <label 
                  htmlFor="keep-tasks" 
                  className={`text-sm cursor-pointer ${!options.keepLists ? 'text-muted-foreground' : ''}`}
                >
                  Tasks in lists
                </label>
              </div>

              <div className="flex items-center space-x-2 ml-12">
                <Checkbox
                  id="keep-checklists"
                  checked={options.keepChecklists}
                  disabled={!options.keepTasks}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, keepChecklists: checked }))}
                />
                <label 
                  htmlFor="keep-checklists" 
                  className={`text-sm cursor-pointer ${!options.keepTasks ? 'text-muted-foreground' : ''}`}
                >
                  Checklists in tasks
                </label>
              </div>

              <div className="flex items-center space-x-2 ml-12">
                <Checkbox
                  id="keep-assignees"
                  checked={options.keepAssignees}
                  disabled={!options.keepTasks}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, keepAssignees: checked }))}
                />
                <label 
                  htmlFor="keep-assignees" 
                  className={`text-sm cursor-pointer ${!options.keepTasks ? 'text-muted-foreground' : ''}`}
                >
                  Task assignees
                </label>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">What will be copied:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Project settings and metadata</li>
              {options.keepLists && <li>All lists</li>}
              {options.keepTasks && <li>All tasks with their status and priority</li>}
              {options.keepChecklists && <li>Task checklists</li>}
              {options.keepAssignees && <li>Task assignees</li>}
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Duplicate Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Projects Page
const Projects = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Dialog states
  const [showSpaceDialog, setShowSpaceDialog] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicatingProject, setDuplicatingProject] = useState(null);
  
  // Space detail view
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [spaceProjects, setSpaceProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fetchSpaces = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects/spaces`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaces(response.data || []);
    } catch (error) {
      console.error('Failed to fetch spaces:', error);
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchSpaceDetail = useCallback(async (spaceId) => {
    setLoadingProjects(true);
    try {
      const response = await axios.get(`${API}/projects/spaces/${spaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedSpace(response.data);
      setSpaceProjects(response.data.projects || []);
    } catch (error) {
      console.error('Failed to fetch space:', error);
      toast.error('Failed to load space');
    } finally {
      setLoadingProjects(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const handleCreateSpace = async (data) => {
    try {
      const response = await axios.post(`${API}/projects/spaces`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaces(prev => [response.data, ...prev]);
      toast.success('Space created successfully');
    } catch (error) {
      toast.error('Failed to create space');
      throw error;
    }
  };

  const handleUpdateSpace = async (data) => {
    try {
      const response = await axios.put(`${API}/projects/spaces/${editingSpace.id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaces(prev => prev.map(s => s.id === editingSpace.id ? response.data : s));
      if (selectedSpace?.id === editingSpace.id) {
        setSelectedSpace(response.data);
      }
      toast.success('Space updated successfully');
    } catch (error) {
      toast.error('Failed to update space');
      throw error;
    }
  };

  const handleDeleteSpace = async (space) => {
    if (!confirm(`Delete "${space.name}" and all its projects? This cannot be undone.`)) return;
    
    try {
      await axios.delete(`${API}/projects/spaces/${space.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaces(prev => prev.filter(s => s.id !== space.id));
      if (selectedSpace?.id === space.id) {
        setSelectedSpace(null);
      }
      toast.success('Space deleted');
    } catch (error) {
      toast.error('Failed to delete space');
    }
  };

  const handleCreateProject = async (data) => {
    try {
      const response = await axios.post(`${API}/projects`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaceProjects(prev => [response.data, ...prev]);
      // Update space project count
      setSpaces(prev => prev.map(s => 
        s.id === data.space_id 
          ? { ...s, project_count: (s.project_count || 0) + 1 }
          : s
      ));
      toast.success('Project created successfully');
    } catch (error) {
      toast.error('Failed to create project');
      throw error;
    }
  };

  const handleUpdateProject = async (data) => {
    try {
      const response = await axios.put(`${API}/projects/${editingProject.id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaceProjects(prev => prev.map(p => 
        p.id === editingProject.id ? response.data : p
      ));
      toast.success('Project updated successfully');
    } catch (error) {
      toast.error('Failed to update project');
      throw error;
    }
  };

  const handleDeleteProject = async (project) => {
    if (!confirm(`Delete "${project.name}" and all its tasks? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/projects/${project.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpaceProjects(prev => prev.filter(p => p.id !== project.id));
      // Update space project count
      setSpaces(prev => prev.map(s => 
        s.id === project.space_id 
          ? { ...s, project_count: Math.max((s.project_count || 1) - 1, 0) }
          : s
      ));
      toast.success('Project deleted');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleDuplicateProject = async (options) => {
    try {
      const response = await axios.post(
        `${API}/projects/${duplicatingProject.id}/duplicate`,
        options,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSpaceProjects(prev => [response.data, ...prev]);
      // Update space project count
      setSpaces(prev => prev.map(s => 
        s.id === duplicatingProject.space_id 
          ? { ...s, project_count: (s.project_count || 0) + 1 }
          : s
      ));
      toast.success('Project duplicated successfully');
    } catch (error) {
      toast.error('Failed to duplicate project');
      throw error;
    }
  };

  const openDuplicateProject = (project) => {
    setDuplicatingProject(project);
    setShowDuplicateDialog(true);
  };

  const handleSpaceClick = (space) => {
    setSelectedSpace(space);
    fetchSpaceDetail(space.id);
  };

  const handleBackToSpaces = () => {
    setSelectedSpace(null);
    setSpaceProjects([]);
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setSelectedSpaceId(project.space_id);
    setShowProjectDialog(true);
  };

  const openCreateProject = () => {
    setEditingProject(null);
    setSelectedSpaceId(selectedSpace.id);
    setShowProjectDialog(true);
  };

  const filteredSpaces = spaces.filter(space => 
    space.name.toLowerCase().includes(search.toLowerCase()) ||
    space.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProjects = spaceProjects.filter(project =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.description?.toLowerCase().includes(search.toLowerCase())
  );

  // DnD sensors for project reordering (including touch support for mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for project reordering
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = spaceProjects.findIndex(p => p.id === active.id);
    const newIndex = spaceProjects.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update UI
    const newOrder = arrayMove(spaceProjects, oldIndex, newIndex);
    setSpaceProjects(newOrder);

    // Save to backend
    try {
      await axios.post(
        `${API}/projects/spaces/${selectedSpace.id}/reorder`,
        { project_ids: newOrder.map(p => p.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      // Revert on error
      setSpaceProjects(spaceProjects);
      toast.error('Failed to reorder projects');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Space Detail View
  if (selectedSpace) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToSpaces}>
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <div 
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${selectedSpace.color}20` }}
              >
                <Folder className="h-5 w-5" style={{ color: selectedSpace.color }} />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{selectedSpace.name}</h1>
                {selectedSpace.description && (
                  <p className="text-sm text-muted-foreground">{selectedSpace.description}</p>
                )}
              </div>
            </div>
          </div>
          <Button onClick={openCreateProject}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Projects Grid */}
        {loadingProjects ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredProjects.map(p => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(project => (
                  <SortableProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => navigate(`/dashboard/projects/${project.id}`)}
                    onEdit={openEditProject}
                    onDelete={handleDeleteProject}
                    onDuplicate={openDuplicateProject}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Create your first project to get started</p>
            <Button onClick={openCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        )}

        {/* Project Dialog */}
        <ProjectDialog
          open={showProjectDialog}
          onOpenChange={setShowProjectDialog}
          spaceId={selectedSpaceId}
          project={editingProject}
          onSave={editingProject ? handleUpdateProject : handleCreateProject}
        />

        {/* Duplicate Project Dialog */}
        <DuplicateProjectDialog
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
          project={duplicatingProject}
          onDuplicate={handleDuplicateProject}
        />
      </div>
    );
  }

  // Spaces Overview
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground">Organize your work into spaces and projects</p>
        </div>
        <Button onClick={() => { setEditingSpace(null); setShowSpaceDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Space
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search spaces..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Spaces Grid */}
      {filteredSpaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpaces.map(space => (
            <SpaceCard
              key={space.id}
              space={space}
              onClick={() => handleSpaceClick(space)}
              onEdit={(s) => { setEditingSpace(s); setShowSpaceDialog(true); }}
              onDelete={handleDeleteSpace}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No spaces yet</h3>
          <p className="text-muted-foreground mb-4">Create your first space to organize projects</p>
          <Button onClick={() => { setEditingSpace(null); setShowSpaceDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Space
          </Button>
        </div>
      )}

      {/* Space Dialog */}
      <SpaceDialog
        open={showSpaceDialog}
        onOpenChange={setShowSpaceDialog}
        space={editingSpace}
        onSave={editingSpace ? handleUpdateSpace : handleCreateSpace}
      />
    </div>
  );
};

export default Projects;
