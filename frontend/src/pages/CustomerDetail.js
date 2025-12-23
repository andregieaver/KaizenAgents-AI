import { useState, useEffect, useRef } from 'react';
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
  AlertCircle
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

const API = process.env.REACT_APP_BACKEND_URL;

const CustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [conversations, setConversations] = useState([]);
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

  useEffect(() => {
    fetchData();
  }, [customerId, token]);

  const fetchData = async () => {
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
    } catch (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to load customer');
    } finally {
      setLoading(false);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/crm')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {customer.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">
                {customer.position && `${customer.position} at `}{customer.company || 'No company'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <Button size="sm" variant="outline" onClick={() => setShowEmailModal(true)} disabled={!customer.email}>
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowFollowupModal(true)}>
          <Calendar className="h-4 w-4 mr-2" />
          Follow-up
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowNoteModal(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Note
        </Button>
        {customer.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${customer.phone}`}>
              <Phone className="h-4 w-4 mr-2" />
              Call
            </a>
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">Overview</TabsTrigger>
          <TabsTrigger value="conversations" className="flex-1 sm:flex-none">
            Conversations
            {conversations.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                {conversations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">History</TabsTrigger>
          <TabsTrigger value="followups" className="flex-1 sm:flex-none">Follow-ups</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Customer Information</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                <Edit className="h-4 w-4 mr-1" />
                {editMode ? 'Cancel' : 'Edit'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {editMode ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editData.name || ''}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        value={editData.company || ''}
                        onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Input
                        value={editData.position || ''}
                        onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
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
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={editData.address || ''}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setEditMode(false); setEditData(customer); }}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{customer.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{customer.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="text-sm font-medium">{customer.company || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Position</p>
                      <p className="text-sm font-medium">{customer.position || 'Not provided'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>{customer.status}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Contact</p>
                      <p className="text-sm font-medium">
                        {customer.last_contact
                          ? formatDistanceToNow(new Date(customer.last_contact), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                  {customer.address && (
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="text-sm font-medium">{customer.address}</p>
                    </div>
                  )}
                  {customer.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{customer.notes}</p>
                    </div>
                  )}
                  {customer.tags?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Tags</p>
                      <div className="flex gap-1 flex-wrap">
                        {customer.tags.map((tag, i) => (
                          <Badge key={i} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
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
