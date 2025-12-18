import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
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
  Mail,
  ArrowLeft,
  Loader2,
  Save,
  Eye,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Shield,
  CreditCard,
  Bell,
  Users,
  Code
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  authentication: Shield,
  billing: CreditCard,
  notifications: Bell,
  team: Users
};

const CATEGORY_COLORS = {
  authentication: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  billing: 'bg-green-500/10 text-green-500 border-green-500/20',
  notifications: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  team: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
};

const EmailTemplates = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [previewContent, setPreviewContent] = useState({ subject: '', html_content: '' });
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [showTestEmailInput, setShowTestEmailInput] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    subject: '',
    html_content: '',
    is_enabled: true
  });

  useEffect(() => {
    if (!user?.is_super_admin) {
      toast.error('Access denied. Super admin only.');
      navigate('/dashboard');
      return;
    }
    fetchTemplates();
  }, [token, user, navigate]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/email-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (template) => {
    setSelectedTemplate(template);
    setEditForm({
      name: template.name,
      description: template.description,
      subject: template.subject,
      html_content: template.html_content,
      is_enabled: template.is_enabled
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    
    setSaving(true);
    try {
      await axios.put(
        `${API}/admin/email-templates/${selectedTemplate.key}`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Email template saved successfully');
      setEditModalOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const response = await axios.post(
        `${API}/admin/email-templates/preview`,
        {
          subject: editForm.subject,
          html_content: editForm.html_content
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPreviewContent(response.data);
      setPreviewModalOpen(true);
    } catch (error) {
      console.error('Error previewing template:', error);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handleReset = async () => {
    if (!selectedTemplate) return;
    
    if (!window.confirm('Are you sure you want to reset this template to default? Your changes will be lost.')) {
      return;
    }
    
    setResetting(true);
    try {
      const response = await axios.post(
        `${API}/admin/email-templates/${selectedTemplate.key}/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Template reset to default');
      
      // Update the form with reset content
      const resetTemplate = response.data.template;
      setEditForm({
        name: resetTemplate.name,
        description: resetTemplate.description,
        subject: resetTemplate.subject,
        html_content: resetTemplate.html_content,
        is_enabled: resetTemplate.is_enabled
      });
      
      fetchTemplates();
    } catch (error) {
      console.error('Error resetting template:', error);
      toast.error(error.response?.data?.detail || 'Failed to reset template');
    } finally {
      setResetting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!selectedTemplate || !testEmailAddress) {
      toast.error('Please enter an email address');
      return;
    }
    
    setSendingTest(true);
    try {
      const response = await axios.post(
        `${API}/admin/email-templates/send-test`,
        {
          template_key: selectedTemplate.key,
          to_email: testEmailAddress
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || 'Test email sent successfully!');
      setShowTestEmailInput(false);
      setTestEmailAddress('');
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error(error.response?.data?.detail || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold font-heading">Email Templates</h1>
            </div>
            <p className="text-muted-foreground">
              Manage and customize transactional email templates
            </p>
          </div>
          <Button variant="outline" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Template Categories */}
      <div className="space-y-8">
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
          const CategoryIcon = CATEGORY_ICONS[category] || Mail;
          const colorClass = CATEGORY_COLORS[category] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
          
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold capitalize">{category}</h2>
                <Badge variant="secondary" className="text-xs">
                  {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                {categoryTemplates.map((template) => (
                  <Card 
                    key={template.id}
                    className={cn(
                      "border cursor-pointer transition-all hover:shadow-md",
                      !template.is_enabled && "opacity-60"
                    )}
                    onClick={() => openEditModal(template)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {template.name}
                            {template.is_enabled ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </CardTitle>
                          <CardDescription className="text-sm mt-1">
                            {template.description}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cn("text-xs", colorClass)}>
                          {category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p><strong>Subject:</strong> {template.subject}</p>
                        <p><strong>Variables:</strong> {template.variables?.join(', ') || 'None'}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No email templates found</p>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Edit Email Template
            </DialogTitle>
            <DialogDescription>
              Customize the {selectedTemplate?.name} template. Use {`{{variable_name}}`} for dynamic content.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label className="font-medium">Enable Template</Label>
                  <p className="text-xs text-muted-foreground">
                    Disabled templates will not be sent
                  </p>
                </div>
                <Switch
                  checked={editForm.is_enabled}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_enabled: checked })}
                />
              </div>
              
              {/* Template Name */}
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              
              {/* Subject Line */}
              <div className="space-y-2">
                <Label htmlFor="template-subject">Subject Line</Label>
                <Input
                  id="template-subject"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  placeholder="Email subject with {{variables}}"
                />
              </div>
              
              {/* HTML Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-content">HTML Content</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={previewing}
                  >
                    {previewing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Preview
                  </Button>
                </div>
                <Textarea
                  id="template-content"
                  value={editForm.html_content}
                  onChange={(e) => setEditForm({ ...editForm, html_content: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="<div>Your HTML email content...</div>"
                />
              </div>
              
              {/* Available Variables */}
              {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm font-medium">Available Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge 
                        key={variable} 
                        variant="outline" 
                        className="font-mono text-xs cursor-pointer hover:bg-muted"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${variable}}}`);
                          toast.success(`Copied {{${variable}}} to clipboard`);
                        }}
                      >
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click a variable to copy it
                  </p>
                </div>
              )}
              
              {/* Send Test Email Section */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-sm font-medium text-blue-700">Send Test Email</Label>
                    <p className="text-xs text-blue-600">
                      Send this template with sample data to test it
                    </p>
                  </div>
                  {!showTestEmailInput && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTestEmailInput(true)}
                      className="border-blue-500 text-blue-600 hover:bg-blue-500/10"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Test
                    </Button>
                  )}
                </div>
                
                {showTestEmailInput && (
                  <div className="flex gap-2 mt-3">
                    <Input
                      type="email"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      placeholder="recipient@example.com"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleSendTestEmail}
                      disabled={sendingTest || !testEmailAddress}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {sendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Send'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowTestEmailInput(false);
                        setTestEmailAddress('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting}
                className="text-amber-500 hover:text-amber-600"
              >
                {resetting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reset to Default
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview with sample data
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Subject</Label>
              <p className="font-medium">{previewContent.subject}</p>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 border-b text-sm font-medium">
                Email Body
              </div>
              <iframe
                srcDoc={previewContent.html_content}
                className="w-full h-[400px] bg-white"
                title="Email Preview"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setPreviewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplates;
