import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { GripVertical, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { useState } from "react";

interface DraggableListProps {
  title: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
  addButtonText: string;
}

export function DraggableListSection({
  title,
  items,
  onItemsChange,
  addButtonText,
}: DraggableListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);
    onItemsChange(newItems);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const newItems = [...items];
      newItems[editingIndex] = editValue.trim();
      onItemsChange(newItems);
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const addItem = () => {
    onItemsChange([...items, ""]);
    setEditingIndex(items.length);
    setEditValue("");
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold">{title}</Label>
        <Button onClick={addItem} size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          {addButtonText}
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={title.toLowerCase().replace(/\s/g, "-")}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {items.map((item, index) => (
                <Draggable
                  key={`${title}-${index}`}
                  draggableId={`${title}-${index}`}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-2 p-2 rounded-md border ${
                        snapshot.isDragging ? "bg-accent" : "bg-background"
                      }`}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="cursor-grab text-muted-foreground hover:text-foreground"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {editingIndex === index ? (
                        <>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <Button size="icon" variant="ghost" onClick={saveEdit}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit}>
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1">{item || "(empty)"}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(index)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Card>
  );
}
