import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Plus,
  Trash2,
  Monitor,
  Tablet,
  Smartphone,
  Upload,
  Loader2
} from 'lucide-react';
import ContentBlocks from './ContentBlocks';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RowEditor = ({ blockId, content, onUpdate }) => {
  const [activeDevice, setActiveDevice] = useState('desktop');
  const [uploadingBg, setUploadingBg] = useState(false);

  const columns = content.columns || [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const addColumn = () => {
    const newColumn = {
      id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      blocks: [],
      width: { desktop: 100 / (columns.length + 1), tablet: 100, mobile: 100 }
    };

    // Recalculate existing column widths
    const updatedColumns = columns.map(col => ({
      ...col,
      width: {
        ...col.width,
        desktop: 100 / (columns.length + 1)
      }
    }));

    onUpdate({
      ...content,
      columns: [...updatedColumns, newColumn]
    });
  };

  const deleteColumn = (columnId) => {
    const updatedColumns = columns
      .filter(col => col.id !== columnId)
      .map(col => ({
        ...col,
        width: {
          ...col.width,
          desktop: 100 / (columns.length - 1)
        }
      }));

    onUpdate({
      ...content,
      columns: updatedColumns
    });
  };

  const updateColumnWidth = (columnId, device, width) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId
        ? { ...col, width: { ...col.width, [device]: parseFloat(width) } }
        : col
    );

    onUpdate({
      ...content,
      columns: updatedColumns
    });
  };

  const updateColumnBlocks = (columnId, blocks) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId ? { ...col, blocks } : col
    );

    onUpdate({
      ...content,
      columns: updatedColumns
    });
  };

  const handleBgImageUpload = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/admin/pages/upload-og-image/temp`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
      onUpdate({
        ...content,
        backgroundImage: fullUrl
      });

      toast.success('Background image uploaded');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingBg(false);
    }
  };

  const layoutPresets = [
    { name: '1 Column', columns: [100] },
    { name: '2 Equal', columns: [50, 50] },
    { name: '2/3 - 1/3', columns: [66.66, 33.34] },
    { name: '1/3 - 2/3', columns: [33.34, 66.66] },
    { name: '3 Equal', columns: [33.33, 33.33, 33.34] },
    { name: '1/4 - 1/2 - 1/4', columns: [25, 50, 25] },
    { name: '4 Equal', columns: [25, 25, 25, 25] },
  ];

  const applyPreset = (preset) => {
    const newColumns = preset.columns.map((width, index) => ({
      id: columns[index]?.id || `col_${Date.now()}_${index}`,
      blocks: columns[index]?.blocks || [],
      width: {
        desktop: width,
        tablet: index === 0 ? 100 : columns[index]?.width?.tablet || 100,
        mobile: 100
      }
    }));

    onUpdate({
      ...content,
      columns: newColumns
    });
  };

  return (
    <div className="space-y-4">
      {/* Row Settings */}
      <Card>
        <CardHeader className="p-3 bg-muted/30">
          <h4 className="text-sm font-semibold">Row Settings</h4>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Layout Presets */}
          <div>
            <Label>Layout Presets</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {layoutPresets.map((preset, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="justify-start"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Gap */}
          <div>
            <Label htmlFor="row-gap">Column Gap</Label>
            <Input
              id="row-gap"
              value={content.gap || '1rem'}
              onChange={(e) => onUpdate({ ...content, gap: e.target.value })}
              placeholder="1rem"
            />
          </div>

          {/* Background Color */}
          <div>
            <Label htmlFor="row-bg-color">Background Color</Label>
            <div className="flex gap-2">
              <Input
                id="row-bg-color"
                type="color"
                value={content.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ ...content, backgroundColor: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                value={content.backgroundColor || ''}
                onChange={(e) => onUpdate({ ...content, backgroundColor: e.target.value })}
                placeholder="#ffffff or transparent"
                className="flex-1"
              />
            </div>
          </div>

          {/* Background Image */}
          <div>
            <Label>Background Image</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="https://example.com/bg.jpg"
                value={content.backgroundImage || ''}
                onChange={(e) => onUpdate({ ...content, backgroundImage: e.target.value })}
              />
              <label htmlFor="row-bg-upload">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingBg}
                  asChild
                >
                  <span>
                    {uploadingBg ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </span>
                </Button>
              </label>
              <input
                id="row-bg-upload"
                type="file"
                accept="image/*"
                onChange={(e) => handleBgImageUpload(e.target.files[0])}
                className="hidden"
              />
            </div>
            {content.backgroundImage && (
              <img
                src={content.backgroundImage}
                alt="Background preview"
                className="w-full h-24 object-cover rounded mt-2"
              />
            )}
          </div>

          {/* Vertical Alignment */}
          <div>
            <Label>Vertical Alignment of Column Contents</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={content.verticalAlign === 'top' || !content.verticalAlign ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ ...content, verticalAlign: 'top' })}
              >
                Top
              </Button>
              <Button
                type="button"
                variant={content.verticalAlign === 'center' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ ...content, verticalAlign: 'center' })}
              >
                Center
              </Button>
              <Button
                type="button"
                variant={content.verticalAlign === 'bottom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ ...content, verticalAlign: 'bottom' })}
              >
                Bottom
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Align content vertically within all columns
            </p>
          </div>

          {/* Reverse Columns on Mobile */}
          <div>
            <Label>Mobile Column Order</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={!content.reverseOnMobile ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ ...content, reverseOnMobile: false })}
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={content.reverseOnMobile ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ ...content, reverseOnMobile: true })}
              >
                Reversed
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              When reversed, columns stack in opposite order on mobile (right column appears first)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Column Width Controls */}
      <Card>
        <CardHeader className="p-3 bg-muted/30">
          <h4 className="text-sm font-semibold">Column Widths</h4>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs value={activeDevice} onValueChange={setActiveDevice}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="desktop">
                <Monitor className="h-4 w-4 mr-2" />
                Desktop
              </TabsTrigger>
              <TabsTrigger value="tablet">
                <Tablet className="h-4 w-4 mr-2" />
                Tablet
              </TabsTrigger>
              <TabsTrigger value="mobile">
                <Smartphone className="h-4 w-4 mr-2" />
                Mobile
              </TabsTrigger>
            </TabsList>

            {['desktop', 'tablet', 'mobile'].map(device => (
              <TabsContent key={device} value={device} className="space-y-3 mt-4">
                {columns.map((col, index) => (
                  <div key={col.id} className="flex items-center gap-3">
                    <Label className="w-24">Column {index + 1}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={col.width[device] || 100}
                      onChange={(e) => updateColumnWidth(col.id, device, e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    {columns.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteColumn(col.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4"
            onClick={addColumn}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Column
          </Button>
        </CardContent>
      </Card>

      {/* Columns with Nested Blocks */}
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: columns.map(col => `${col.width.desktop}%`).join(' '),
          gap: content.gap
        }}
      >
        {columns.map((col, index) => (
          <div
            key={col.id}
            className="border-2 border-dashed rounded-lg p-4 min-h-[200px]"
            style={{ borderColor: 'var(--primary)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-primary">
                Column {index + 1}
              </span>
              <span className="text-xs text-muted-foreground">
                {col.width.desktop}%
              </span>
            </div>
            <ContentBlocks
              blocks={col.blocks}
              onChange={(blocks) => updateColumnBlocks(col.id, blocks)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RowEditor;
