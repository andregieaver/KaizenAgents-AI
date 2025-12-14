import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { MessageSquare, Moon, Sun, Loader2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GlobalHeader = () => {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [platformName, setPlatformName] = useState('AI Support Hub');
  const [platformLogo, setPlatformLogo] = useState(null);
  const [headerBlocks, setHeaderBlocks] = useState([]);
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

        // Fetch header component
        const headerResponse = await axios.get(`${API}/global-components/public/header`);
        setHeaderBlocks(headerResponse.data.blocks || []);
      } catch (error) {
        console.debug('Error fetching header data:', error);
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

  // Generate responsive visibility classes
  const getVisibilityClasses = (visibility) => {
    if (!visibility) return '';
    
    const classes = [];
    
    // Mobile (default, no prefix)
    if (!visibility.mobile) classes.push('hidden');
    else classes.push('block');
    
    // Tablet (sm: breakpoint >= 640px)
    if (visibility.tablet !== visibility.mobile) {
      classes.push(visibility.tablet ? 'sm:block' : 'sm:hidden');
    }
    
    // Desktop (lg: breakpoint >= 1024px)
    if (visibility.desktop !== visibility.tablet) {
      classes.push(visibility.desktop ? 'lg:block' : 'lg:hidden');
    }
    
    return classes.join(' ');
  };

  // Render individual block for header
  const renderHeaderBlock = (block) => {
    const visibilityClass = getVisibilityClasses(block.visibility);
    switch (block.type) {
      case 'text':
        return (
          <div
            key={block.id}
            className={`prose prose-sm dark:prose-invert max-w-none ${visibilityClass}`}
            dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
          />
        );
      
      case 'button':
        const IconComponent = block.content?.icon ? Icons[block.content.icon] : null;
        return (
          <a key={block.id} href={block.content?.url || '#'} className={visibilityClass}>
            <Button
              variant={block.content?.variant || 'default'}
              size={block.content?.size || 'default'}
            >
              {block.content?.text || 'Button'}
              {IconComponent && <IconComponent className="ml-2 h-4 w-4" />}
            </Button>
          </a>
        );
      
      case 'image':
        const imageElement = (
          <img
            src={block.content?.url || ''}
            alt={block.content?.alt || ''}
            className="h-8 w-auto object-contain"
          />
        );
        
        if (block.content?.link) {
          return (
            <a 
              key={block.id} 
              href={block.content.link}
              target="_blank"
              rel="noopener noreferrer"
              className={visibilityClass}
            >
              {imageElement}
            </a>
          );
        }
        
        return (
          <div key={block.id} className={visibilityClass}>
            {imageElement}
          </div>
        );
      
      default:
        return null;
    }
  };

  // If header has custom blocks, render them
  if (headerBlocks.length > 0) {
    return (
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-6">
            {/* Logo and platform name */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                {getPlatformLogoSrc(platformLogo) ? (
                  <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
              <span className="font-heading font-bold text-lg">{platformName}</span>
            </Link>

            {/* Custom blocks - navigation/content area */}
            <div className="flex items-center gap-4 flex-1">
              {headerBlocks.map(block => renderHeaderBlock(block))}
            </div>

            {/* Fixed right side - theme toggle and auth buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
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
                  <Link to="/pricing">
                    <Button className="btn-hover">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Default header (fallback)
  return (
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
                <Link to="/pricing">
                  <Button className="btn-hover">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default GlobalHeader;
