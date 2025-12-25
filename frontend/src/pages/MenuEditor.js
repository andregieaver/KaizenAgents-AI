import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Plus, ChevronUp, ChevronDown, Trash2, Monitor, Tablet, Smartphone } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const MenuEditor = () => {
  const { menuId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [items, setItems] = useState([]);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/menus/${menuId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMenuName(response.data.name);
      setItems(response.data.items || []);
    } catch {
      alert('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    if (menuId) {
      fetchMenu();
    }
  }, [menuId, fetchMenu]);

  const handleSave = async () => {
    if (!menuName.trim()) {
      alert('Please enter a menu name');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const menuData = {
        name: menuName,
        items: items
      };

      if (menuId) {
        await axios.put(`${API}/api/menus/${menuId}`, menuData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/api/menus/`, menuData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      navigate('/dashboard/admin/menus');
    } catch {
      alert('Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const newItem = {
      id: `menu_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: 'New Link',
      url: '#',
      icon: '',
      visibility: { desktop: true, tablet: true, mobile: true },
      order: items.length
    };
    setItems([...items, newItem]);
  };

  const updateItem = (itemId, updates) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const deleteItem = (itemId) => {
    const updatedItems = items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index }));
    setItems(updatedItems);
  };

  const moveItem = (itemId, direction) => {
    const index = items.findIndex(item => item.id === itemId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) {
      return;
    }
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    const reorderedItems = newItems.map((item, idx) => ({ ...item, order: idx }));
    setItems(reorderedItems);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard/admin/menus')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {menuId ? 'Edit Menu' : 'Create Menu'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage navigation menu items
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Menu'}
        </Button>
      </div>

      {/* Menu Name */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="menu-name">Menu Name</Label>
            <Input
              id="menu-name"
              placeholder="e.g., Main Navigation, Footer Links"
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Give your menu a descriptive name to identify it when selecting in components
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Menu Items ({items.length})</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">No menu items yet</p>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <Card key={item.id} className="p-4">
                    <div className="space-y-3">
                      {/* Item Header with Controls */}
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveItem(item.id, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveItem(item.id, 'down')}
                            disabled={index === items.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <span className="text-sm font-medium flex-1">{item.label}</span>
                        
                        {/* Device Visibility Toggles */}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant={item.visibility?.desktop ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItem(item.id, {
                              visibility: { ...item.visibility, desktop: !item.visibility?.desktop }
                            })}
                            title="Desktop visibility"
                          >
                            <Monitor className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant={item.visibility?.tablet ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItem(item.id, {
                              visibility: { ...item.visibility, tablet: !item.visibility?.tablet }
                            })}
                            title="Tablet visibility"
                          >
                            <Tablet className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant={item.visibility?.mobile ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItem(item.id, {
                              visibility: { ...item.visibility, mobile: !item.visibility?.mobile }
                            })}
                            title="Mobile visibility"
                          >
                            <Smartphone className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>

                      {/* Item Fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Label</Label>
                          <Input
                            placeholder="Menu item label"
                            value={item.label}
                            onChange={(e) => updateItem(item.id, { label: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">URL</Label>
                          <Input
                            placeholder="/path"
                            value={item.url}
                            onChange={(e) => updateItem(item.id, { url: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Icon (optional)</Label>
                        <Input
                          placeholder="Home, Info, Settings, etc."
                          value={item.icon || ''}
                          onChange={(e) => updateItem(item.id, { icon: e.target.value })}
                          className="h-9 text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Lucide icon name (e.g., Home, Info, Settings, Mail)
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuEditor;
