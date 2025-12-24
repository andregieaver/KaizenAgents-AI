/**
 * SortableBlockItem - Draggable wrapper for content blocks
 * Extracted from ContentBlocks.js for better maintainability
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import {
  GripVertical,
  Trash2,
  Type,
  Image as ImageIcon,
  Video,
  Code,
  HelpCircle,
  Columns,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  Grid3x3,
  Megaphone,
  MousePointerClick,
  Tag,
  Moon,
  UserCircle,
  Menu as MenuIcon,
  ClipboardList
} from 'lucide-react';

const getBlockIcon = (type) => {
  const icons = {
    text: <Type className="h-4 w-4" />,
    image: <ImageIcon className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    code: <Code className="h-4 w-4" />,
    faq: <HelpCircle className="h-4 w-4" />,
    row: <Columns className="h-4 w-4" />,
    hero: <Sparkles className="h-4 w-4" />,
    features: <Grid3x3 className="h-4 w-4" />,
    cta: <Megaphone className="h-4 w-4" />,
    button: <MousePointerClick className="h-4 w-4" />,
    logo_text: <Tag className="h-4 w-4" />,
    theme_toggle: <Moon className="h-4 w-4" />,
    auth_buttons: <UserCircle className="h-4 w-4" />,
    menu: <MenuIcon className="h-4 w-4" />,
    waitlist: <ClipboardList className="h-4 w-4" />
  };
  return icons[type] || <Type className="h-4 w-4" />;
};

const getBlockLabel = (type) => {
  const labels = {
    text: 'Text Block',
    image: 'Image Block',
    video: 'Video Block',
    code: 'Code Block',
    faq: 'FAQ Block',
    row: 'Row Layout',
    hero: 'Hero Section',
    features: 'Feature Grid',
    cta: 'Call to Action',
    pricing_cards: 'Pricing Cards',
    agent_grid: 'Agent Grid',
    waitlist: 'Waitlist Form',
    button: 'Button',
    logo_text: 'Logo with Text',
    theme_toggle: 'Theme Toggle',
    auth_buttons: 'Auth Buttons',
    menu: 'Navigation Menu'
  };
  return labels[type] || 'Block';
};

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

  const visibility = block.visibility || { desktop: true, tablet: true, mobile: true };

  const toggleVisibility = (device) => {
    const newVisibility = { ...visibility, [device]: !visibility[device] };
    onVisibilityChange(block.id, newVisibility);
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

export default SortableBlockItem;
export { getBlockIcon, getBlockLabel };
