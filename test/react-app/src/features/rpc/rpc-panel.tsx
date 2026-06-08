import { useState } from 'react'
import type { Todo, TodoStats } from 'virtual:effect/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Zap,
  Radio,
  BarChart3,
  ArrowRightLeft,
  CheckCircle2,
  X,
  RotateCcw,
  Trash2,
  Pencil,
} from 'lucide-react'

interface RpcPanelProps {
  todos: Todo[]
  stats: TodoStats | null
  onToggleTodo: (id: number) => void
  onDeleteTodoRpc: (id: number) => void
  onUpdateTodoRpc: (id: number, title: string) => void
  loading: Record<string, boolean>
  rpcGlowRef: React.RefObject<HTMLDivElement | null>
  totalRef: React.RefObject<HTMLParagraphElement | null>
  completedRef: React.RefObject<HTMLParagraphElement | null>
  openRef: React.RefObject<HTMLParagraphElement | null>
}

export default function RpcPanel({
  todos,
  stats,
  onToggleTodo,
  onDeleteTodoRpc,
  onUpdateTodoRpc,
  loading,
  rpcGlowRef,
  totalRef,
  completedRef,
  openRef,
}: RpcPanelProps) {
  const [editingTodoRpc, setEditingTodoRpc] = useState<number | null>(null)
  const [editTodoTitle, setEditTodoTitle] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div ref={rpcGlowRef} className="w-8 h-8 rounded-[10px] bg-[#FF5A4A]/10 flex items-center justify-center">
          <Zap className="w-4 h-4 text-[#FF5A4A]" />
        </div>
        <div>
          <h2 className="text-xl font-display tracking-wide">RPC API</h2>
          <p className="text-xs text-muted-foreground/60 font-mono tracking-wider">Type-safe remote calls via Effect Rpc</p>
        </div>
        <Badge variant="outline" className="ml-auto border-[#FF5A4A]/25 text-[#FF5A4A] text-xs font-mono rounded-md">
          <Radio className="w-3 h-3 mr-1" /> LIVE
        </Badge>
      </div>

      {/* Stats Card */}
      <Card className="glass overflow-hidden rounded-[14px]">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] bg-[#FF5A4A]/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-[#FF5A4A]" />
            </div>
            <CardTitle className="text-sm font-medium font-display tracking-wide">Todo Statistics</CardTitle>
          </div>
          <CardDescription className="text-xs font-mono text-muted-foreground/60 tracking-wider">RPC todoStats &middot; Real-time aggregation</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {stats ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="relative overflow-hidden rounded-[10px] bg-white/[0.03] border border-white/5 p-4 text-center group transition-all duration-300 hover:border-white/10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <p ref={totalRef} className="text-3xl font-display tracking-wide text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground/50 font-mono uppercase tracking-widest mt-1">Total</p>
              </div>
              <div className="relative overflow-hidden rounded-[10px] bg-[#10B981]/5 border border-[#10B981]/15 p-4 text-center group transition-all duration-300 hover:border-[#10B981]/30">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <p ref={completedRef} className="text-3xl font-display tracking-wide text-[#10B981]">{stats.completed}</p>
                <p className="text-xs text-[#10B981]/60 font-mono uppercase tracking-widest mt-1">Completed</p>
              </div>
              <div className="relative overflow-hidden rounded-[10px] bg-[#FF5A4A]/5 border border-[#FF5A4A]/15 p-4 text-center group transition-all duration-300 hover:border-[#FF5A4A]/30">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <p ref={openRef} className="text-3xl font-display tracking-wide text-[#FF5A4A]">{stats.open}</p>
                <p className="text-xs text-[#FF5A4A]/60 font-mono uppercase tracking-widest mt-1">Open</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground/40">
              <BarChart3 className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-mono tracking-wider">Loading stats...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RPC Actions Card */}
      <Card className="glass overflow-hidden rounded-[14px]">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] bg-[#FF5A4A]/10 flex items-center justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#FF5A4A]" />
            </div>
            <CardTitle className="text-sm font-medium font-display tracking-wide">RPC Actions</CardTitle>
          </div>
          <CardDescription className="text-xs font-mono text-muted-foreground/60 tracking-wider">RPC toggleTodo &middot; Toggle completion state</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5">
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-hide">
            {todos.map(todo => (
              <div
                key={todo.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-sm bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-200"
              >
                <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground/60 shrink-0 rounded">#{todo.id}</Badge>
                {editingTodoRpc === todo.id ? (
                  <>
                    <Input
                      value={editTodoTitle}
                      onChange={(e) => setEditTodoTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onUpdateTodoRpc(todo.id, editTodoTitle)}
                      className="flex-1 h-6 text-xs font-mono bg-white/[0.03] border-white/10 rounded-[8px]"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#10B981] hover:bg-[#10B981]/10 rounded-[6px]" onClick={() => onUpdateTodoRpc(todo.id, editTodoTitle)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#FF5A4A] hover:bg-[#FF5A4A]/10 rounded-[6px]" onClick={() => { setEditingTodoRpc(null); setEditTodoTitle('') }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 truncate font-mono text-xs tracking-wide ${todo.completed ? 'line-through text-muted-foreground/40' : ''}`}>
                      {todo.title}
                    </span>
                    <div className="flex items-center gap-0.5 w-40 justify-end">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-[#3E63FF] hover:bg-[#3E63FF]/10 rounded-[6px]" onClick={() => { setEditingTodoRpc(todo.id); setEditTodoTitle(todo.title) }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-[#FF5A4A] hover:bg-[#FF5A4A]/10 rounded-[6px]" onClick={() => onDeleteTodoRpc(todo.id)} disabled={loading[`delete-rpc-${todo.id}`]}>
                        {loading[`delete-rpc-${todo.id}`] ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                      <Button
                        data-toggle-btn={todo.id}
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleTodo(todo.id)}
                        disabled={loading[`toggle-${todo.id}`]}
                        className={`h-7 px-2 text-xs font-mono rounded-[8px] ${
                          todo.completed
                            ? 'text-[#FF5A4A] hover:bg-[#FF5A4A]/10'
                            : 'text-[#10B981] hover:bg-[#10B981]/10'
                        }`}
                      >
                        {loading[`toggle-${todo.id}`] ? (
                          <RotateCcw className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                            {todo.completed ? 'Reopen' : 'Complete'}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {todos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground/40">
                <ArrowRightLeft className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-mono tracking-wider">No todos to toggle. Add one in the HTTP panel.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
