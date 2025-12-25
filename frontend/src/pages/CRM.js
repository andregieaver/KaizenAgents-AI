import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
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
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Loader2,
  UserPlus,
  Calendar,
  Filter,
  TrendingUp,
  Zap,
  Star,
  Flame,
  Bell,
  X,
  LayoutGrid,
  List,
  Keyboard,
  GripVertical,
  Trash2,
  Download,
  FileText
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';

const API = process.env.REACT_APP_BACKEND_URL;

// Lead Score Badge Component
const LeadScoreBadge = ({ score, grade }) => {
  if (!score && score !== 0) return null;
  
  const gradeConfig = {
    'A': { color: 'bg-green-500', label: 'Hot' },
    'B': { color: 'bg-blue-500', label: 'Warm' },
    'C': { color: 'bg-yellow-500', label: 'Potential' },
    'D': { color: 'bg-orange-500', label: 'Cold' },
    'F': { color: 'bg-gray-400', label: 'Low' }
  };
  
  const config = gradeConfig[grade] || gradeConfig['F'];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white ${config.color}`}>
            <TrendingUp className="h-3 w-3" />
            {score}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Lead Score: {score}/100 ({config.label})</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Quick Filter Chip Component
const QuickFilterChip = ({ active, onClick, icon, label, count, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap
      ${active 
        ? variant === 'hot'
          ? 'bg-orange-500 text-white'
          : variant === 'warning'
          ? 'bg-amber-500 text-white'
          : 'bg-primary text-primary-foreground'
        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
      }
    `}
  >
    {icon}
    {label}
    {count > 0 && (
      <span className={`
        ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
        ${active ? 'bg-white/20' : 'bg-background'}
      `}>
        {count}
      </span>
    )}
  </button>
);

// Pipeline stages for Kanban view
const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { id: 'closed', label: 'Closed', color: 'bg-green-500' },
];

// Draggable Kanban Card Component - drag handle on left, rest is clickable
const KanbanCard = ({ customer, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isBeingDragged,
  } = useSortable({ 
    id: customer.id,
    data: {
      type: 'customer',
      customer,
      stage: customer.pipeline_stage || 'lead',
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isBeingDragged ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-background border rounded-lg mb-2 transition-all select-none ${
        isBeingDragged ? 'shadow-lg border-primary scale-105 z-50' : 'border-border hover:shadow-md'
      }`}
    >
      <div className="flex">
        {/* Drag Handle - large touch target */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-10 flex-shrink-0 cursor-grab active:cursor-grabbing bg-muted/30 hover:bg-muted rounded-l-lg touch-none"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        
        {/* Clickable Content Area */}
        <Link 
          to={`/dashboard/crm/${customer.id}`}
          className="flex-1 p-3 min-w-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-primary">
                  {customer.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{customer.name}</p>
                {customer.company && (
                  <p className="text-xs text-muted-foreground truncate">{customer.company}</p>
                )}
              </div>
            </div>
            {customer.lead_score !== undefined && (
              <LeadScoreBadge score={customer.lead_score} grade={customer.lead_grade} />
            )}
          </div>
          {customer.email && (
            <p className="text-xs text-muted-foreground mt-2 truncate flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {customer.email}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
};

// Droppable Kanban Column Component
const KanbanColumn = ({ stage, customers }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: 'column',
      stage: stage.id,
    }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-lg p-3 transition-colors touch-none ${
        isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'
      }`}
      style={{ touchAction: 'none' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${stage.color}`} />
          <h3 className="font-medium text-sm">{stage.label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">{customers.length}</Badge>
      </div>
      <div className="h-[calc(100vh-380px)] overflow-y-auto">
        <SortableContext items={customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="min-h-[100px]">
            {customers.map(customer => (
              <KanbanCard key={customer.id} customer={customer} />
            ))}
            {customers.length === 0 && (
              <div className={`text-center py-8 text-sm border-2 border-dashed rounded-lg ${
                isOver ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'
              }`}>
                {isOver ? 'Drop here' : 'No customers'}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

const CRM = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'kanban'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeId, setActiveId] = useState(null);
  
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    notes: '',
    tags: []
  });
  
  // Scroll fade indicators for Kanban view
  const kanbanRef = useRef(null);
  const [kanbanScroll, setKanbanScroll] = useState({ canScrollLeft: false, canScrollRight: false });
  
  const updateKanbanScrollState = useCallback(() => {
    const el = kanbanRef.current;
    if (el) {
      const canScrollLeft = el.scrollLeft > 5;
      const canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth - 5);
      setKanbanScroll({ canScrollLeft, canScrollRight });
    }
  }, []);
  
  useEffect(() => {
    const el = kanbanRef.current;
    if (el && viewMode === 'kanban') {
      updateKanbanScrollState();
      el.addEventListener('scroll', updateKanbanScrollState);
      window.addEventListener('resize', updateKanbanScrollState);
      return () => {
        el.removeEventListener('scroll', updateKanbanScrollState);
        window.removeEventListener('resize', updateKanbanScrollState);
      };
    }
  }, [updateKanbanScrollState, viewMode]);
  
  // Scroll fade indicators for filter chips
  const filtersRef = useRef(null);
  const [filtersScroll, setFiltersScroll] = useState({ canScrollLeft: false, canScrollRight: false });
  
  const updateFiltersScrollState = useCallback(() => {
    const el = filtersRef.current;
    if (el) {
      const canScrollLeft = el.scrollLeft > 5;
      const canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth - 5);
      setFiltersScroll({ canScrollLeft, canScrollRight });
    }
  }, []);
  
  useEffect(() => {
    const el = filtersRef.current;
    if (el) {
      updateFiltersScrollState();
      el.addEventListener('scroll', updateFiltersScrollState);
      window.addEventListener('resize', updateFiltersScrollState);
      return () => {
        el.removeEventListener('scroll', updateFiltersScrollState);
        window.removeEventListener('resize', updateFiltersScrollState);
      };
    }
  }, [updateFiltersScrollState, loading]);
  
  // DnD sensors - TouchSensor for mobile, PointerSensor for desktop
  // Using distance constraint instead of delay for Android Chrome compatibility
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { distance: 5 } 
    }),
    useSensor(TouchSensor, { 
      activationConstraint: { 
        distance: 10,  // Use distance instead of delay for Android
      } 
    }),
    useSensor(KeyboardSensor)
  );

  const fetchData = useCallback(async () => {
    try {
      const [customersRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/crm/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/crm/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setCustomers(customersRes.data);
      setStats(statsRes.data);
    } catch {
      // CRM data fetch failed silently
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      toast.error('Customer name is required');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API}/api/crm/customers`,
        newCustomer,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Customer added successfully');
      setShowAddModal(false);
      setNewCustomer({ name: '', email: '', phone: '', company: '', position: '', notes: '', tags: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    // Apply quick filter first
    if (activeFilter === 'hot_leads') {
      // Hot leads: Grade A or B (score >= 60)
      if (!customer.lead_score || customer.lead_score < 60) return false;
    } else if (activeFilter === 'needs_followup') {
      // Needs follow-up: Has pending follow-up or overdue
      if (!customer.next_followup) return false;
      const followupDate = new Date(customer.next_followup);
      if (followupDate > new Date()) return false; // Only show if due or overdue
    } else if (activeFilter === 'active') {
      if (customer.status !== 'active') return false;
    }
    
    // Then apply search filter
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.company?.toLowerCase().includes(searchLower)
    );
  });
  
  // Calculate filter counts
  const hotLeadsCount = customers.filter(c => c.lead_score && c.lead_score >= 60).length;
  const needsFollowupCount = customers.filter(c => {
    if (!c.next_followup) return false;
    return new Date(c.next_followup) <= new Date();
  }).length;
  const activeCount = customers.filter(c => c.status === 'active').length;
  
  // Keyboard shortcuts
  const handleNavigateNext = useCallback(() => {
    setSelectedIndex(prev => Math.min(prev + 1, filteredCustomers.length - 1));
  }, [filteredCustomers.length]);
  
  const handleNavigatePrev = useCallback(() => {
    setSelectedIndex(prev => Math.max(prev - 1, 0));
  }, []);
  
  const handleOpenSelected = useCallback(() => {
    if (selectedIndex >= 0 && filteredCustomers[selectedIndex]) {
      navigate(`/dashboard/crm/${filteredCustomers[selectedIndex].id}`);
    }
  }, [selectedIndex, filteredCustomers, navigate]);
  
  useKeyboardShortcuts({
    'j': handleNavigateNext,
    'k': handleNavigatePrev,
    'Enter': handleOpenSelected,
    'n': () => setShowAddModal(true),
    'v': () => setViewMode(prev => prev === 'list' ? 'kanban' : 'list'),
    '?': () => setShowShortcutsHelp(true),
    'Escape': () => {
      setSelectedIds(new Set());
      setSelectedIndex(-1);
      setShowAddModal(false);
    },
  }, !showShortcutsHelp && !showAddModal);
  
  // Toggle selection
  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  // Bulk delete
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} customers? This cannot be undone.`)) {
      return;
    }
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          axios.delete(`${API}/api/crm/customers/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      toast.success(`${selectedIds.size} customers deleted`);
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      toast.error('Failed to delete some customers');
    }
  };
  
  // Drag handlers for Kanban
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };
  
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    // Find the dragged customer
    const activeCustomer = customers.find(c => c.id === active.id);
    if (!activeCustomer) return;
    
    // Determine the target stage - check if dropped on column or on another card
    let targetStage = null;
    
    // Check if dropped directly on a column
    if (PIPELINE_STAGES.some(s => s.id === over.id)) {
      targetStage = over.id;
    } else {
      // Dropped on a card - find which column that card is in
      const targetCustomer = customers.find(c => c.id === over.id);
      if (targetCustomer) {
        targetStage = targetCustomer.pipeline_stage || 'lead';
      }
    }
    
    if (!targetStage) return;
    
    const currentStage = activeCustomer.pipeline_stage || 'lead';
    
    // Only update if stage actually changed
    if (currentStage !== targetStage) {
      // Optimistically update local state first for immediate feedback
      setCustomers(prev => prev.map(c => 
        c.id === active.id ? { ...c, pipeline_stage: targetStage } : c
      ));
      
      try {
        await axios.patch(
          `${API}/api/crm/customers/${active.id}`,
          { pipeline_stage: targetStage },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Moved to ${PIPELINE_STAGES.find(s => s.id === targetStage)?.label}`);
      } catch (error) {
        // Revert on error
        setCustomers(prev => prev.map(c => 
          c.id === active.id ? { ...c, pipeline_stage: currentStage } : c
        ));
        toast.error('Failed to update customer stage');
      }
    }
  };
  
  const handleDragCancel = () => {
    setActiveId(null);
  };
  
  // Group customers by pipeline stage for Kanban view
  const customersByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = filteredCustomers.filter(c => (c.pipeline_stage || 'lead') === stage.id);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer relationships
          </p>
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* View Toggle */}
            <div className="flex items-center border rounded-md p-1 flex-shrink-0">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-8"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcutsHelp(true)}
              className="hidden sm:flex items-center gap-1 text-muted-foreground flex-shrink-0"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            
            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  window.open(`${API}/api/crm/export?format=csv`, '_blank');
                  toast.success('Downloading CSV...');
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  window.open(`${API}/api/crm/export?format=json`, '_blank');
                  toast.success('Downloading JSON...');
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button onClick={() => setShowAddModal(true)} className="sm:w-auto flex-shrink-0">
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Customer</span>
            </Button>
          </div>
          {/* Fade indicator on right edge for mobile */}
          <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
        </div>
      </div>
      
      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in slide-in-from-top-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid gap-3 sm:gap-4 mb-6">
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold">{stats.total_customers || 0}</p>
            <p className="text-xs text-muted-foreground">Total Customers</p>
          </CardContent>
        </Card>
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold">{stats.active_customers || 0}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold">{stats.pending_followups || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Follow-ups</p>
          </CardContent>
        </Card>
        <Card className="border-0 btn-neumorphic !bg-card">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-heading text-xl sm:text-2xl font-bold text-destructive">{stats.overdue_followups || 0}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Quick Filter Chips - Inline scrollable on mobile */}
      <div className="relative mb-4">
        <div 
          ref={filtersRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
          onScroll={updateFiltersScrollState}
        >
          <QuickFilterChip
            active={activeFilter === 'hot_leads'}
            onClick={() => setActiveFilter(activeFilter === 'hot_leads' ? 'all' : 'hot_leads')}
            icon={<Flame className="h-3 w-3" />}
            label="Hot Leads"
            count={hotLeadsCount}
            variant="hot"
          />
          <QuickFilterChip
            active={activeFilter === 'needs_followup'}
            onClick={() => setActiveFilter(activeFilter === 'needs_followup' ? 'all' : 'needs_followup')}
            icon={<Bell className="h-3 w-3" />}
            label="Needs Follow-up"
            count={needsFollowupCount}
            variant="warning"
          />
          <QuickFilterChip
            active={activeFilter === 'active'}
            onClick={() => setActiveFilter(activeFilter === 'active' ? 'all' : 'active')}
            icon={<CheckCircle className="h-3 w-3" />}
            label="Active"
            count={activeCount}
          />
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="h-3 w-3" />
              Clear filter
            </button>
          )}
        </div>
        {/* Dynamic fade indicators based on scroll position */}
        {filtersScroll.canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-1 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none sm:hidden" />
        )}
        {filtersScroll.canScrollRight && (
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
        )}
      </div>

      {/* Customer List / Kanban View */}
      {viewMode === 'list' ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No customers yet</p>
                <Button onClick={() => setShowAddModal(true)} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first customer
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className={`flex items-center gap-2 transition-colors ${
                      selectedIndex === index ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                    } ${selectedIds.has(customer.id) ? 'bg-primary/5' : ''}`}
                  >
                    {/* Checkbox */}
                    <div className="pl-3 py-4">
                      <Checkbox
                        checked={selectedIds.has(customer.id)}
                        onCheckedChange={() => toggleSelection(customer.id)}
                        className="h-4 w-4"
                      />
                    </div>
                    
                    <Link
                      to={`/dashboard/crm/${customer.id}`}
                      className="flex-1 block"
                    >
                      <div className="p-4 pl-2 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-primary">
                                {customer.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{customer.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {customer.company && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Building className="h-3 w-3" />
                                    {customer.company}
                                  </span>
                                )}
                                {customer.email && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Mail className="h-3 w-3" />
                                    {customer.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              {customer.lead_score !== undefined && (
                                <LeadScoreBadge score={customer.lead_score} grade={customer.lead_grade} />
                              )}
                              <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                {customer.status}
                              </Badge>
                            </div>
                            {customer.last_contact && (
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(customer.last_contact), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        {customer.tags?.length > 0 && (
                          <div className="flex gap-1 mt-2 ml-13">
                            {customer.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {customer.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{customer.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Kanban View */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => {
            handleDragStart(event);
            // Add class to body to prevent scrolling during drag
            document.body.classList.add('kanban-dragging');
          }}
          onDragEnd={(event) => {
            document.body.classList.remove('kanban-dragging');
            handleDragEnd(event);
          }}
          onDragCancel={() => {
            document.body.classList.remove('kanban-dragging');
            handleDragCancel();
          }}
        >
          <div className="relative">
            <div 
              ref={kanbanRef}
              className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide"
              onScroll={updateKanbanScrollState}
            >
              {PIPELINE_STAGES.map(stage => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  customers={customersByStage[stage.id] || []}
                />
              ))}
            </div>
            {/* Dynamic fade indicators based on scroll position */}
            {kanbanScroll.canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none sm:hidden" />
            )}
            {kanbanScroll.canScrollRight && (
              <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
            )}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <div className="bg-background border-2 border-primary rounded-lg p-3 shadow-xl w-64 touch-none">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {customers.find(c => c.id === activeId)?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{customers.find(c => c.id === activeId)?.name}</p>
                    <p className="text-xs text-muted-foreground">{customers.find(c => c.id === activeId)?.email}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add Customer Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 234 567 8900"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Acme Inc"
                  value={newCustomer.company}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  placeholder="CEO"
                  value={newCustomer.position}
                  onChange={(e) => setNewCustomer({ ...newCustomer, position: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                rows={3}
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp 
        context="crm" 
        isOpen={showShortcutsHelp} 
        onClose={() => setShowShortcutsHelp(false)} 
      />
    </div>
  );
};

export default CRM;
