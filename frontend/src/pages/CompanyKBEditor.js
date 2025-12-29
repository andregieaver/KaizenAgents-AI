import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Bot,
  Eye,
  EyeOff,
  Folder,
  Tag,
  Plus,
  X,
  Layers
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import ContentBlocks from '../components/ContentBlocks';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompanyKBEditor = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isEditMode = !!slug;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    content: '',
    blocks: [],
    category: '',
    tags: [],
    folder_path: '/',
    available_for_agents: false,
    visible: true,
    seo: {
      title: '',
      description: ''
    }
  });

  const fetchArticle = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/company-kb/article/${slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const article = response.data;
      setFormData({
        name: article.name,
        slug: article.slug,
        content: article.content || '',
        blocks: article.blocks || [],
        category: article.category || '',
        tags: article.tags || [],
        folder_path: article.folder_path || '/',
        available_for_agents: article.available_for_agents || false,
        visible: article.visible !== false,
        seo: {
          title: article.seo?.title || '',
          description: article.seo?.description || ''
        }
      });
    } catch (error) {
      toast.error('Failed to load article');
      navigate('/dashboard/knowledge-base');
    } finally {
      setLoading(false);
    }
  }, [slug, token, navigate]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [foldersRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/company-kb/folders`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/company-kb/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setFolders(foldersRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchMetadata();
    if (isEditMode) {
      fetchArticle();
    }
  }, [isEditMode, fetchArticle, fetchMetadata]);

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: !isEditMode ? generateSlug(name) : prev.slug
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter an article name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        content: formData.content,
        blocks: formData.blocks,
        category: formData.category,
        tags: formData.tags,
        folder_path: formData.folder_path,
        available_for_agents: formData.available_for_agents,
        visible: formData.visible,
        seo: formData.seo
      };

      if (isEditMode) {
        await axios.put(`${API}/company-kb/articles/${slug}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Article updated successfully');
      } else {
        await axios.post(`${API}/company-kb/articles`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Article created successfully');
      }
      
      navigate('/dashboard/knowledge-base');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/knowledge-base')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? 'Edit Article' : 'Create Article'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Update your knowledge base article' : 'Add a new article to your knowledge base'}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Article'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Article Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Article Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., How to get started"
                  value={formData.name}
                  onChange={handleNameChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  placeholder="how-to-get-started"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  This will be used in the article URL
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Content Blocks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Article Content
              </CardTitle>
              <CardDescription>
                Build your article with draggable content blocks including text, images, videos, and code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentBlocks
                blocks={formData.blocks}
                onChange={(blocks) => setFormData(prev => ({ ...prev, blocks }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Publish Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Visible
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show this article to users
                  </p>
                </div>
                <Switch
                  checked={formData.visible}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, visible: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Available for Agents
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    AI agents can search and reference this article
                  </p>
                </div>
                <Switch
                  checked={formData.available_for_agents}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available_for_agents: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Organization */}
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Folder
                </Label>
                <Select
                  value={formData.folder_path}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, folder_path: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/">Root</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.path}>
                        {folder.path.replace(/\//g, ' / ').trim() || folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Getting Started"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                  />
                  <Button variant="secondary" onClick={handleAddTag} type="button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>
                Optimize for search within your knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>SEO Title</Label>
                <Input
                  placeholder="Article title for search"
                  value={formData.seo.title}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    seo: { ...prev.seo, title: e.target.value }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  placeholder="Brief description of the article"
                  value={formData.seo.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    seo: { ...prev.seo, description: e.target.value }
                  }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompanyKBEditor;
