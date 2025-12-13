import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { MessageSquare, Moon, Sun, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import {
  renderHeroBlock,
  renderFeaturesBlock,
  renderCTABlock,
  renderButtonBlock,
  renderPricingWidgetBlock,
  renderTextBlock
} from '../components/PublicBlockRenderers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PricingPage = () => {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [platformName, setPlatformName] = useState('AI Support Hub');
  const [platformLogo, setPlatformLogo] = useState(null);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch platform info
        const platformResponse = await axios.get(`${API}/public/platform-info`);
        if (platformResponse.data?.platform_name) {
          setPlatformName(platformResponse.data.platform_name);
        }
        if (platformResponse.data?.platform_logo) {
          setPlatformLogo(platformResponse.data.platform_logo);
        }

        // Fetch pricing page content
        const pageResponse = await axios.get(`${API}/admin/pages/public/pricing`);
        setPage(pageResponse.data);
      } catch (error) {
        console.debug('Error fetching pricing page data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getPlatformLogoSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${process.env.REACT_APP_BACKEND_URL}${url}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get blocks from the page
  const blocks = page?.blocks || [];

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{page?.seo?.title || `Pricing - ${platformName}`}</title>
        {page?.seo?.description && (
          <meta name="description" content={page.seo.description} />
        )}
        {page?.seo?.keywords && (
          <meta name="keywords" content={page.seo.keywords} />
        )}
        {page?.seo?.canonical_url && (
          <link rel="canonical" href={page.seo.canonical_url} />
        )}

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

        {/* Robots */}
        {page?.seo?.robots && (
          <meta 
            name="robots" 
            content={`${page.seo.robots.index ? 'index' : 'noindex'}, ${page.seo.robots.follow ? 'follow' : 'nofollow'}`} 
          />
        )}
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                  {getPlatformLogoSrc(platformLogo) ? (
                    <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
                <span className="font-heading font-bold text-lg">{platformName}</span>
              </Link>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                {isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button className="btn-hover">Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost">Sign in</Button>
                    </Link>
                    <Link to="/register">
                      <Button className="btn-hover">Register</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content - Render Blocks */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {blocks.map((block) => {
            switch (block.type) {
              case 'hero':
                return renderHeroBlock(block);
              case 'features':
                return renderFeaturesBlock(block);
              case 'cta':
                return renderCTABlock(block);
              case 'button':
                return renderButtonBlock(block);
              case 'pricing_widget':
                return renderPricingWidgetBlock(block);
              case 'text':
                return (
                  <article
                    key={block.id}
                    className="prose prose-slate dark:prose-invert max-w-4xl mx-auto my-8"
                    dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
                  />
                );
              default:
                return null;
            }
          })}
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                  {getPlatformLogoSrc(platformLogo) ? (
                    <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{platformName}</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} {platformName}. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default PricingPage;
