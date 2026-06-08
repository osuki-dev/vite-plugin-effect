import { useState } from 'react'
import type { Todo } from 'virtual:effect/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ListTodo,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  RotateCcw,
  Pencil,
  X,
} from 'lucide-react'

interface TodoPanelProps {
  todos: Todo[]
  onAddTodo: (title: string) => void
  onToggleTodo: (id: number) => void
  onDeleteTodo: (id: number) => void
  onUpdateTodo: (id: number, title: string) => void
  loading: Record<string, boolean>
  highlightedCard: string | null
}

export default function TodoPanel({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onUpdateTodo,
  loading,
  highlightedCard,
}: TodoPanelProps) {
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null)
  const [editTodoTitle, setEditTodoTitle] = useState('')

  const handleAdd = () => {
    if (!newTodoTitle.trim()) return
    onAddTodo(newTodoTitle.trim())
    setNewTodoTitle('')
  }

  const startEdit = (todo: Todo) => {
    setEditingTodoId(todo.id)
    setEditTodoTitle(todo.title)
  }

  const cancelEdit = () => {
    setEditingTodoId(null)
    setEditTodoTitle('')
  }

  const handleUpdate = (id: number) => {
    if (!editTodoTitle.trim()) return
    onUpdateTodo(id, editTodoTitle.trim())
    setEditingTodoId(null)
    setEditTodoTitle('')
  }

  return (
    <Card className="glass overflow-hidden rounded-[14px]">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#3E63FF]/10 flex items-center justify-center">
              <ListTodo className="w-3.5 h-3.5 text-[#3E63FF]" />
            </div>
            <CardTitle className="text-sm font-medium font-display tracking-wide">Todos</CardTitle>
            <Badge variant="secondary" className="text-xs font-mono rounded-md bg-white/5">{todos.length}</Badge>
          </div>
        </div>
        <CardDescription className="text-xs font-mono text-muted-foreground/60 tracking-wider mt-1">GET /api/todos &middot; POST /api/todos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="flex gap-2">
          <Input
            placeholder="New todo title..."
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="text-sm font-mono bg-white/[0.03] border-white/10 focus-visible:ring-[#3E63FF]/20 rounded-[10px]"
          />
          <Button
            onClick={handleAdd}
            disabled={loading.addTodo}
            size="sm"
            className="bg-[#3E63FF]/10 text-[#3E63FF] border border-[#3E63FF]/25 hover:bg-[#3E63FF]/20 hover:text-[#3E63FF] rounded-[10px] w-9 h-9 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-hide">
          {todos.map(todo => (
            <div
              key={todo.id}
              data-todo-id={todo.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-sm transition-all duration-300 ${
                highlightedCard === `todo-${todo.id}`
                  ? 'bg-[#3E63FF]/8 border border-[#3E63FF]/25 scale-[1.01]'
                  : 'bg-white/[0.03] border border-white/5 hover:border-white/10'
              }`}
            >
              <button onClick={() => onToggleTodo(todo.id)} className="shrink-0">
                {todo.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40" />
                )}
              </button>
              {editingTodoId === todo.id ? (
                <>
                  <Input
                    value={editTodoTitle}
                    onChange={(e) => setEditTodoTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(todo.id)}
                    className="flex-1 h-6 text-xs font-mono bg-white/[0.03] border-white/10 rounded-[8px]"
                    autoFocus
                  />
                  <div className="flex items-center gap-0.5 w-16 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-[#10B981] hover:bg-[#10B981]/10 rounded-[6px]"
                      onClick={() => handleUpdate(todo.id)}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-[#FF5A4A] hover:bg-[#FF5A4A]/10 rounded-[6px]"
                      onClick={cancelEdit}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className={`flex-1 truncate font-mono text-xs tracking-wide ${todo.completed ? 'line-through text-muted-foreground/40' : ''}`}>
                    {todo.title}
                  </span>
                  <div className="flex items-center gap-0.5 w-24 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-[#3E63FF] hover:bg-[#3E63FF]/10 rounded-[6px]"
                      onClick={() => startEdit(todo)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-[#FF5A4A] hover:bg-[#FF5A4A]/10 rounded-[6px]"
                      onClick={() => onDeleteTodo(todo.id)}
                      disabled={loading[`delete-todo-${todo.id}`]}
                    >
                      {loading[`delete-todo-${todo.id}`] ? (
                        <RotateCcw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono rounded ${
                        todo.completed
                          ? 'border-[#10B981]/30 text-[#10B981]'
                          : 'border-[#FF5A4A]/30 text-[#FF5A4A]'
                      }`}
                    >
                      #{todo.id}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          ))}
          {todos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/40">
              <ListTodo className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-mono tracking-wider">No todos yet. Create one above.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
