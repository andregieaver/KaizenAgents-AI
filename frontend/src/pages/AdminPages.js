import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  FileText,
  Edit,
  Eye,
  EyeOff,
  RotateCcw,
  ExternalLink,
  Search,
  Image as ImageIcon,
  Hash,
  Calendar,
  User,
  Loader2,
  Upload,
  Link as LinkIcon,
  Twitter,
  Globe,
  Plus,
  Trash2,
  FileCode
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPages = () => {
  const { token } = useAuth();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    visible: true,
    seo: {
      title: '',
      description: '',
      keywords: '',
      canonical_url: '',
      og: {
        title: '',
        description: '',
        image: '',
        url: ''
      },
      twitter: {
        card: 'summary_large_image',
        site: '',
        creator: ''
      },
      robots: {
        index: true,
        follow: true,
        noarchive: false,
        nosnippet: false,
        noimageindex: false
      }
    }
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    path: '',
    content: ''
  });

  useEffect(() => {
    fetchPages();
  }, [token]);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPages(response.data);
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (page) => {
    setSelectedPage(page);
    setFormData({
      visible: page.visible,
      content: page.content || '',
      seo: {
        title: page.seo?.title || '',
        description: page.seo?.description || '',
        keywords: page.seo?.keywords || '',
        canonical_url: page.seo?.canonical_url || page.path,
        og: {
          title: page.seo?.og?.title || '',
          description: page.seo?.og?.description || '',
          image: page.seo?.og?.image || '',
          url: page.seo?.og?.url || page.path
        },
        twitter: {
          card: page.seo?.twitter?.card || 'summary_large_image',
          site: page.seo?.twitter?.site || '',
          creator: page.seo?.twitter?.creator || ''
        },
        robots: {
          index: page.seo?.robots?.index !== false,
          follow: page.seo?.robots?.follow !== false,
          noarchive: page.seo?.robots?.noarchive || false,
          nosnippet: page.seo?.robots?.nosnippet || false,
          noimageindex: page.seo?.robots?.noimageindex || false
        }
      }
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await axios.put(
        `${API}/admin/pages/${selectedPage.slug}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPages(pages.map(p => p.slug === selectedPage.slug ? response.data : p));
      toast.success('Page updated successfully');
      setEditModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update page');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (slug) => {
    try {
      const response = await axios.post(
        `${API}/admin/pages/reset/${slug}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPages(pages.map(p => p.slug === slug ? response.data : p));
      toast.success('Page reset to defaults');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset page');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(
        `${API}/admin/pages/upload-og-image/${selectedPage.slug}`,
        formDataUpload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Update form data with new image URL
      const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
      setFormData({
        ...formData,
        seo: {
          ...formData.seo,
          og: {
            ...formData.seo.og,
            image: fullUrl
          }
        }
      });

      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreatePage = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim() || !createForm.path.trim()) {
      toast.error('Name, slug, and path are required');
      return;
    }

    setCreatingPage(true);
    try {
      const response = await axios.post(
        `${API}/admin/pages`,
        createForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPages([response.data, ...pages]);
      toast.success('Page created successfully');
      setCreateModalOpen(false);
      setCreateForm({ name: '', slug: '', path: '', content: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create page');
    } finally {
      setCreatingPage(false);
    }
  };

  const handleDeletePage = async (slug, isSystemPage) => {
    if (isSystemPage) {
      toast.error('Cannot delete system pages');
      return;
    }

    try {
      await axios.delete(`${API}/admin/pages/${slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPages(pages.filter(p => p.slug !== slug));
      toast.success('Page deleted successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete page');
    }
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const toggleVisibility = async (page) => {
    try {
      const response = await axios.put(
        `${API}/admin/pages/${page.slug}`,
        { visible: !page.visible },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPages(pages.map(p => p.slug === page.slug ? response.data : p));
      toast.success(`Page ${!page.visible ? 'shown' : 'hidden'}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to toggle visibility');
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[400px] bg-muted rounded-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 page-transition">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">
            Pages Management
          </h1>
          <p className="text-muted-foreground">
            Manage SEO and visibility for all public pages
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Page
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {pages.map((page) => (
          <Card key={page.slug} className="border border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{page.name}</CardTitle>
                    <Badge variant={page.visible ? 'default' : 'secondary'}>
                      {page.visible ? (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </>
                      )}
                    </Badge>
                    {!page.is_system_page && (
                      <Badge variant="outline" className="text-xs">
                        Custom
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <ExternalLink className="h-3 w-3" />
                    {page.path}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SEO Summary */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">SEO Title</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {page.seo?.title || 'Not set'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Search className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Meta Description</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {page.seo?.description || 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">OG Image</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {page.seo?.og?.image || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Last Updated */}
              {page.updated_at && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(page.updated_at).toLocaleDateString()}
                    </div>
                    {page.updated_by && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {page.updated_by}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditModal(page)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleVisibility(page)}
                >
                  {page.visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                {page.is_system_page ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reset all SEO settings for "{page.name}" to their default values.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleReset(page.slug)}>
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete page?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{page.name}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeletePage(page.slug, page.is_system_page)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit SEO Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit SEO Settings</DialogTitle>
            <DialogDescription>
              Update SEO and Open Graph settings for {selectedPage?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base">Page Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  Control whether this page is publicly accessible
                </p>
              </div>
              <Switch
                checked={formData.visible}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, visible: checked })
                }
              />
            </div>

            {/* Page Content - Only for custom pages */}
            {selectedPage && !selectedPage.is_system_page && (
              <div className="space-y-4 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileCode className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Page Content</h3>
                  </div>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter page content (supports HTML)"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    HTML content for this page
                  </p>
                </div>
              </div>
            )}

            {/* Basic SEO */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="seo-title">SEO Title *</Label>
                <Input
                  id="seo-title"
                  value={formData.seo.title}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, title: e.target.value }
                  })}
                  placeholder="Page title for search engines"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.seo.title.length}/60 characters (optimal: 50-60)
                </p>
              </div>

              <div>
                <Label htmlFor="seo-description">Meta Description *</Label>
                <Textarea
                  id="seo-description"
                  value={formData.seo.description}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, description: e.target.value }
                  })}
                  placeholder="Brief description for search engine results"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.seo.description.length}/160 characters (optimal: 150-160)
                </p>
              </div>

              <div>
                <Label htmlFor="seo-keywords">Meta Keywords</Label>
                <Input
                  id="seo-keywords"
                  value={formData.seo.keywords}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, keywords: e.target.value }
                  })}
                  placeholder="keyword1, keyword2, keyword3"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated keywords (optional)
                </p>
              </div>

              <div>
                <Label htmlFor="canonical-url">Canonical URL</Label>
                <Input
                  id="canonical-url"
                  value={formData.seo.canonical_url}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, canonical_url: e.target.value }
                  })}
                  placeholder="/your-page"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preferred URL for this page (prevents duplicate content issues)
                </p>
              </div>
            </div>

            {/* Robots Meta Tags */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Search Engine Directives
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Control how search engines crawl and index this page
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Indexable</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow search engines to index
                    </p>
                  </div>
                  <Switch
                    checked={formData.seo.robots.index}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        seo: {
                          ...formData.seo,
                          robots: { ...formData.seo.robots, index: checked }
                        }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Follow Links</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow following links
                    </p>
                  </div>
                  <Switch
                    checked={formData.seo.robots.follow}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        seo: {
                          ...formData.seo,
                          robots: { ...formData.seo.robots, follow: checked }
                        }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm">No Archive</Label>
                    <p className="text-xs text-muted-foreground">
                      Prevent cached copies
                    </p>
                  </div>
                  <Switch
                    checked={formData.seo.robots.noarchive}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        seo: {
                          ...formData.seo,
                          robots: { ...formData.seo.robots, noarchive: checked }
                        }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm">No Snippet</Label>
                    <p className="text-xs text-muted-foreground">
                      Prevent description snippet
                    </p>
                  </div>
                  <Switch
                    checked={formData.seo.robots.nosnippet}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        seo: {
                          ...formData.seo,
                          robots: { ...formData.seo.robots, nosnippet: checked }
                        }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg col-span-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">No Image Index</Label>
                    <p className="text-xs text-muted-foreground">
                      Prevent images from being indexed
                    </p>
                  </div>
                  <Switch
                    checked={formData.seo.robots.noimageindex}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        seo: {
                          ...formData.seo,
                          robots: { ...formData.seo.robots, noimageindex: checked }
                        }
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Open Graph */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <h3 className="text-sm font-semibold mb-3">Open Graph Settings</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Controls how your page appears when shared on social media
                </p>
              </div>

              <div>
                <Label htmlFor="og-title">OG Title</Label>
                <Input
                  id="og-title"
                  value={formData.seo.og.title}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      og: { ...formData.seo.og, title: e.target.value }
                    }
                  })}
                  placeholder="Title for social media shares"
                />
              </div>

              <div>
                <Label htmlFor="og-description">OG Description</Label>
                <Textarea
                  id="og-description"
                  value={formData.seo.og.description}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      og: { ...formData.seo.og, description: e.target.value }
                    }
                  })}
                  placeholder="Description for social media shares"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="og-image">OG Image</Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      id="og-image"
                      value={formData.seo.og.image}
                      onChange={(e) => setFormData({
                        ...formData,
                        seo: {
                          ...formData.seo,
                          og: { ...formData.seo.og, image: e.target.value }
                        }
                      })}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1"
                    />
                    <label htmlFor="og-image-upload">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingImage}
                        asChild
                      >
                        <span>
                          {uploadingImage ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </span>
                      </Button>
                    </label>
                    <input
                      id="og-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended size: 1200×630 pixels (max 5MB)
                  </p>
                </div>
              </div>

              {formData.seo.og.image && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium mb-2">Image Preview:</p>
                  <img
                    src={formData.seo.og.image}
                    alt="OG preview"
                    className="w-full h-32 object-cover rounded"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Twitter Card */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter Card Settings
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Optimize how your page appears on Twitter/X
                </p>
              </div>

              <div>
                <Label htmlFor="twitter-card">Card Type</Label>
                <select
                  id="twitter-card"
                  value={formData.seo.twitter.card}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      twitter: { ...formData.seo.twitter, card: e.target.value }
                    }
                  })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="summary">Summary</option>
                  <option value="summary_large_image">Summary with Large Image</option>
                  <option value="app">App</option>
                  <option value="player">Player</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose how content is displayed in Twitter cards
                </p>
              </div>

              <div>
                <Label htmlFor="twitter-site">Twitter Site Handle</Label>
                <Input
                  id="twitter-site"
                  value={formData.seo.twitter.site}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      twitter: { ...formData.seo.twitter, site: e.target.value }
                    }
                  })}
                  placeholder="@yoursite"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your website's Twitter/X handle (optional)
                </p>
              </div>

              <div>
                <Label htmlFor="twitter-creator">Creator Handle</Label>
                <Input
                  id="twitter-creator"
                  value={formData.seo.twitter.creator}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      twitter: { ...formData.seo.twitter, creator: e.target.value }
                    }
                  })}
                  placeholder="@creator"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Content creator's Twitter/X handle (optional)
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
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
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Page Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Create New Page</DialogTitle>
            <DialogDescription>
              Create a custom page with content and SEO settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Page Name *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setCreateForm({
                    ...createForm,
                    name: name,
                    slug: generateSlug(name),
                    path: `/${generateSlug(name)}`
                  });
                }}
                placeholder="About Us"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Display name for the page
              </p>
            </div>

            <div>
              <Label htmlFor="create-slug">Slug *</Label>
              <Input
                id="create-slug"
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder="about-us"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>

            <div>
              <Label htmlFor="create-path">Path *</Label>
              <Input
                id="create-path"
                value={createForm.path}
                onChange={(e) => setCreateForm({ ...createForm, path: e.target.value })}
                placeholder="/about-us"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL path where the page will be accessible
              </p>
            </div>

            <div>
              <Label htmlFor="create-content">Page Content</Label>
              <Textarea
                id="create-content"
                value={createForm.content}
                onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                placeholder="<h1>About Us</h1><p>Your content here...</p>"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTML content for the page (optional - can be edited later)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={creatingPage}>
              {creatingPage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Page
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPages;
