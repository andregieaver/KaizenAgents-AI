import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import { Button } from '../components/ui/button';
import { Home, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPage();
  }, [slug]);

  const fetchPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/admin/pages/public/${slug}`);
      setPage(response.data);
    } catch (error) {
      console.error('Error fetching page:', error);
      setError(error.response?.status === 404 ? 'Page not found' : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/')}>
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Generate robots meta tag
  const robotsContent = page?.seo?.robots 
    ? [
        page.seo.robots.index ? 'index' : 'noindex',
        page.seo.robots.follow ? 'follow' : 'nofollow',
        page.seo.robots.noarchive ? 'noarchive' : '',
        page.seo.robots.nosnippet ? 'nosnippet' : '',
        page.seo.robots.noimageindex ? 'noimageindex' : ''
      ].filter(Boolean).join(', ')
    : 'index, follow';

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{page?.seo?.title || page?.name}</title>
        {page?.seo?.description && (
          <meta name="description" content={page.seo.description} />
        )}
        {page?.seo?.keywords && (
          <meta name="keywords" content={page.seo.keywords} />
        )}
        {page?.seo?.canonical_url && (
          <link rel="canonical" href={page.seo.canonical_url} />
        )}
        <meta name="robots" content={robotsContent} />

        {/* Open Graph Tags */}
        {page?.seo?.og?.title && (
          <meta property="og:title" content={page.seo.og.title} />
        )}
        {page?.seo?.og?.description && (
          <meta property="og:description" content={page.seo.og.description} />
        )}
        {page?.seo?.og?.image && (
          <meta property="og:image" content={page.seo.og.image} />
        )}
        {page?.seo?.og?.url && (
          <meta property="og:url" content={page.seo.og.url} />
        )}
        <meta property="og:type" content="website" />

        {/* Twitter Card Tags */}
        {page?.seo?.twitter?.card && (
          <meta name="twitter:card" content={page.seo.twitter.card} />
        )}
        {page?.seo?.twitter?.site && (
          <meta name="twitter:site" content={page.seo.twitter.site} />
        )}
        {page?.seo?.twitter?.creator && (
          <meta name="twitter:creator" content={page.seo.twitter.creator} />
        )}
      </Helmet>

      {/* Page Content */}
      <div className="min-h-screen bg-background">
        {/* Simple Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <h1 className="font-heading text-xl font-bold">{page?.name}</h1>
            <div className="w-20" />
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          {page?.blocks && page.blocks.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {page.blocks
                .sort((a, b) => a.order - b.order)
                .map((block) => {
                  switch (block.type) {
                    case 'text':
                      return (
                        <article
                          key={block.id}
                          className="prose prose-slate dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
                        />
                      );
                    default:
                      return null;
                  }
                })}
            </div>
          ) : (
            <article 
              className="prose prose-slate dark:prose-invert max-w-4xl mx-auto"
              dangerouslySetInnerHTML={{ __html: page?.content || '<p>No content available</p>' }}
            />
          )}
        </main>
      </div>
    </>
  );
};

export default CustomPage;
