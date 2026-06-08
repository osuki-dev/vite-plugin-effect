import { useState } from 'react'
import type { User } from 'virtual:effect/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, CheckCircle2, X, Pencil, Trash2, RotateCcw } from 'lucide-react'

interface UserPanelProps {
  users: User[]
  onAddUser: (name: string, email: string) => void
  onDeleteUser: (id: number) => void
  onUpdateUser: (id: number, name: string, email: string) => void
  loading: Record<string, boolean>
  highlightedCard: string | null
}

export default function UserPanel({
  users,
  onAddUser,
  onDeleteUser,
  onUpdateUser,
  loading,
  highlightedCard,
}: UserPanelProps) {
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [editingUser, setEditingUser] = useState<number | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editUserEmail, setEditUserEmail] = useState('')

  const handleAdd = () => {
    if (!newUserName.trim() || !newUserEmail.trim()) return
    onAddUser(newUserName, newUserEmail)
    setNewUserName('')
    setNewUserEmail('')
  }

  const startEdit = (user: User) => {
    setEditingUser(user.id)
    setEditUserName(user.name)
    setEditUserEmail(user.email)
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setEditUserName('')
    setEditUserEmail('')
  }

  const handleUpdate = (id: number) => {
    if (!editUserName.trim() || !editUserEmail.trim()) return
    onUpdateUser(id, editUserName, editUserEmail)
    setEditingUser(null)
    setEditUserName('')
    setEditUserEmail('')
  }

  return (
    <Card className="glass overflow-hidden rounded-[14px]">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[#3E63FF]/10 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-[#3E63FF]" />
          </div>
          <CardTitle className="text-sm font-medium font-display tracking-wide">Users</CardTitle>
          <Badge variant="secondary" className="text-xs font-mono rounded-md bg-white/5">{users.length}</Badge>
        </div>
        <CardDescription className="text-xs font-mono text-muted-foreground/60 tracking-wider mt-1">GET /api/users &middot; POST /api/users</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="flex gap-2">
          <Input
            placeholder="Name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            className="text-sm font-mono bg-white/[0.03] border-white/10 focus-visible:ring-[#3E63FF]/20 rounded-[10px]"
          />
          <Input
            placeholder="Email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="text-sm font-mono bg-white/[0.03] border-white/10 focus-visible:ring-[#3E63FF]/20 rounded-[10px]"
          />
          <Button
            onClick={handleAdd}
            disabled={loading.addUser}
            size="sm"
            className="bg-[#3E63FF]/10 text-[#3E63FF] border border-[#3E63FF]/25 hover:bg-[#3E63FF]/20 hover:text-[#3E63FF] rounded-[10px] w-9 h-9 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto scrollbar-hide">
          {users.map((user) => (
            <div
              key={user.id}
              data-user-id={user.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-sm transition-all duration-300 ${
                highlightedCard === `user-${user.id}`
                  ? 'bg-[#3E63FF]/8 border border-[#3E63FF]/25 scale-[1.01]'
                  : 'bg-white/[0.03] border border-white/5 hover:border-white/10'
              }`}
            >
              <div className="w-6 h-6 rounded-[8px] bg-[#3E63FF]/10 flex items-center justify-center text-[10px] font-bold font-mono text-[#3E63FF] shrink-0">
                {user.name[0].toUpperCase()}
              </div>
              {editingUser === user.id ? (
                <>
                  <div className="flex-1 flex gap-1">
                    <Input
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="h-6 text-xs font-mono bg-white/[0.03] border-white/10 rounded-[8px] flex-1"
                      autoFocus
                    />
                    <Input
                      value={editUserEmail}
                      onChange={(e) => setEditUserEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(user.id)}
                      className="h-6 text-xs font-mono bg-white/[0.03] border-white/10 rounded-[8px] flex-1"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-[#10B981] hover:bg-[#10B981]/10 rounded-[6px]"
                    onClick={() => handleUpdate(user.id)}
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
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium tracking-wide truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground/50 font-mono tracking-wider truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-0.5 w-24 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-[#3E63FF] hover:bg-[#3E63FF]/10 rounded-[6px]"
                      onClick={() => startEdit(user)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-[#FF5A4A] hover:bg-[#FF5A4A]/10 rounded-[6px]"
                      onClick={() => onDeleteUser(user.id)}
                      disabled={loading[`delete-user-${user.id}`]}
                    >
                      {loading[`delete-user-${user.id}`] ? (
                        <RotateCcw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                    <Badge variant="outline" className="text-[10px] font-mono rounded border-[#3E63FF]/30 text-[#3E63FF]">
                      #{user.id}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/40">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-mono tracking-wider">No users yet. Create one above.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
