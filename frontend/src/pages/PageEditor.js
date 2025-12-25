import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Globe,
  Image as ImageIcon,
  Twitter,
  Upload,
  Layers,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import ContentBlocks from '../components/ContentBlocks';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PageEditor = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isEditMode = !!slug;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    path: '',
    content: '',
    blocks: [],
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

  useEffect(() => {
    if (isEditMode) {
      fetchPage();
    }
  }, [slug]);

  const fetchPage = async () => {
    try {
      const response = await axios.get(`${API}/admin/pages/${slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const page = response.data;
      setFormData({
        name: page.name,
        slug: page.slug,
        path: page.path,
        content: page.content || '',
        blocks: page.blocks || [],
        visible: page.visible,
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
    } catch {
      toast.error('Failed to load page');
      navigate('/dashboard/admin/pages');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name) => {
    setFormData({
      ...formData,
      name: name,
      slug: isEditMode ? formData.slug : generateSlug(name),
      path: isEditMode ? formData.path : `/${generateSlug(name)}`
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Page name is required');
      return;
    }

    if (!formData.slug.trim()) {
      toast.error('Slug is required');
      return;
    }

    if (!formData.path.trim()) {
      toast.error('Path is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        path: formData.path,
        content: formData.content,
        blocks: formData.blocks,
        visible: formData.visible,
        seo: formData.seo
      };

      if (isEditMode) {
        await axios.put(
          `${API}/admin/pages/${slug}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Page updated successfully');
      } else {
        await axios.post(
          `${API}/admin/pages`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Page created successfully');
      }
      navigate('/dashboard/admin/pages');
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(
        `${API}/admin/pages/upload-og-image/${formData.slug || 'new'}`,
        formDataUpload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

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
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleExport = async () => {
    if (!isEditMode) {
      toast.error('Save the page first before exporting');
      return;
    }

    setExporting(true);
    try {
      const response = await axios.get(`${API}/admin/pages/${slug}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const template = response.data;
      const dataStr = JSON.stringify(template, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-template.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Template exported successfully');
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to export template');
    } finally {
      setExporting(false);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin/pages')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight">
              {isEditMode ? 'Edit Page' : 'Create New Page'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? `Editing: ${formData.name}` : 'Create a new custom page with content and SEO settings'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEditMode && (
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Template
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/dashboard/admin/pages')}>
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
                Save Page
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Page Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Page Details
              </CardTitle>
              <CardDescription>Basic information about your page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Page Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="About Us"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="about-us"
                    disabled={isEditMode}
                  />
                </div>
                <div>
                  <Label htmlFor="path">Path *</Label>
                  <Input
                    id="path"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="/about-us"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Page Visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    Control whether this page is publicly accessible
                  </p>
                </div>
                <Switch
                  checked={formData.visible}
                  onCheckedChange={(checked) => setFormData({ ...formData, visible: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Page Content Blocks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Page Content
              </CardTitle>
              <CardDescription>
                Build your page with draggable content blocks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentBlocks
                blocks={formData.blocks}
                onChange={(blocks) => setFormData({ ...formData, blocks })}
              />
            </CardContent>
          </Card>
        </div>

        {/* SEO Settings - Right Sidebar */}
        <div className="space-y-6">
          {/* Basic SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seo-title">SEO Title</Label>
                <Input
                  id="seo-title"
                  value={formData.seo.title}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, title: e.target.value }
                  })}
                  placeholder="Page title"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.seo.title.length}/60
                </p>
              </div>

              <div>
                <Label htmlFor="seo-description">Meta Description</Label>
                <Textarea
                  id="seo-description"
                  value={formData.seo.description}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, description: e.target.value }
                  })}
                  placeholder="Brief description"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.seo.description.length}/160
                </p>
              </div>

              <div>
                <Label htmlFor="seo-keywords">Keywords</Label>
                <Input
                  id="seo-keywords"
                  value={formData.seo.keywords}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo: { ...formData.seo, keywords: e.target.value }
                  })}
                  placeholder="keyword1, keyword2"
                />
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
              </div>
            </CardContent>
          </Card>

          {/* Robots Directives */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Search Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Indexable</Label>
                <Switch
                  checked={formData.seo.robots.index}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      robots: { ...formData.seo.robots, index: checked }
                    }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Follow Links</Label>
                <Switch
                  checked={formData.seo.robots.follow}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      robots: { ...formData.seo.robots, follow: checked }
                    }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">No Archive</Label>
                <Switch
                  checked={formData.seo.robots.noarchive}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      robots: { ...formData.seo.robots, noarchive: checked }
                    }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">No Snippet</Label>
                <Switch
                  checked={formData.seo.robots.nosnippet}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      robots: { ...formData.seo.robots, nosnippet: checked }
                    }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">No Image Index</Label>
                <Switch
                  checked={formData.seo.robots.noimageindex}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    seo: {
                      ...formData.seo,
                      robots: { ...formData.seo.robots, noimageindex: checked }
                    }
                  })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Open Graph */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Open Graph
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  placeholder="Social media title"
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
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="og-image">OG Image</Label>
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
                    placeholder="Image URL"
                    className="flex-1"
                  />
                  <label htmlFor="og-image-upload">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
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
                {formData.seo.og.image && (
                  <img
                    src={formData.seo.og.image}
                    alt="OG preview"
                    className="w-full h-24 object-cover rounded mt-2"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Twitter Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                Twitter Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <option value="summary_large_image">Summary Large Image</option>
                  <option value="app">App</option>
                  <option value="player">Player</option>
                </select>
              </div>

              <div>
                <Label htmlFor="twitter-site">Site Handle</Label>
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
              </div>

              <div>
                <Label htmlFor="twitter-creator">Creator</Label>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PageEditor;
