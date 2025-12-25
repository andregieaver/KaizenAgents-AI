import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Loader2, Menu as MenuIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import axios from 'axios';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

const MenuBlock = ({ block, visibilityClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const content = block.content || {};
  const layout = content.layout || 'horizontal';
  const displayMode = content.displayMode || { desktop: 'normal', tablet: 'normal', mobile: 'hamburger' };
  const menuId = content.menuId;

  const fetchMenuItems = useCallback(async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/menus/public/${menuId}`);
      setItems(response.data.items || []);
    } catch {
      // Menu fetch failed silently - items will remain empty
    } finally {
      setLoading(false);
    }
  }, [menuId]);

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
  }, [menuId, content.items, fetchMenuItems]);

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

export default MenuBlock;
