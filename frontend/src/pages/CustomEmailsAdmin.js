import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import RichTextEditor from '../components/RichTextEditor';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Mail,
  Loader2,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Send,
  Copy,
  Eye,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomEmailsAdmin = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  
  // Editor state
  const [editingEmail, setEditingEmail] = useState(null);
  const [emailForm, setEmailForm] = useState({
    name: '',
    subject: '',
    html_content: '',
    recipient_category: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [emailsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/custom-emails`, { headers }),
        axios.get(`${API}/custom-emails/categories`, { headers })
      ]);
      setEmails(emailsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNewEmail = () => {
    setEditingEmail(null);
    setEmailForm({
      name: '',
      subject: '',
      html_content: getDefaultTemplate(),
      recipient_category: ''
    });
    setActiveTab('editor');
  };

  const handleEditEmail = (email) => {
    setEditingEmail(email);
    setEmailForm({
      name: email.name,
      subject: email.subject,
      html_content: unwrapEmailContent(email.html_content),
      recipient_category: email.recipient_category
    });
    setActiveTab('editor');
  };

  const handleSaveEmail = async (status = 'draft') => {
    if (!emailForm.name.trim()) {
      toast.error('Please enter a name for the email');
      return;
    }
    if (!emailForm.subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!emailForm.recipient_category) {
      toast.error('Please select a recipient category');
      return;
    }

    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // Wrap content with email-safe HTML before saving
      const data = { 
        ...emailForm, 
        html_content: wrapEmailContent(emailForm.html_content),
        status 
      };

      if (editingEmail) {
        await axios.patch(`${API}/custom-emails/${editingEmail.id}`, data, { headers });
        toast.success('Email updated successfully');
      } else {
        await axios.post(`${API}/custom-emails`, data, { headers });
        toast.success('Email created successfully');
      }
      
      await fetchData();
      setActiveTab('list');
      setEditingEmail(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save email');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmail = async () => {
    if (!selectedEmail) return;
    setSaving(true);
    try {
      await axios.delete(`${API}/custom-emails/${selectedEmail.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Email deleted successfully');
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete email');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateEmail = async (email) => {
    try {
      await axios.post(`${API}/custom-emails/${email.id}/duplicate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Email duplicated successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to duplicate email');
    }
  };

  const handleSendEmail = async (testMode = false) => {
    if (!selectedEmail) return;
    
    if (testMode && !testEmail.trim()) {
      toast.error('Please enter a test email address');
      return;
    }

    setSending(true);
    try {
      const params = new URLSearchParams();
      params.append('test_mode', testMode.toString());
      if (testMode) {
        params.append('test_email', testEmail);
      }

      const response = await axios.post(
        `${API}/custom-emails/${selectedEmail.id}/send?${params.toString()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message);
      setSendDialogOpen(false);
      setTestEmail('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Sent</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Scheduled</Badge>;
      default:
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" /> Draft</Badge>;
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getCategoryCount = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.count || 0;
  };

  const getDefaultTemplate = () => {
    return `<h1>Hello {{user_name}},</h1>
<p>Your email content goes here...</p>
<p>Best regards,<br>The {{platform_name}} Team</p>`;
  };

  // Wrap rich text editor content with email-safe HTML wrapper
  const wrapEmailContent = (content) => {
    // Don't double wrap
    if (content.includes('max-width: 600px')) {
      return content;
    }
    
    // Wrap content with email-safe styling
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
${content}
<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
<p style="color: #888; font-size: 12px; text-align: center;">
© {{year}} {{platform_name}}. All rights reserved.
</p>
</div>`;
  };

  // Extract body content from wrapped email for editing
  const unwrapEmailContent = (html) => {
    if (!html) return '';
    
    // Try to extract content between wrapper div and footer hr
    const match = html.match(/<div[^>]*max-width: 600px[^>]*>([\s\S]*?)<hr/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Custom Emails</h1>
          <p className="text-muted-foreground">Create and send email campaigns to user groups</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleNewEmail}>
            <Plus className="h-4 w-4 mr-2" />
            New Email
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">
            <Mail className="h-4 w-4 mr-2" />
            Email List
          </TabsTrigger>
          <TabsTrigger value="editor">
            <Edit className="h-4 w-4 mr-2" />
            {editingEmail ? 'Edit Email' : 'New Email'}
          </TabsTrigger>
        </TabsList>

        {/* Email List Tab */}
        <TabsContent value="list" className="space-y-4">
          {emails.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No custom emails yet</p>
                <Button onClick={handleNewEmail}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Email
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {emails.map((email) => (
                <Card key={email.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{email.name}</h3>
                          {getStatusBadge(email.status)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          Subject: {email.subject}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {getCategoryName(email.recipient_category)} ({getCategoryCount(email.recipient_category)})
                          </span>
                          {email.status === 'sent' && (
                            <>
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                Sent: {email.sent_count}
                              </span>
                              {email.failed_count > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <XCircle className="h-3 w-3" />
                                  Failed: {email.failed_count}
                                </span>
                              )}
                            </>
                          )}
                          <span>
                            Created: {new Date(email.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedEmail(email);
                            setPreviewDialogOpen(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          {email.status !== 'sent' && (
                            <DropdownMenuItem onClick={() => handleEditEmail(email)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicateEmail(email)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setSelectedEmail(email);
                            setSendDialogOpen(true);
                          }}>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedEmail(email);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingEmail ? 'Edit Email' : 'Create New Email'}</CardTitle>
              <CardDescription>
                Compose your email and select recipients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Email Name (Internal)</Label>
                  <Input
                    id="name"
                    value={emailForm.name}
                    onChange={(e) => setEmailForm({...emailForm, name: e.target.value})}
                    placeholder="e.g., Welcome Campaign Q1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Recipient Category</Label>
                  <Select 
                    value={emailForm.recipient_category} 
                    onValueChange={(v) => setEmailForm({...emailForm, recipient_category: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} ({cat.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  placeholder="e.g., Big news from {{platform_name}}!"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{user_name}}"}, {"{{platform_name}}"}, {"{{year}}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Email Content</Label>
                <RichTextEditor
                  content={emailForm.html_content}
                  onChange={(html) => setEmailForm({...emailForm, html_content: html})}
                  placeholder="Start typing your email content..."
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {"{{user_name}}"}, {"{{user_email}}"}, {"{{platform_name}}"}, {"{{year}}"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button onClick={() => handleSaveEmail('draft')} disabled={saving} variant="outline">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <FileText className="h-4 w-4 mr-2" />
                  Save as Draft
                </Button>
                <Button onClick={() => setActiveTab('list')} variant="ghost">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Email</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedEmail?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteEmail} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send &quot;{selectedEmail?.name}&quot; to {getCategoryName(selectedEmail?.recipient_category)} ({getCategoryCount(selectedEmail?.recipient_category)} recipients)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Test Email Address (Optional)</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Send a test to this email first"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            {testEmail && (
              <Button variant="secondary" onClick={() => handleSendEmail(true)} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Test
              </Button>
            )}
            <Button onClick={() => handleSendEmail(false)} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Send className="h-4 w-4 mr-2" />
              Send to All ({getCategoryCount(selectedEmail?.recipient_category)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Subject: {selectedEmail?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <div 
              dangerouslySetInnerHTML={{ 
                __html: selectedEmail?.html_content
                  ?.replace(/\{\{user_name\}\}/g, 'John Doe')
                  ?.replace(/\{\{user_email\}\}/g, 'john@example.com')
                  ?.replace(/\{\{platform_name\}\}/g, 'Platform')
                  ?.replace(/\{\{year\}\}/g, new Date().getFullYear().toString())
                  || '' 
              }} 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomEmailsAdmin;
