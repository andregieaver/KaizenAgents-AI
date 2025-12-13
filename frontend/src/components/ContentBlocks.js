import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import {
  Plus,
  GripVertical,
  Trash2,
  Type,
  Image as ImageIcon,
  Video,
  Code
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
                        <DropdownMenuItem disabled>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Image Block (Coming Soon)
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Video className="h-4 w-4 mr-2" />
                          Video Block (Coming Soon)
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Code className="h-4 w-4 mr-2" />
                          Code Block (Coming Soon)
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
            <DropdownMenuItem disabled>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image Block (Coming Soon)
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Video className="h-4 w-4 mr-2" />
              Video Block (Coming Soon)
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Code className="h-4 w-4 mr-2" />
              Code Block (Coming Soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default ContentBlocks;
