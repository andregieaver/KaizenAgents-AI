import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import * as Icons from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GlobalFooter = () => {
  const [platformName, setPlatformName] = useState('AI Support Hub');
  const [platformLogo, setPlatformLogo] = useState(null);
  const [footerBlocks, setFooterBlocks] = useState([]);

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

        // Fetch footer component
        const footerResponse = await axios.get(`${API}/global-components/public/footer`);
        setFooterBlocks(footerResponse.data.blocks || []);
      } catch (error) {
        console.debug('Error fetching footer data:', error);
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

  // Render individual block for footer
  const renderFooterBlock = (block) => {
    const visibilityClass = getVisibilityClasses(block.visibility);
    switch (block.type) {
      case 'text':
        return (
          <div
            key={block.id}
            className={`prose prose-sm dark:prose-invert max-w-none text-muted-foreground ${visibilityClass}`}
            dangerouslySetInnerHTML={{ __html: block.content?.html || '' }}
          />
        );
      
      case 'button':
        const IconComponent = block.content?.icon ? Icons[block.content.icon] : null;
        const buttonAlignment = block.content?.alignment || 'left';
        const textAlign = buttonAlignment === 'center' ? 'text-center' : buttonAlignment === 'right' ? 'text-right' : 'text-left';
        return (
          <div key={block.id} className={`${textAlign} ${visibilityClass}`}>
            <a href={block.content?.url || '#'} className="inline-block">
              <Button
                variant={block.content?.variant || 'default'}
                size={block.content?.size || 'sm'}
              >
                {block.content?.text || 'Button'}
                {IconComponent && <IconComponent className="ml-2 h-4 w-4" />}
              </Button>
            </a>
          </div>
        );
      
      case 'image':
        const imageElement = (
          <img
            src={block.content?.url || ''}
            alt={block.content?.alt || ''}
            className="h-6 w-auto object-contain"
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
      
      case 'row':
        const columns = block.content?.columns || [];
        const gridCols = columns.length === 2 ? 'md:grid-cols-2' : columns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4';
        
        return (
          <div key={block.id} className={`grid gap-6 ${gridCols} ${visibilityClass}`}>
            {columns.map((column) => (
              <div key={column.id} className="flex flex-col gap-3">
                {column.blocks?.map((colBlock) => renderFooterBlock(colBlock))}
              </div>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  // If footer has custom blocks, render them
  if (footerBlocks.length > 0) {
    return (
      <footer className="py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo and platform name */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-6">
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
          </div>

          {/* Custom blocks */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {footerBlocks.map(block => (
              <div key={block.id}>
                {renderFooterBlock(block)}
              </div>
            ))}
          </div>

          {/* Copyright */}
          <div className="pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {platformName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // Default footer (fallback)
  return (
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
  );
};

export default GlobalFooter;
