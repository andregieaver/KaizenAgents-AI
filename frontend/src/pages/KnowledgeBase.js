import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Search,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileText,
  FolderOpen,
  Tag,
  Clock,
  Link2
} from 'lucide-react';
import DOMPurify from 'dompurify';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Component to render content blocks (simplified version)
const RenderBlock = ({ block }) => {
  if (!block || !block.type) return null;
  
  switch (block.type) {
    case 'hero':
      return (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{block.content?.title}</h1>
          {block.content?.subtitle && (
            <p className="text-muted-foreground">{block.content.subtitle}</p>
          )}
        </div>
      );
    
    case 'text':
      return (
        <div 
          className="prose prose-sm dark:prose-invert max-w-none mb-4"
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(block.content?.text || '') 
          }}
        />
      );
    
    case 'heading':
      const HeadingTag = `h${block.content?.level || 2}`;
      const headingClasses = {
        1: 'text-2xl font-bold mb-4',
        2: 'text-xl font-semibold mb-3',
        3: 'text-lg font-medium mb-2',
        4: 'text-base font-medium mb-2'
      };
      return (
        <HeadingTag className={headingClasses[block.content?.level || 2]}>
          {block.content?.text}
        </HeadingTag>
      );
    
    case 'list':
      const ListTag = block.content?.ordered ? 'ol' : 'ul';
      return (
        <ListTag className={`mb-4 pl-5 space-y-1 ${block.content?.ordered ? 'list-decimal' : 'list-disc'}`}>
          {block.content?.items?.map((item, i) => (
            <li key={i} className="text-sm">{item}</li>
          ))}
        </ListTag>
      );
    
    case 'callout':
      const calloutStyles = {
        info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
        warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
        success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
        error: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
      };
      return (
        <div className={`p-4 rounded-lg border mb-4 ${calloutStyles[block.content?.type || 'info']}`}>
          {block.content?.title && (
            <p className="font-semibold mb-1">{block.content.title}</p>
          )}
          <p className="text-sm">{block.content?.text}</p>
        </div>
      );
    
    case 'image':
      return (
        <figure className="mb-4">
          <img 
            src={block.content?.url} 
            alt={block.content?.alt || ''} 
            className="rounded-lg max-w-full h-auto"
          />
          {block.content?.caption && (
            <figcaption className="text-xs text-muted-foreground mt-2 text-center">
              {block.content.caption}
            </figcaption>
          )}
        </figure>
      );
    
    case 'video':
      return (
        <div className="mb-4 aspect-video">
          <iframe
            src={block.content?.url}
            title={block.content?.title || 'Video'}
            className="w-full h-full rounded-lg"
            allowFullScreen
          />
        </div>
      );
    
    case 'code':
      return (
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">
          <code className="text-sm">{block.content?.code}</code>
        </pre>
      );
    
    case 'divider':
      return <hr className="my-6 border-border" />;
    
    case 'steps':
      return (
        <div className="mb-6 space-y-4">
          {block.content?.steps?.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                {i + 1}
              </div>
              <div className="flex-1 pt-1">
                <h4 className="font-medium mb-1">{step.title}</h4>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      );
    
    default:
      return null;
  }
};

// Article Card Component
const ArticleCard = ({ article, onClick }) => (
  <Card 
    className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
    onClick={onClick}
  >
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="text-base font-semibold line-clamp-2">
          {article.name}
        </CardTitle>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
      {article.category && (
        <Badge variant="outline" className="w-fit text-xs">
          {article.category}
        </Badge>
      )}
    </CardHeader>
    <CardContent className="pt-0">
      <p className="text-sm text-muted-foreground line-clamp-2">
        {article.seo?.description || 'No description available'}
      </p>
      {article.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {article.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

// Main Knowledge Base Component
const KnowledgeBase = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const articleSlug = searchParams.get('article');

  useEffect(() => {
    fetchCategories();
    if (articleSlug) {
      fetchArticle(articleSlug);
    } else {
      fetchArticles();
    }
  }, [token, articleSlug]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/admin/pages/knowledge-base/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchArticles = async (category = null) => {
    setLoading(true);
    try {
      let url = `${API}/admin/pages/knowledge-base/articles`;
      const params = new URLSearchParams();
      
      if (category && category !== 'all') {
        params.append('category', category);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArticles(response.data || []);
      setSelectedArticle(null);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticle = async (slug) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/pages/knowledge-base/article/${slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedArticle(response.data);
    } catch (error) {
      console.error('Failed to fetch article:', error);
      setSelectedArticle(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    fetchArticles(category);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchArticles(activeCategory);
  };

  const handleArticleClick = (article) => {
    setSearchParams({ article: article.slug });
  };

  const handleBack = () => {
    setSearchParams({});
    setSelectedArticle(null);
    fetchArticles(activeCategory);
  };

  const handleRelatedClick = (slug) => {
    setSearchParams({ article: slug });
  };

  // Loading state
  if (loading && !selectedArticle && articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 p-4 lg:p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Article View
  if (selectedArticle) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documentation
        </Button>

        {/* Article Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              {selectedArticle.category && (
                <>
                  <Badge variant="outline">{selectedArticle.category}</Badge>
                  <span>•</span>
                </>
              )}
              {selectedArticle.updated_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Updated {new Date(selectedArticle.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <CardTitle className="text-2xl">{selectedArticle.name}</CardTitle>
            {selectedArticle.seo?.description && (
              <CardDescription className="text-base">
                {selectedArticle.seo.description}
              </CardDescription>
            )}
            {selectedArticle.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedArticle.tags.map(tag => (
                  <Badge key={tag} variant="secondary">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Render content blocks */}
            {selectedArticle.blocks?.length > 0 ? (
              <div className="space-y-2">
                {selectedArticle.blocks.map((block, index) => (
                  <RenderBlock key={index} block={block} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No content available.</p>
            )}
          </CardContent>
        </Card>

        {/* Related Articles */}
        {selectedArticle.related?.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Related Articles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedArticle.related.map(article => (
                  <div
                    key={article.slug}
                    className="p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-all"
                    onClick={() => handleRelatedClick(article.slug)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{article.name}</p>
                        {article.category && (
                          <p className="text-xs text-muted-foreground">{article.category}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Articles List View
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
          Documentation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find articles and guides to help you get the most out of the platform
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" size="sm" className="sm:size-default">
          <Search className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      {/* Categories */}
      {categories.length > 0 && (
        <Tabs value={activeCategory} onValueChange={handleCategoryChange}>
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
            <TabsTrigger value="all" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              All
            </TabsTrigger>
            {categories.map(cat => (
              <TabsTrigger key={cat.name} value={cat.name} className="gap-2">
                {cat.name}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {cat.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Articles Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map(article => (
            <ArticleCard
              key={article.slug}
              article={article}
              onClick={() => handleArticleClick(article)}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No articles found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? 'Try a different search term or browse all categories'
                : 'Knowledge base articles will appear here once created'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KnowledgeBase;
