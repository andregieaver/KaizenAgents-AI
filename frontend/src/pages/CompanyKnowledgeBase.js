import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import {
  BookOpen,
  Search,
  Plus,
  Folder,
  FileText,
  ChevronRight,
  Edit,
  Trash2,
  Bot,
  Eye,
  EyeOff,
  FolderPlus,
  MoreVertical,
  ArrowLeft,
  Tag,
  Clock,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompanyKnowledgeBase = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  
  const [articles, setArticles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentFolder, setCurrentFolder] = useState('/');
  const [selectedArticle, setSelectedArticle] = useState(null);
  
  // Folder creation dialog
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const canManage = user?.role === 'super_admin' || user?.role === 'admin' || 
                    user?.role === 'owner' || user?.is_super_admin ||
                    user?.permissions?.includes('manage_knowledge_base');

  const fetchData = useCallback(async () => {
    try {
      const [articlesRes, foldersRes, categoriesRes, statsRes] = await Promise.all([
        axios.get(`${API}/company-kb/articles`, {
          params: {
            folder: currentFolder !== '/' ? currentFolder : undefined,
            category: selectedCategory || undefined,
            search: searchQuery || undefined
          },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/company-kb/folders`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/company-kb/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/company-kb/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setArticles(articlesRes.data);
      setFolders(foldersRes.data);
      setCategories(categoriesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch KB data:', error);
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, [token, currentFolder, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check for article view from URL
  useEffect(() => {
    const articleSlug = searchParams.get('article');
    if (articleSlug && articles.length > 0) {
      const article = articles.find(a => a.slug === articleSlug);
      if (article) {
        setSelectedArticle(article);
      }
    }
  }, [searchParams, articles]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      await axios.post(`${API}/company-kb/folders`, {
        name: newFolderName,
        parent_path: currentFolder
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Folder created');
      setShowFolderDialog(false);
      setNewFolderName('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setDeleting(true);
    try {
      if (deleteTarget.type === 'folder') {
        await axios.delete(`${API}/company-kb/folders/${deleteTarget.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Folder deleted');
      } else {
        await axios.delete(`${API}/company-kb/articles/${deleteTarget.slug}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Article deleted');
      }
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const navigateToFolder = (path) => {
    setCurrentFolder(path);
    setSelectedArticle(null);
    setSearchParams({});
  };

  const viewArticle = (article) => {
    setSelectedArticle(article);
    setSearchParams({ article: article.slug });
  };

  const closeArticle = () => {
    setSelectedArticle(null);
    setSearchParams({});
  };

  // Get current folder's subfolders
  const currentFolders = folders.filter(f => f.parent_path === currentFolder);
  
  // Get current folder's articles
  const currentArticles = articles.filter(a => {
    const articleFolder = a.folder_path || '/';
    return articleFolder === currentFolder;
  });

  // Breadcrumb navigation
  const getBreadcrumbs = () => {
    if (currentFolder === '/') return [{ name: 'Root', path: '/' }];
    
    const parts = currentFolder.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '/' }];
    
    let currentPath = '';
    parts.forEach(part => {
      currentPath += `/${part}`;
      const folder = folders.find(f => f.path === currentPath);
      breadcrumbs.push({
        name: folder?.name || part,
        path: currentPath
      });
    });
    
    return breadcrumbs;
  };

  // Render article content
  const renderBlockContent = (block) => {
    switch (block.type) {
      case 'text':
        return (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
          />
        );
      case 'heading':
        const HeadingTag = `h${block.content?.level || 2}`;
        return (
          <HeadingTag className="font-bold text-foreground">
            {block.content?.text}
          </HeadingTag>
        );
      case 'image':
        return (
          <figure className="my-4">
            <img 
              src={block.content?.url} 
              alt={block.content?.alt || ''} 
              className="rounded-lg max-w-full"
            />
            {block.content?.caption && (
              <figcaption className="text-sm text-muted-foreground mt-2 text-center">
                {block.content.caption}
              </figcaption>
            )}
          </figure>
        );
      case 'video':
        return (
          <div className="aspect-video my-4">
            <iframe
              src={block.content?.embedUrl || block.content?.url}
              className="w-full h-full rounded-lg"
              allowFullScreen
              title="Video"
            />
          </div>
        );
      case 'code':
        return (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
            <code className={`language-${block.content?.language || 'plaintext'}`}>
              {block.content?.code}
            </code>
          </pre>
        );
      case 'list':
        const ListTag = block.content?.ordered ? 'ol' : 'ul';
        return (
          <ListTag className={`my-4 pl-6 ${block.content?.ordered ? 'list-decimal' : 'list-disc'}`}>
            {block.content?.items?.map((item, idx) => (
              <li key={idx} className="mb-1">{item}</li>
            ))}
          </ListTag>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Article detail view
  if (selectedArticle) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Button variant="ghost" onClick={closeArticle} className="gap-2 -ml-2 sm:ml-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm sm:text-base">Back</span>
        </Button>

        <div className="max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">{selectedArticle.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                {selectedArticle.category && (
                  <Badge variant="secondary" className="text-xs">{selectedArticle.category}</Badge>
                )}
                {selectedArticle.available_for_agents && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Bot className="h-3 w-3" />
                    <span className="hidden sm:inline">Available for</span> Agents
                  </Badge>
                )}
                {selectedArticle.updated_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(selectedArticle.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {canManage && (
              <Button 
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => navigate(`/dashboard/knowledge-base/edit/${selectedArticle.slug}`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Article
              </Button>
            )}
          </div>

          {selectedArticle.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
              {selectedArticle.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="gap-1 text-xs">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-4 sm:pt-6">
              {selectedArticle.blocks?.length > 0 ? (
                <div className="space-y-4">
                  {selectedArticle.blocks.map((block, idx) => (
                    <div key={block.id || idx}>
                      {renderBlockContent(block)}
                    </div>
                  ))}
                </div>
              ) : selectedArticle.content ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                />
              ) : (
                <p className="text-muted-foreground">No content available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal documentation and support articles
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowFolderDialog(true)}>
              <FolderPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
            <Button size="sm" className="sm:size-default" onClick={() => navigate('/dashboard/knowledge-base/create')}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Article</span>
            </Button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="sm:size-default">
            <Search className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </form>
        
        {categories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="sm:size-default gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4" />
                <span className="truncate">{selectedCategory || 'All Categories'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedCategory('')}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map(cat => (
                <DropdownMenuItem 
                  key={cat.name} 
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  {cat.name} ({cat.count})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Folder Navigation - Only show when not at root */}
      {currentFolder !== '/' && (
        <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <div key={crumb.path} className="flex items-center whitespace-nowrap">
              <button
                onClick={() => navigateToFolder(crumb.path)}
                className={`hover:text-primary ${
                  idx === arr.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {crumb.name}
              </button>
              {idx < arr.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="space-y-3 sm:space-y-4">
        {/* Folders */}
        {currentFolders.length > 0 && (
          <div className="grid gap-2">
            {currentFolders.map(folder => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigateToFolder(folder.path)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Folder className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{folder.name}</p>
                    {folder.description && (
                      <p className="text-sm text-muted-foreground truncate">{folder.description}</p>
                    )}
                  </div>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Articles */}
        {currentArticles.length > 0 ? (
          <div className="grid gap-2 sm:gap-3">
            {currentArticles.map(article => (
              <Card 
                key={article.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => viewArticle(article)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                          <h3 className="font-medium text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{article.name}</h3>
                          {!article.visible && (
                            <Badge variant="outline" className="text-amber-600 text-xs">
                              <EyeOff className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">Draft</span>
                            </Badge>
                          )}
                          {article.available_for_agents && (
                            <Badge variant="outline" className="text-green-600 text-xs">
                              <Bot className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">Agent</span>
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                          {article.category && (
                            <Badge variant="secondary" className="text-xs">
                              {article.category}
                            </Badge>
                          )}
                          <span className="hidden sm:flex items-center gap-1">
                            {article.tags?.slice(0, 3).map((tag, idx) => (
                              <span key={idx}>#{tag}</span>
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/knowledge-base/edit/${article.slug}`);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: 'article', slug: article.slug, name: article.name });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : currentFolders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
              <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2 text-center">No articles yet</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {searchQuery 
                  ? 'No articles match your search.'
                  : 'Create your first knowledge base article.'}
              </p>
              {canManage && !searchQuery && (
                <Button size="sm" onClick={() => navigate('/dashboard/knowledge-base/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Article
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Organize your knowledge base with folders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                placeholder="e.g., Getting Started"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Creating in: {currentFolder === '/' ? 'Root' : currentFolder}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
              {creatingFolder ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type === 'folder' ? 'Folder' : 'Article'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? 
              {deleteTarget?.type === 'folder' && ' Articles inside will be moved to the root folder.'}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyKnowledgeBase;
