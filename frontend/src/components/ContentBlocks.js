import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Plus,
  GripVertical,
  Trash2,
  Type,
  Image as ImageIcon,
  Video,
  Code,
  Upload,
  Loader2,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Columns,
  Monitor,
  Tablet,
  Smartphone,
  Palette,
  Sparkles,
  Grid3x3,
  Megaphone,
  MousePointerClick,
  Tag,
  Moon,
  UserCircle,
  Menu as MenuIcon,
  X
} from 'lucide-react';
import * as Icons from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import RowEditor from './RowEditor';
import { HeroBlockEditor, FeatureGridEditor, CTABlockEditor, ButtonBlockEditor } from './HomepageBlocks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Sortable Block Item Component
const SortableBlockItem = ({ block, children, onDelete, onVisibilityChange }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Default visibility settings
  const visibility = block.visibility || { desktop: true, tablet: true, mobile: true };

  const toggleVisibility = (device) => {
    const newVisibility = { ...visibility, [device]: !visibility[device] };
    onVisibilityChange(block.id, newVisibility);
  };

  const getBlockIcon = (type) => {
    switch (type) {
      case 'text':
        return <Type className="h-4 w-4" />;
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'faq':
        return <HelpCircle className="h-4 w-4" />;
      case 'row':
        return <Columns className="h-4 w-4" />;
      case 'hero':
        return <Sparkles className="h-4 w-4" />;
      case 'features':
        return <Grid3x3 className="h-4 w-4" />;
      case 'cta':
        return <Megaphone className="h-4 w-4" />;
      case 'button':
        return <MousePointerClick className="h-4 w-4" />;
      case 'logo_text':
        return <Tag className="h-4 w-4" />;
      case 'theme_toggle':
        return <Moon className="h-4 w-4" />;
      case 'auth_buttons':
        return <UserCircle className="h-4 w-4" />;
      case 'menu':
        return <MenuIcon className="h-4 w-4" />;
      default:
        return <Type className="h-4 w-4" />;
    }
  };

  const getBlockLabel = (type) => {
    switch (type) {
      case 'text':
        return 'Text Block';
      case 'image':
        return 'Image Block';
      case 'video':
        return 'Video Block';
      case 'code':
        return 'Code Block';
      case 'faq':
        return 'FAQ Block';
      case 'row':
        return 'Row Layout';
      case 'hero':
        return 'Hero Section';
      case 'features':
        return 'Feature Grid';
      case 'cta':
        return 'Call to Action';
      case 'button':
        return 'Button';
      case 'logo_text':
        return 'Logo with Text';
      case 'theme_toggle':
        return 'Theme Toggle';
      case 'auth_buttons':
        return 'Auth Buttons';
      case 'menu':
        return 'Navigation Menu';
      default:
        return 'Block';
    }
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'shadow-lg' : ''}>
      <CardHeader className="p-3 bg-muted/30 flex flex-row items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-2 -m-2"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2 flex-1">
          {getBlockIcon(block.type)}
          <span className="text-sm font-medium">
            {getBlockLabel(block.type)}
          </span>
        </div>
        
        {/* Device Visibility Toggles */}
        <div className="flex items-center gap-1 border-l pl-3">
          <Button
            type="button"
            variant={visibility.desktop ? 'default' : 'ghost'}
            size="icon"
            onClick={() => toggleVisibility('desktop')}
            className="h-8 w-8"
            title="Show/hide on desktop"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={visibility.tablet ? 'default' : 'ghost'}
            size="icon"
            onClick={() => toggleVisibility('tablet')}
            className="h-8 w-8"
            title="Show/hide on tablet"
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={visibility.mobile ? 'default' : 'ghost'}
            size="icon"
            onClick={() => toggleVisibility('mobile')}
            className="h-8 w-8"
            title="Show/hide on mobile"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(block.id)}
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
};

const ContentBlocks = ({ blocks, onChange }) => {
  const [localBlocks, setLocalBlocks] = useState(blocks || []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms press before drag starts (prevents conflict with scrolling)
        tolerance: 8, // 8px of movement tolerance
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleBlocksChange = (newBlocks) => {
    setLocalBlocks(newBlocks);
    onChange(newBlocks);
  };

  const addBlock = (type) => {
    let content = {};
    
    if (type === 'text') {
      content = { html: '' };
    } else if (type === 'row') {
      content = { 
        columns: [
          { id: `col_${Date.now()}_1`, blocks: [], width: { desktop: 50, tablet: 100, mobile: 100 } },
          { id: `col_${Date.now()}_2`, blocks: [], width: { desktop: 50, tablet: 100, mobile: 100 } }
        ],
        gap: '1rem',
        backgroundColor: '',
        backgroundImage: ''
      };
    } else if (type === 'hero') {
      content = {
        badge: 'New Feature',
        heading: 'Your Amazing Heading',
        highlight: 'Goes Here',
        description: 'Compelling description that explains what you offer.',
        primaryButton: { text: 'Get Started', url: '/pricing' },
        secondaryButton: { text: 'Learn More', url: '#' },
        imageUrl: 'https://images.unsplash.com/photo-1737505599162-d9932323a889?w=800'
      };
    } else if (type === 'features') {
      content = {
        heading: 'Our Features',
        description: 'Everything you need to succeed',
        features: [
          { id: '1', icon: 'Zap', title: 'Feature One', description: 'Description here' },
          { id: '2', icon: 'Shield', title: 'Feature Two', description: 'Description here' },
          { id: '3', icon: 'BarChart3', title: 'Feature Three', description: 'Description here' }
        ]
      };
    } else if (type === 'cta') {
      content = {
        heading: 'Ready to Get Started?',
        description: 'Join thousands of satisfied customers today.',
        buttonText: 'Start Now',
        buttonUrl: '/pricing'
      };
    } else if (type === 'button') {
      content = {
        text: 'Click Me',
        url: '#',
        variant: 'default', // default, outline, ghost
        size: 'default', // sm, default, lg
        icon: 'ArrowRight'
      };
    } else if (type === 'logo_text') {
      content = {
        logoUrl: '',
        platformName: 'Your Platform',
        linkUrl: '/'
      };
    } else if (type === 'theme_toggle') {
      content = {}; // No configuration needed
    } else if (type === 'auth_buttons') {
      content = {
        signInText: 'Sign in',
        signUpText: 'Get Started',
        dashboardText: 'Dashboard'
      };
    } else if (type === 'menu') {
      content = {
        layout: 'horizontal', // horizontal or vertical
        displayMode: {
          desktop: 'normal',
          tablet: 'normal',
          mobile: 'hamburger'
        },
        items: [
          {
            id: `menu_item_${Date.now()}_1`,
            label: 'Home',
            url: '/',
            icon: 'Home',
            visibility: { desktop: true, tablet: true, mobile: true },
            order: 0
          },
          {
            id: `menu_item_${Date.now()}_2`,
            label: 'About',
            url: '/about',
            icon: 'Info',
            visibility: { desktop: true, tablet: true, mobile: true },
            order: 1
          }
        ]
      };
    }
    
    const newBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      content: content,
      visibility: { desktop: true, tablet: true, mobile: true },
      order: localBlocks.length
    };
    handleBlocksChange([...localBlocks, newBlock]);
  };

  const updateBlock = (blockId, content) => {
    const updatedBlocks = localBlocks.map(block =>
      block.id === blockId ? { ...block, content } : block
    );
    handleBlocksChange(updatedBlocks);
  };

  const updateBlockVisibility = (blockId, visibility) => {
    const updatedBlocks = localBlocks.map(block =>
      block.id === blockId ? { ...block, visibility } : block
    );
    handleBlocksChange(updatedBlocks);
  };

  const deleteBlock = (blockId) => {
    const updatedBlocks = localBlocks
      .filter(block => block.id !== blockId)
      .map((block, index) => ({ ...block, order: index }));
    handleBlocksChange(updatedBlocks);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = localBlocks.findIndex((block) => block.id === active.id);
      const newIndex = localBlocks.findIndex((block) => block.id === over.id);

      const reorderedBlocks = arrayMove(localBlocks, oldIndex, newIndex).map((block, index) => ({
        ...block,
        order: index
      }));

      handleBlocksChange(reorderedBlocks);
    }
  };

  const [uploadingImage, setUploadingImage] = useState(null);

  const handleImageUpload = async (blockId, file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(blockId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use a generic upload endpoint (we'll need to create this or use the OG image endpoint)
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
      const block = localBlocks.find(b => b.id === blockId);
      updateBlock(blockId, {
        ...block.content,
        url: fullUrl
      });

      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const getVideoEmbedUrl = (url) => {
    if (!url) return null;
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoRegex = /vimeo\.com\/(?:.*\/)?(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  };

  const addFaqItem = (blockId) => {
    const block = localBlocks.find(b => b.id === blockId);
    const items = block.content.items || [];
    const newItem = {
      id: `faq_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question: '',
      answer: '',
      order: items.length
    };
    updateBlock(blockId, { items: [...items, newItem] });
  };

  const updateFaqItem = (blockId, itemId, field, value) => {
    const block = localBlocks.find(b => b.id === blockId);
    const items = block.content.items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    updateBlock(blockId, { items });
  };

  const deleteFaqItem = (blockId, itemId) => {
    const block = localBlocks.find(b => b.id === blockId);
    const items = block.content.items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index }));
    updateBlock(blockId, { items });
  };

  const moveFaqItem = (blockId, itemId, direction) => {
    const block = localBlocks.find(b => b.id === blockId);
    const items = [...block.content.items].sort((a, b) => a.order - b.order);
    const currentIndex = items.findIndex(item => item.id === itemId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= items.length) return;

    const reorderedItems = arrayMove(items, currentIndex, newIndex).map((item, index) => ({
      ...item,
      order: index
    }));

    updateBlock(blockId, { items: reorderedItems });
  };

  const renderBlockContent = (block) => {
    switch (block.type) {
      case 'text':
        return (
          <RichTextEditor
            content={block.content.html || ''}
            onChange={(html) => updateBlock(block.id, { html })}
            placeholder="Write your content here..."
          />
        );
      
      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label>Image Source</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={block.content.url || ''}
                  onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })}
                />
                <label htmlFor={`image-upload-${block.id}`}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingImage === block.id}
                    asChild
                  >
                    <span>
                      {uploadingImage === block.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </span>
                  </Button>
                </label>
                <input
                  id={`image-upload-${block.id}`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(block.id, e.target.files[0])}
                  className="hidden"
                />
              </div>
            </div>

            {block.content.url && (
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={block.content.url}
                  alt={block.content.alt || 'Image'}
                  className="w-full h-auto"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/800x400?text=Image+Not+Found';
                  }}
                />
              </div>
            )}

            <div>
              <Label htmlFor={`alt-${block.id}`}>Alt Text</Label>
              <Input
                id={`alt-${block.id}`}
                placeholder="Describe the image for accessibility"
                value={block.content.alt || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, alt: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor={`caption-${block.id}`}>Caption (Optional)</Label>
              <Input
                id={`caption-${block.id}`}
                placeholder="Image caption"
                value={block.content.caption || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor={`link-${block.id}`}>Link URL (Optional)</Label>
              <Input
                id={`link-${block.id}`}
                placeholder="https://example.com"
                value={block.content.link || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, link: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Make the image clickable by adding a link URL
              </p>
            </div>
          </div>
        );

      case 'video':
        const embedUrl = getVideoEmbedUrl(block.content.url);
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`video-url-${block.id}`}>Video URL</Label>
              <Input
                id={`video-url-${block.id}`}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                value={block.content.url || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports YouTube and Vimeo URLs
              </p>
            </div>

            {embedUrl && (
              <div className="border rounded-lg overflow-hidden aspect-video">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            <div>
              <Label htmlFor={`video-caption-${block.id}`}>Caption (Optional)</Label>
              <Input
                id={`video-caption-${block.id}`}
                placeholder="Video caption"
                value={block.content.caption || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })}
              />
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`code-lang-${block.id}`}>Language</Label>
              <select
                id={`code-lang-${block.id}`}
                value={block.content.language || 'javascript'}
                onChange={(e) => updateBlock(block.id, { ...block.content, language: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="php">PHP</option>
                <option value="ruby">Ruby</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="sql">SQL</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
                <option value="bash">Bash</option>
              </select>
            </div>

            <div>
              <Label htmlFor={`code-content-${block.id}`}>Code</Label>
              <Textarea
                id={`code-content-${block.id}`}
                placeholder="Enter your code here..."
                value={block.content.code || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, code: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {block.content.code && (
              <div>
                <Label>Preview</Label>
                <div className="mt-2 rounded-lg overflow-hidden">
                  <SyntaxHighlighter
                    language={block.content.language || 'javascript'}
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, fontSize: '14px' }}
                  >
                    {block.content.code}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor={`code-caption-${block.id}`}>Caption (Optional)</Label>
              <Input
                id={`code-caption-${block.id}`}
                placeholder="Code caption or filename"
                value={block.content.caption || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })}
              />
            </div>
          </div>
        );

      case 'row':
        return (
          <RowEditor
            blockId={block.id}
            content={block.content}
            onUpdate={(newContent) => updateBlock(block.id, newContent)}
          />
        );

      case 'hero':
        return <HeroBlockEditor block={block} updateBlock={updateBlock} />;

      case 'features':
        return <FeatureGridEditor block={block} updateBlock={updateBlock} />;

      case 'cta':
        return <CTABlockEditor block={block} updateBlock={updateBlock} />;

      case 'button':
        return <ButtonBlockEditor block={block} updateBlock={updateBlock} />;

      case 'faq':
        const faqItems = (block.content.items || []).sort((a, b) => a.order - b.order);
        return (
          <div className="space-y-4">
            {faqItems.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No FAQ items yet</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addFaqItem(block.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First FAQ Item
                </Button>
              </div>
            ) : (
              <>
                {faqItems.map((item, index) => (
                  <Card key={item.id} className="border-l-4 border-l-primary">
                    <CardHeader className="p-3 bg-muted/30 flex flex-row items-center justify-between">
                      <span className="text-sm font-medium">FAQ Item {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveFaqItem(block.id, item.id, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveFaqItem(block.id, item.id, 'down')}
                          disabled={index === faqItems.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteFaqItem(block.id, item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <Label>Question</Label>
                        <Input
                          placeholder="What is your question?"
                          value={item.question}
                          onChange={(e) => updateFaqItem(block.id, item.id, 'question', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Answer</Label>
                        <Textarea
                          placeholder="Provide the answer here..."
                          value={item.answer}
                          onChange={(e) => updateFaqItem(block.id, item.id, 'answer', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => addFaqItem(block.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another FAQ Item
                </Button>
              </>
            )}
          </div>
        );

      case 'logo_text':
        return (
          <div className="space-y-4">
            <div>
              <Label>Logo Image URL</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="https://example.com/logo.png"
                  value={block.content.logoUrl || ''}
                  onChange={(e) => updateBlock(block.id, { ...block.content, logoUrl: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`platform-name-${block.id}`}>Platform Name</Label>
              <Input
                id={`platform-name-${block.id}`}
                placeholder="Your Platform Name"
                value={block.content.platformName || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, platformName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor={`link-url-${block.id}`}>Link URL</Label>
              <Input
                id={`link-url-${block.id}`}
                placeholder="/"
                value={block.content.linkUrl || '/'}
                onChange={(e) => updateBlock(block.id, { ...block.content, linkUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Where should the logo link to? (usually homepage)
              </p>
            </div>

            {block.content.logoUrl && (
              <div className="border rounded-lg p-4 flex items-center gap-3">
                <img
                  src={block.content.logoUrl}
                  alt={block.content.platformName}
                  className="h-8 w-8 rounded-sm object-contain"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/32x32?text=Logo';
                  }}
                />
                <span className="font-heading font-bold text-lg">{block.content.platformName}</span>
              </div>
            )}
          </div>
        );

      case 'theme_toggle':
        return (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 text-center">
              <Moon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Theme Toggle Button</p>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically switches between light and dark modes
              </p>
            </div>
          </div>
        );

      case 'auth_buttons':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`signin-text-${block.id}`}>Sign In Button Text</Label>
              <Input
                id={`signin-text-${block.id}`}
                placeholder="Sign in"
                value={block.content.signInText || 'Sign in'}
                onChange={(e) => updateBlock(block.id, { ...block.content, signInText: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor={`signup-text-${block.id}`}>Sign Up Button Text</Label>
              <Input
                id={`signup-text-${block.id}`}
                placeholder="Get Started"
                value={block.content.signUpText || 'Get Started'}
                onChange={(e) => updateBlock(block.id, { ...block.content, signUpText: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor={`dashboard-text-${block.id}`}>Dashboard Button Text</Label>
              <Input
                id={`dashboard-text-${block.id}`}
                placeholder="Dashboard"
                value={block.content.dashboardText || 'Dashboard'}
                onChange={(e) => updateBlock(block.id, { ...block.content, dashboardText: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Shown to logged-in users instead of sign in/up buttons
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-sm border rounded">
                  {block.content.signInText || 'Sign in'}
                </button>
                <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded">
                  {block.content.signUpText || 'Get Started'}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-muted-foreground text-sm">Block type: {block.type}</p>;
    }
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localBlocks.map(block => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {localBlocks.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <Type className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No content blocks yet</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Block
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => addBlock('text')}>
                        <Type className="h-4 w-4 mr-2" />
                        Text Block
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('image')}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Image Block
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('video')}>
                        <Video className="h-4 w-4 mr-2" />
                        Video Block
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('code')}>
                        <Code className="h-4 w-4 mr-2" />
                        Code Block
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('faq')}>
                        <HelpCircle className="h-4 w-4 mr-2" />
                        FAQ Block
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('row')}>
                        <Columns className="h-4 w-4 mr-2" />
                        Row Layout
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('hero')}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Hero Section
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('features')}>
                        <Grid3x3 className="h-4 w-4 mr-2" />
                        Feature Grid
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('cta')}>
                        <Megaphone className="h-4 w-4 mr-2" />
                        Call to Action
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('button')}>
                        <MousePointerClick className="h-4 w-4 mr-2" />
                        Button
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('logo_text')}>
                        <Tag className="h-4 w-4 mr-2" />
                        Logo with Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('theme_toggle')}>
                        <Moon className="h-4 w-4 mr-2" />
                        Theme Toggle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock('auth_buttons')}>
                        <UserCircle className="h-4 w-4 mr-2" />
                        Auth Buttons
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ) : (
              localBlocks.map((block) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  onDelete={deleteBlock}
                  onVisibilityChange={updateBlockVisibility}
                >
                  {renderBlockContent(block)}
                </SortableBlockItem>
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {localBlocks.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Content Block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => addBlock('text')}>
              <Type className="h-4 w-4 mr-2" />
              Text Block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('image')}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image Block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('video')}>
              <Video className="h-4 w-4 mr-2" />
              Video Block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('code')}>
              <Code className="h-4 w-4 mr-2" />
              Code Block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('faq')}>
              <HelpCircle className="h-4 w-4 mr-2" />
              FAQ Block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('row')}>
              <Columns className="h-4 w-4 mr-2" />
              Row Layout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('hero')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Hero Section
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('features')}>
              <Grid3x3 className="h-4 w-4 mr-2" />
              Feature Grid
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('cta')}>
              <Megaphone className="h-4 w-4 mr-2" />
              Call to Action
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('button')}>
              <MousePointerClick className="h-4 w-4 mr-2" />
              Button
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('logo_text')}>
              <Tag className="h-4 w-4 mr-2" />
              Logo with Text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('theme_toggle')}>
              <Moon className="h-4 w-4 mr-2" />
              Theme Toggle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addBlock('auth_buttons')}>
              <UserCircle className="h-4 w-4 mr-2" />
              Auth Buttons
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default ContentBlocks;
