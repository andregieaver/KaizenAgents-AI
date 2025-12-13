import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { MessageSquare, Moon, Sun, Loader2, Bot } from 'lucide-react';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import {
  renderHeroBlock,
  renderFeaturesBlock,
  renderCTABlock,
  renderButtonBlock
} from '../components/PublicBlockRenderers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HomePage = () => {
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

        // Fetch homepage content
        const pageResponse = await axios.get(`${API}/admin/pages/public/homepage`);
        setPage(pageResponse.data);
      } catch (error) {
        console.debug('Error fetching homepage data:', error);
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

  // Convert page.content array to blocks for rendering
  const blocks = page?.content || [];

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{page?.seo_title || platformName}</title>
        {page?.seo_description && (
          <meta name="description" content={page.seo_description} />
        )}
        {page?.seo_keywords && page.seo_keywords.length > 0 && (
          <meta name="keywords" content={page.seo_keywords.join(', ')} />
        )}
        {page?.canonical_url && (
          <link rel="canonical" href={page.canonical_url} />
        )}

        {/* Open Graph Tags */}
        {page?.og_title && (
          <meta property="og:title" content={page.og_title} />
        )}
        {page?.og_description && (
          <meta property="og:description" content={page.og_description} />
        )}
        {page?.og_image && (
          <meta property="og:image" content={page.og_image} />
        )}

        {/* Twitter Card Tags */}
        {page?.twitter_card && (
          <meta name="twitter:card" content={page.twitter_card} />
        )}
        {page?.twitter_title && (
          <meta name="twitter:title" content={page.twitter_title} />
        )}
        {page?.twitter_description && (
          <meta name="twitter:description" content={page.twitter_description} />
        )}

        {/* Robots */}
        {(page?.no_index || page?.no_follow) && (
          <meta 
            name="robots" 
            content={`${page.no_index ? 'noindex' : 'index'}, ${page.no_follow ? 'nofollow' : 'follow'}`} 
          />
        )}
      </Helmet>

      <div className="min-h-screen bg-background" data-testid="landing-page">
        {/* Navigation */}
        <nav className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                  {getPlatformLogoSrc(platformLogo) ? (
                    <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
                <span className="font-heading font-bold text-lg">{platformName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9"
                  data-testid="theme-toggle"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                {isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button className="btn-hover" data-testid="dashboard-link">Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost" data-testid="login-nav-btn">Sign in</Button>
                    </Link>
                    <Link to="/pricing">
                      <Button className="btn-hover" data-testid="register-nav-btn">Get Started</Button>
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
              default:
                return null;
            }
          })}
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                  {getPlatformLogoSrc(platformLogo) ? (
                    <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{platformName}</span>
              </div>
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

export default HomePage;
