import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { MessageSquare, Moon, Sun, Loader2, Menu as MenuIcon, X } from 'lucide-react';
import * as Icons from 'lucide-react';
import axios from 'axios';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';

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
      } catch {
        // Header fetch failed silently
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
        const buttonAlignment = block.content?.alignment || 'left';
        const alignClass = buttonAlignment === 'center' ? 'mx-auto' : buttonAlignment === 'right' ? 'ml-auto' : '';
        return (
          <div key={block.id} className={`flex ${visibilityClass}`}>
            <a href={block.content?.url || '#'} className={alignClass}>
              <Button
                variant={block.content?.variant || 'default'}
                size={block.content?.size || 'default'}
              >
                {block.content?.text || 'Button'}
                {IconComponent && <IconComponent className="ml-2 h-4 w-4" />}
              </Button>
            </a>
          </div>
        );
      
      case 'image':
        const imageAlignment = block.content?.alignment || 'left';
        const imageAlignClass = imageAlignment === 'center' ? 'mx-auto' : imageAlignment === 'right' ? 'ml-auto' : '';
        const imageElement = (
          <img
            src={block.content?.url || ''}
            alt={block.content?.alt || ''}
            className={`h-8 w-auto object-contain ${imageAlignClass}`}
          />
        );
        
        if (block.content?.link) {
          return (
            <a 
              key={block.id} 
              href={block.content.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex ${visibilityClass}`}
            >
              {imageElement}
            </a>
          );
        }
        
        return (
          <div key={block.id} className={`flex ${visibilityClass}`}>
            {imageElement}
          </div>
        );
      
      case 'logo_text':
        const logoSrc = block.content?.logoUrl ? (
          block.content.logoUrl.startsWith('/api/') 
            ? `${process.env.REACT_APP_BACKEND_URL}${block.content.logoUrl}`
            : block.content.logoUrl
        ) : null;
        
        return (
          <Link key={block.id} to={block.content?.linkUrl || '/'} className={`flex items-center gap-2 ${visibilityClass}`}>
            <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt={block.content?.platformName} className="h-full w-full object-contain" />
              ) : (
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              )}
            </div>
            <span className="font-heading font-bold text-lg">{block.content?.platformName || 'Platform'}</span>
          </Link>
        );
      
      case 'theme_toggle':
        return (
          <Button
            key={block.id}
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={`h-9 w-9 ${visibilityClass}`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        );
      
      case 'auth_buttons':
        return (
          <div key={block.id} className={`flex items-center gap-3 ${visibilityClass}`}>
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button className="btn-hover">{block.content?.dashboardText || 'Dashboard'}</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">{block.content?.signInText || 'Sign in'}</Button>
                </Link>
                <Link to="/pricing">
                  <Button className="btn-hover">{block.content?.signUpText || 'Get Started'}</Button>
                </Link>
              </>
            )}
          </div>
        );
      
      case 'menu':
        return <MenuBlock key={block.id} block={block} visibilityClass={visibilityClass} />;
      
      case 'row':
        const columns = block.content?.columns || [];
        const gridCols = columns.length === 2 ? 'grid-cols-2' : columns.length === 3 ? 'grid-cols-3' : 'grid-cols-4';
        
        // Check if vertical alignment is enabled
        const verticalAlignEnabled = block.content?.verticalAlign === true;
        const alignItems = verticalAlignEnabled ? 'items-center' : 'items-start';
        
        // Check if reverse mobile is enabled
        const reverseMobileEnabled = block.content?.reverseMobile === true;
        const reverseClass = reverseMobileEnabled ? 'flex-col-reverse md:flex-row' : 'flex-col md:flex-row';
        
        // Check if any column has custom mobile width (stored in column.width.mobile)
        const hasCustomMobileWidths = columns.some(col => col.width?.mobile && col.width.mobile !== 100);
        
        return (
          <div key={block.id} className={`flex ${hasCustomMobileWidths ? 'flex-row' : reverseClass} gap-4 w-full ${alignItems} ${visibilityClass} ${hasCustomMobileWidths ? '' : 'md:grid md:' + gridCols}`}>
            {columns.map((column) => {
              // Apply custom mobile width if specified using inline style
              const mobileWidth = column.width?.mobile;
              const columnStyle = mobileWidth && mobileWidth !== 100 ? { width: `${mobileWidth}%` } : {};
              const responsiveWidthClass = hasCustomMobileWidths ? 'md:w-auto md:flex-1' : 'w-full';
              
              return (
                <div 
                  key={column.id} 
                  className={`flex flex-col gap-2 ${responsiveWidthClass}`}
                  style={columnStyle}
                >
                  {column.blocks?.map((colBlock) => renderHeaderBlock(colBlock))}
                </div>
              );
            })}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Menu Block Component with Hamburger Support
  const MenuBlock = ({ block, visibilityClass }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const content = block.content || {};
    const layout = content.layout || 'horizontal';
    const displayMode = content.displayMode || { desktop: 'normal', tablet: 'normal', mobile: 'hamburger' };
    const menuId = content.menuId;

    useEffect(() => {
      // Support old format with inline items (backward compatibility)
      if (content.items && content.items.length > 0) {
        setItems(content.items);
        setLoading(false);
      } else if (menuId) {
        fetchMenuItems();
      } else {
        setLoading(false);
      }
    }, [menuId, content.items]);

    const fetchMenuItems = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/menus/public/${menuId}`);
        setItems(response.data.items || []);
      } catch {
        // Menu fetch failed silently - items will remain empty
      } finally {
        setLoading(false);
      }
    };

    if (loading) {
      return <div className={visibilityClass}><Loader2 className="h-4 w-4 animate-spin" /></div>;
    }

    if (items.length === 0) {
      return null;
    }
    
    // Get visibility classes for menu items
    const getItemVisibilityClasses = (visibility) => {
      if (!visibility) return '';
      const classes = [];
      if (!visibility.mobile) classes.push('hidden');
      else classes.push('block');
      if (visibility.tablet !== visibility.mobile) {
        classes.push(visibility.tablet ? 'sm:block' : 'sm:hidden');
      }
      if (visibility.desktop !== visibility.tablet) {
        classes.push(visibility.desktop ? 'lg:block' : 'lg:hidden');
      }
      return classes.join(' ');
    };
    
    // Render menu items
    const renderMenuItems = (inDrawer = false) => {
      const itemClasses = layout === 'horizontal' && !inDrawer
        ? 'flex items-center gap-1'
        : 'flex flex-col gap-1';
      
      return (
        <nav className={itemClasses}>
          {items.map((item) => {
            const ItemIcon = item.icon ? Icons[item.icon] : null;
            const itemVisibility = getItemVisibilityClasses(item.visibility);
            
            return (
              <Link
                key={item.id}
                to={item.url}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors ${itemVisibility}`}
                onClick={() => setIsOpen(false)}
              >
                {ItemIcon && <ItemIcon className="h-4 w-4" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      );
    };
    
    // Determine display mode classes based on device
    const getDisplayModeClasses = () => {
      const classes = [];
      
      // Mobile
      if (displayMode.mobile === 'hamburger') {
        classes.push('block'); // Show hamburger on mobile
      } else {
        classes.push('hidden'); // Hide hamburger, show normal menu
      }
      
      // Tablet
      if (displayMode.tablet === 'hamburger') {
        classes.push('sm:block'); // Show hamburger on tablet
      } else {
        classes.push('sm:hidden'); // Hide hamburger on tablet
      }
      
      // Desktop
      if (displayMode.desktop === 'hamburger') {
        classes.push('lg:block'); // Show hamburger on desktop
      } else {
        classes.push('lg:hidden'); // Hide hamburger on desktop
      }
      
      return classes.join(' ');
    };
    
    const getNormalMenuClasses = () => {
      const classes = [];
      
      // Mobile
      if (displayMode.mobile === 'normal') {
        classes.push('block');
      } else {
        classes.push('hidden');
      }
      
      // Tablet
      if (displayMode.tablet === 'normal') {
        classes.push('sm:block');
      } else {
        classes.push('sm:hidden');
      }
      
      // Desktop
      if (displayMode.desktop === 'normal') {
        classes.push('lg:block');
      } else {
        classes.push('lg:hidden');
      }
      
      return classes.join(' ');
    };
    
    const menuAlignment = content.alignment || 'left';
    const menuAlignClass = menuAlignment === 'center' ? 'justify-center' : menuAlignment === 'right' ? 'justify-end' : 'justify-start';
    
    return (
      <div className={`flex ${menuAlignClass} ${visibilityClass}`}>
        {/* Hamburger Menu */}
        <div className={getDisplayModeClasses()}>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                {renderMenuItems(true)}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Normal Menu */}
        <div className={getNormalMenuClasses()}>
          {renderMenuItems(false)}
        </div>
      </div>
    );
  };

  // Render header with blocks (or default if no blocks)
  return (
    <nav className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {headerBlocks.length > 0 ? (
            // Render custom blocks
            headerBlocks.map(block => renderHeaderBlock(block))
          ) : (
            // Default header (fallback when no blocks are configured)
            <>
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
              
              <div className="flex-1"></div>
              
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
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default GlobalHeader;
