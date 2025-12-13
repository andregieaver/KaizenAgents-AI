import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
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
  Loader2
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
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

const ContentBlocks = ({ blocks, onChange }) => {
  const [localBlocks, setLocalBlocks] = useState(blocks || []);

  const handleBlocksChange = (newBlocks) => {
    setLocalBlocks(newBlocks);
    onChange(newBlocks);
  };

  const addBlock = (type) => {
    const newBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      content: type === 'text' ? { html: '' } : {},
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

  const deleteBlock = (blockId) => {
    const updatedBlocks = localBlocks
      .filter(block => block.id !== blockId)
      .map((block, index) => ({ ...block, order: index }));
    handleBlocksChange(updatedBlocks);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(localBlocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reorderedBlocks = items.map((block, index) => ({
      ...block,
      order: index
    }));

    handleBlocksChange(reorderedBlocks);
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

      default:
        return <p className="text-muted-foreground text-sm">Block type: {block.type}</p>;
    }
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
      default:
        return 'Block';
    }
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="content-blocks">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ) : (
                localBlocks.map((block, index) => (
                  <Draggable key={block.id} draggableId={block.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? 'shadow-lg' : ''}
                      >
                        <CardHeader className="p-3 bg-muted/30 flex flex-row items-center gap-3">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            {getBlockIcon(block.type)}
                            <span className="text-sm font-medium">
                              {getBlockLabel(block.type)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteBlock(block.id)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-4">
                          {renderBlockContent(block)}
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

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
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default ContentBlocks;
