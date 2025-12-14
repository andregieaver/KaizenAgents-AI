import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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
  Plus,
  Trash2,
  Calendar,
  User,
  Loader2,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPagesList = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(null);

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

  const handleImport = async (slug, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please upload a JSON template file');
      return;
    }

    setImporting(slug);
    try {
      const fileContent = await file.text();
      const template = JSON.parse(fileContent);

      if (!template.blocks) {
        toast.error('Invalid template file: missing blocks');
        return;
      }

      const response = await axios.post(
        `${API}/admin/pages/${slug}/import`,
        template,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPages(pages.map(p => p.slug === slug ? response.data : p));
      toast.success('Template imported successfully');
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON file');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to import template');
      }
    } finally {
      setImporting(null);
      event.target.value = '';
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
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">
            Pages Management
          </h1>
          <p className="text-muted-foreground">
            Manage SEO and visibility for all public pages. Export pages as templates and import them to other pages.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/admin/pages/create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Page
        </Button>
      </div>

      {/* Pages Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Page</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>SEO Title</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[150px]">Updated</TableHead>
              <TableHead className="w-[200px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pages found</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/dashboard/admin/pages/create')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Page
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              pages.map((page) => (
                <TableRow key={page.slug}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{page.name}</span>
                          {!page.is_system_page && (
                            <Badge variant="outline" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </div>
                        {page.content && (
                          <p className="text-xs text-muted-foreground">
                            {page.content.length} chars
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-mono">{page.path}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground line-clamp-1">
                      {page.seo?.title || 'Not set'}
                    </span>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    {page.updated_at && (
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(page.updated_at).toLocaleDateString()}
                        </div>
                        {page.updated_by && (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" />
                            {page.updated_by}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/admin/pages/edit/${page.slug}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      
                      <label htmlFor={`import-${page.slug}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={importing === page.slug}
                          asChild
                        >
                          <span>
                            {importing === page.slug ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </span>
                        </Button>
                      </label>
                      <input
                        id={`import-${page.slug}`}
                        type="file"
                        accept=".json"
                        onChange={(e) => handleImport(page.slug, e)}
                        className="hidden"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
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
                            <Button variant="ghost" size="icon">
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
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminPagesList;
