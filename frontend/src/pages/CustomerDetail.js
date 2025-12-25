import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Tag,
  Clock,
  Edit,
  Trash2,
  Plus,
  Send,
  CheckCircle,
  Calendar,
  MessageSquare,
  FileText,
  Activity,
  Loader2,
  MoreHorizontal,
  PhoneCall,
  Video,
  AlertCircle,
  TrendingUp,
  Zap,
  RefreshCw,
  Sparkles
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

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

const CustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [leadScore, setLeadScore] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  
  const [newFollowup, setNewFollowup] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
    type: 'call'
  });
  
  const [newEmail, setNewEmail] = useState({
    subject: '',
    body: ''
  });
  
  const [newNote, setNewNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [customerRes, activitiesRes, followupsRes, conversationsRes] = await Promise.all([
        axios.get(`${API}/api/crm/customers/${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/crm/activities?customer_id=${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/crm/followups?customer_id=${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/crm/customers/${customerId}/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })) // Gracefully handle if no conversations
      ]);
      setCustomer(customerRes.data);
      setEditData(customerRes.data);
      setActivities(activitiesRes.data);
      setFollowups(followupsRes.data);
      setConversations(conversationsRes.data || []);
      
      // Fetch lead score if available, otherwise auto-calculate
      if (customerRes.data.lead_score !== undefined && customerRes.data.lead_score !== null) {
        setLeadScore({
          score: customerRes.data.lead_score,
          grade: customerRes.data.lead_grade
        });
      } else {
        // Auto-calculate lead score if not available
        try {
          const scoreRes = await axios.get(
            `${API}/api/crm/customers/${customerId}/lead-score`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setLeadScore(scoreRes.data);
        } catch (scoreError) {
          console.debug('Could not auto-calculate lead score:', scoreError);
        }
      }
    } catch (error) {
      toast.error('Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [customerId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const refreshLeadScore = async () => {
    setLoadingScore(true);
    try {
      const response = await axios.get(
        `${API}/api/crm/customers/${customerId}/lead-score`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLeadScore(response.data);
      toast.success('Lead score updated');
    } catch (error) {
      toast.error('Failed to calculate lead score');
    } finally {
      setLoadingScore(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(
        `${API}/api/crm/customers/${customerId}`,
        editData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Customer updated');
      setEditMode(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(
        `${API}/api/crm/customers/${customerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Customer deleted');
      navigate('/dashboard/crm');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleAddFollowup = async () => {
    if (!newFollowup.title || !newFollowup.due_date) {
      toast.error('Title and due date are required');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(
        `${API}/api/crm/followups`,
        { ...newFollowup, customer_id: customerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Follow-up scheduled');
      setShowFollowupModal(false);
      setNewFollowup({ title: '', description: '', due_date: '', priority: 'medium', type: 'call' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add follow-up');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowup = async (followupId) => {
    try {
      await axios.patch(
        `${API}/api/crm/followups/${followupId}`,
        { status: 'completed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Follow-up completed');
      fetchData();
    } catch (error) {
      toast.error('Failed to complete follow-up');
    }
  };

  const handleSendEmail = async () => {
    if (!newEmail.subject || !newEmail.body) {
      toast.error('Subject and body are required');
      return;
    }
    
    setSaving(true);
    try {
      const response = await axios.post(
        `${API}/api/crm/email/send`,
        { ...newEmail, customer_id: customerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Email sent');
      } else {
        toast.error(response.data.message || 'Failed to send email');
      }
      setShowEmailModal(false);
      setNewEmail({ subject: '', body: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Note cannot be empty');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(
        `${API}/api/crm/activities`,
        {
          customer_id: customerId,
          type: 'note',
          title: 'Note added',
          description: newNote
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Note added');
      setShowNoteModal(false);
      setNewNote('');
      fetchData();
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'email_sent': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'call': return <PhoneCall className="h-4 w-4 text-green-500" />;
      case 'meeting': return <Video className="h-4 w-4 text-purple-500" />;
      case 'note': return <FileText className="h-4 w-4 text-yellow-500" />;
      case 'followup_completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'status_change': return <Activity className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Customer not found</p>
          <Button variant="outline" onClick={() => navigate('/dashboard/crm')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header - Simplified for mobile */}
      <div className="mb-6">
        {/* Top row: Back button, Lead Score, Action icons */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/crm')} className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          
          {/* Lead Score - Inline compact */}
          {leadScore && (
            <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-full">
              <span className="text-sm font-bold">{leadScore.score}</span>
              <Badge className={`text-[10px] px-1.5 py-0 h-5 ${
                leadScore.grade === 'A' ? 'bg-green-500' :
                leadScore.grade === 'B' ? 'bg-blue-500' :
                leadScore.grade === 'C' ? 'bg-yellow-500' :
                leadScore.grade === 'D' ? 'bg-orange-500' : 'bg-gray-400'
              }`}>
                {leadScore.grade}
              </Badge>
              {leadScore.metrics && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  {leadScore.metrics.conversation_count} conv · {leadScore.metrics.message_count} msg
                </span>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={refreshLeadScore}
              disabled={loadingScore}
              title="Refresh lead score"
            >
              {loadingScore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Customer info row */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg sm:text-xl font-bold text-primary">
              {customer.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-lg sm:text-xl font-bold truncate">{customer.name}</h1>
            <p className="text-sm text-muted-foreground truncate">
              {customer.position && `${customer.position} at `}{customer.company || 'No company'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions - Icon only on mobile, with blur fade indicator */}
      <div className="relative mb-4 sm:mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Button size="sm" variant="outline" onClick={() => setShowEmailModal(true)} disabled={!customer.email} className="flex-shrink-0">
            <Mail className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Email</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowFollowupModal(true)} className="flex-shrink-0">
            <Calendar className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Follow-up</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowNoteModal(true)} className="flex-shrink-0">
            <FileText className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Note</span>
          </Button>
          {customer.phone && (
            <Button size="sm" variant="outline" asChild className="flex-shrink-0">
              <a href={`tel:${customer.phone}`}>
                <Phone className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Call</span>
              </a>
            </Button>
          )}
        </div>
        {/* Blur fade indicator on right edge */}
        <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="conversations" className="text-xs sm:text-sm">
            Conversations
            {conversations.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                {conversations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">History</TabsTrigger>
          <TabsTrigger value="followups" className="text-xs sm:text-sm">Follow-ups</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
              <CardTitle className="text-sm sm:text-base">Customer Information</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)} className="h-8 text-xs sm:text-sm">
                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {editMode ? 'Cancel' : 'Edit'}
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={editData.name || ''}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone</Label>
                      <Input
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company</Label>
                      <Input
                        value={editData.company || ''}
                        onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Position</Label>
                      <Input
                        value={editData.position || ''}
                        onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        value={editData.status || 'active'}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="lead">Lead</option>
                        <option value="prospect">Prospect</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={editData.address || ''}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setEditData(customer); }}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Single column on mobile, two columns on larger screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 sm:border-0">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</p>
                        <p className="text-sm truncate">{customer.email || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 sm:border-0">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</p>
                        <p className="text-sm truncate">{customer.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 sm:border-0">
                      <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Company</p>
                        <p className="text-sm truncate">{customer.company || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 sm:border-0">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Position</p>
                        <p className="text-sm truncate">{customer.position || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 sm:border-0">
                      <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="text-xs mt-0.5">{customer.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 sm:border-0">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Last Contact</p>
                        <p className="text-sm">
                          {customer.last_contact
                            ? formatDistanceToNow(new Date(customer.last_contact), { addSuffix: true })
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {customer.address && (
                    <div className="flex items-start gap-2 pt-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</p>
                        <p className="text-sm">{customer.address}</p>
                      </div>
                    </div>
                  )}
                  {customer.notes && (
                    <div className="pt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{customer.notes}</p>
                    </div>
                  )}
                  {customer.tags?.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Tags</p>
                      <div className="flex gap-1 flex-wrap">
                        {customer.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversation History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-1">No conversations yet</p>
                  <p className="text-xs text-muted-foreground">
                    Conversations will appear here when linked to this customer
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <Link
                      key={conv.id}
                      to={`/dashboard/conversations/${conv.id}`}
                      className="block"
                    >
                      <div className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={conv.status === 'resolved' ? 'outline' : conv.status === 'open' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {conv.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {conv.mode}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {conv.source}
                              </Badge>
                            </div>
                            {conv.last_message && (
                              <p className="text-sm text-muted-foreground truncate">
                                {conv.last_message}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>{conv.message_count || 0} messages</span>
                              <span>•</span>
                              <span>{format(new Date(conv.created_at), 'MMM d, yyyy')}</span>
                              {conv.last_message_at && (
                                <>
                                  <span>•</span>
                                  <span>Last: {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{activity.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Follow-ups Tab */}
        <TabsContent value="followups">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Follow-ups</CardTitle>
              <Button size="sm" onClick={() => setShowFollowupModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {followups.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No follow-ups scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followups.map((followup) => {
                    const isOverdue = new Date(followup.due_date) < new Date() && followup.status === 'pending';
                    return (
                      <div
                        key={followup.id}
                        className={`p-3 rounded-lg border ${isOverdue ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{followup.title}</p>
                              <Badge variant={followup.priority === 'high' ? 'destructive' : followup.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                {followup.priority}
                              </Badge>
                            </div>
                            {followup.description && (
                              <p className="text-xs text-muted-foreground mt-1">{followup.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(followup.due_date), 'PPp')}
                              </span>
                              <Badge variant="outline" className="text-xs">{followup.type}</Badge>
                            </div>
                          </div>
                          {followup.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCompleteFollowup(followup.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {followup.status === 'completed' && (
                            <Badge variant="outline" className="text-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Done
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {customer.name}? This will also delete all associated activities and follow-ups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Follow-up Modal */}
      <Dialog open={showFollowupModal} onOpenChange={setShowFollowupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Follow up on proposal"
                value={newFollowup.title}
                onChange={(e) => setNewFollowup({ ...newFollowup, title: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={newFollowup.type}
                  onChange={(e) => setNewFollowup({ ...newFollowup, type: e.target.value })}
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={newFollowup.priority}
                  onChange={(e) => setNewFollowup({ ...newFollowup, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Input
                type="datetime-local"
                value={newFollowup.due_date}
                onChange={(e) => setNewFollowup({ ...newFollowup, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Additional details..."
                value={newFollowup.description}
                onChange={(e) => setNewFollowup({ ...newFollowup, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowupModal(false)}>Cancel</Button>
            <Button onClick={handleAddFollowup} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email to {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              To: {customer.email}
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Email subject"
                value={newEmail.subject}
                onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Write your message..."
                value={newEmail.body}
                onChange={(e) => setNewEmail({ ...newEmail, body: e.target.value })}
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Write your note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteModal(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDetail;
