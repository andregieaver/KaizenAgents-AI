/**
 * Block Editor Components - Extracted from ContentBlocks.js for better maintainability
 */
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import axios from 'axios';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

/**
 * Menu Block Editor Component
 * Allows configuration of menu blocks for header/footer
 */
export const MenuBlockEditor = ({ block, updateBlock }) => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/menus/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMenus(response.data);
    } catch (error) {
      // Silent fail - menus may not be available
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Menu Selection */}
      <div className="space-y-4">
        <div>
          <Label>Select Menu</Label>
          <Select
            value={block.content.menuId || ''}
            onValueChange={(value) => updateBlock(block.id, { ...block.content, menuId: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? "Loading menus..." : "Choose a menu"} />
            </SelectTrigger>
            <SelectContent>
              {menus.length === 0 ? (
                <SelectItem value="none" disabled>No menus created yet</SelectItem>
              ) : (
                menus.map((menu) => (
                  <SelectItem key={menu.menu_id} value={menu.menu_id}>
                    {menu.name} ({menu.items?.length || 0} items)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Create and manage menus in the <a href="/dashboard/admin/menus" className="text-primary hover:underline">Menus page</a>
          </p>
        </div>
      </div>

      {/* Menu Display Settings */}
      <div className="space-y-4 border-t pt-4">
        <Label>Menu Layout</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={block.content.layout === 'horizontal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, layout: 'horizontal' })}
          >
            Horizontal
          </Button>
          <Button
            type="button"
            variant={block.content.layout === 'vertical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, layout: 'vertical' })}
          >
            Vertical
          </Button>
        </div>
      </div>

      {/* Display Mode Per Device */}
      <div className="space-y-4 border-t pt-4">
        <Label>Display Mode per Device</Label>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Desktop */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Monitor className="h-4 w-4" />
              Desktop
            </div>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant={block.content.displayMode?.desktop === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateBlock(block.id, { 
                  ...block.content, 
                  displayMode: { ...block.content.displayMode, desktop: 'normal' }
                })}
                className="w-full text-xs"
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={block.content.displayMode?.desktop === 'hamburger' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateBlock(block.id, { 
                  ...block.content, 
                  displayMode: { ...block.content.displayMode, desktop: 'hamburger' }
                })}
                className="w-full text-xs"
              >
                Hamburger
              </Button>
            </div>
          </div>

          {/* Tablet */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tablet className="h-4 w-4" />
              Tablet
            </div>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant={block.content.displayMode?.tablet === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateBlock(block.id, { 
                  ...block.content, 
                  displayMode: { ...block.content.displayMode, tablet: 'normal' }
                })}
                className="w-full text-xs"
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={block.content.displayMode?.tablet === 'hamburger' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateBlock(block.id, { 
                  ...block.content, 
                  displayMode: { ...block.content.displayMode, tablet: 'hamburger' }
                })}
                className="w-full text-xs"
              >
                Hamburger
              </Button>
            </div>
          </div>

          {/* Mobile */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4" />
              Mobile
            </div>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant={block.content.displayMode?.mobile === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateBlock(block.id, { 
                  ...block.content, 
                  displayMode: { ...block.content.displayMode, mobile: 'normal' }
                })}
                className="w-full text-xs"
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={block.content.displayMode?.mobile === 'hamburger' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateBlock(block.id, { 
                  ...block.content, 
                  displayMode: { ...block.content.displayMode, mobile: 'hamburger' }
                })}
                className="w-full text-xs"
              >
                Hamburger
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Alignment */}
      <div className="space-y-4 border-t pt-4">
        <Label>Menu Alignment</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={block.content.alignment === 'left' || !block.content.alignment ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, alignment: 'left' })}
          >
            Left
          </Button>
          <Button
            type="button"
            variant={block.content.alignment === 'center' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, alignment: 'center' })}
          >
            Center
          </Button>
          <Button
            type="button"
            variant={block.content.alignment === 'right' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, alignment: 'right' })}
          >
            Right
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MenuBlockEditor;
