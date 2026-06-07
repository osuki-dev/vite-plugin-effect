import { useState, useEffect, useRef, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from '@/lib/gsap-setup'
import { client } from 'virtual:effect/client'
import type { Todo, User, TodoStats } from './lib/effect-client'
import { Badge } from '@/components/ui/badge'
import { Globe, Radio } from 'lucide-react'
import Header from '@/features/header/header'
import { MetricsPanel } from '@/features/metrics/metrics-panel'
import TodoPanel from '@/features/todos/todo-panel'
import UserPanel from '@/features/users/user-panel'
import RpcPanel from '@/features/rpc/rpc-panel'
import LogPanel, { type ApiLogEntry } from '@/features/logs/log-panel'
import Footer from '@/features/footer/footer'

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

function animateCounter(ref: React.RefObject<HTMLParagraphElement | null>, endValue: number, duration = 0.6) {
  if (!ref.current) return
  const obj = { val: parseInt(ref.current.textContent || '0', 10) }
  gsap.to(obj, {
    val: endValue,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      if (ref.current) {
        ref.current.textContent = Math.round(obj.val).toString()
      }
    },
  })
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [logs, setLogs] = useState<ApiLogEntry[]>([])
  const [connected, setConnected] = useState(true)
  const [highlightedCard, setHighlightedCard] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)
  const httpPanelRef = useRef<HTMLDivElement>(null)
  const rpcPanelRef = useRef<HTMLDivElement>(null)
  const apiLogRef = useRef<HTMLDivElement>(null)
  const totalRef = useRef<HTMLParagraphElement>(null)
  const completedRef = useRef<HTMLParagraphElement>(null)
  const openRef = useRef<HTMLParagraphElement>(null)
  const hexagonRef = useRef<HTMLDivElement>(null)
  const httpGlowRef = useRef<HTMLDivElement>(null)
  const rpcGlowRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((entry: Omit<ApiLogEntry, 'id' | 'timestamp' | 'expanded'>) => {
    const newLog: ApiLogEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date(),
      expanded: true,
    }
    setLogs(prev => [newLog, ...prev].slice(0, 100))
  }, [])

  const httpCount = logs.filter(l => l.type === 'http').length
  const rpcCount = logs.filter(l => l.type === 'rpc').length
  const successCount = logs.filter(l => l.status === 'success').length
  const errorCount = logs.filter(l => l.status === 'error').length
  const avgDuration = logs.length > 0 ? Math.round(logs.reduce((a, b) => a + b.duration, 0) / logs.length) : 0

  const loadData = async () => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, init: true }))
    let hasError = false

    try {
      const todoList = await client.api.todos.getTodos() as Todo[]
      setTodos(todoList)
      addLog({ type: 'http', method: 'GET', endpoint: '/api/todos', request: {}, response: todoList, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      hasError = true
      addLog({ type: 'http', method: 'GET', endpoint: '/api/todos', request: {}, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    }

    const userStart = performance.now()
    try {
      const userList = await client.api.users.getUsers() as User[]
      setUsers(userList)
      addLog({ type: 'http', method: 'GET', endpoint: '/api/users', request: {}, response: userList, duration: Math.round(performance.now() - userStart), status: 'success' })
    } catch (e) {
      hasError = true
      addLog({ type: 'http', method: 'GET', endpoint: '/api/users', request: {}, response: { error: String(e) }, duration: Math.round(performance.now() - userStart), status: 'error' })
    }

    const rpcStart = performance.now()
    try {
      const todoStats = await client.rpc.todoStats({})
      setStats(todoStats)
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'todoStats', request: {}, response: todoStats, duration: Math.round(performance.now() - rpcStart), status: 'success' })
    } catch (e) {
      hasError = true
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'todoStats', request: {}, response: { error: String(e) }, duration: Math.round(performance.now() - rpcStart), status: 'error' })
    }

    setConnected(!hasError)
    setLoading(prev => ({ ...prev, init: false }))
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (stats) {
      animateCounter(totalRef, stats.total)
      animateCounter(completedRef, stats.completed)
      animateCounter(openRef, stats.open)
    }
  }, [stats])

  useGSAP(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    if (headerRef.current) {
      tl.from(headerRef.current, { y: -20, opacity: 0, duration: 0.6 })
    }
    if (metricsRef.current && metricsRef.current.children.length > 0) {
      tl.from(metricsRef.current.children, { y: 20, opacity: 0, stagger: 0.1, duration: 0.5 }, '-=0.3')
    }
    if (httpPanelRef.current) {
      tl.from(httpPanelRef.current, { y: 30, opacity: 0, duration: 0.6 }, '-=0.2')
    }
    if (rpcPanelRef.current) {
      tl.from(rpcPanelRef.current, { y: 30, opacity: 0, duration: 0.6 }, '-=0.1')
    }
    if (apiLogRef.current) {
      tl.from(apiLogRef.current, { scale: 0.98, opacity: 0, duration: 0.7 }, '-=0.4')
    }
  }, { scope: containerRef })

  useGSAP(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const logEntries = containerRef.current?.querySelectorAll('.log-entry')
    if (logEntries && logEntries.length > 0) {
      gsap.from(logEntries, { x: -30, opacity: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out', scrollTrigger: { trigger: apiLogRef.current, start: 'top 90%', toggleActions: 'play none none none' } })
    }
  }, { scope: containerRef, dependencies: [logs] })

  useGSAP(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    if (hexagonRef.current) {
      gsap.to(hexagonRef.current, { rotation: 360, duration: 20, repeat: -1, ease: 'none' })
      gsap.to(hexagonRef.current, { scale: 1.05, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }
    if (httpGlowRef.current) {
      gsap.to(httpGlowRef.current, { boxShadow: '0 0 24px rgba(62, 99, 255, 0.35)', duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }
    if (rpcGlowRef.current) {
      gsap.to(rpcGlowRef.current, { boxShadow: '0 0 24px rgba(255, 90, 74, 0.35)', duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }
    if (statusRef.current) {
      gsap.to(statusRef.current, { scale: 1.2, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }
    if (metricsRef.current) {
      gsap.to(metricsRef.current, { y: -3, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }
  }, { scope: containerRef })

  const addTodo = async (title: string) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, addTodo: true }))
    try {
      const todo = await client.api.todos.createTodo({ title })
      setTodos(prev => [...prev, todo])
      addLog({ type: 'http', method: 'POST', endpoint: '/api/todos', request: { title }, response: todo, duration: Math.round(performance.now() - start), status: 'success' })
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-todo-id="${todo.id}"]`)
        if (el) gsap.fromTo(el, { y: -20, scale: 0.8, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' })
      })
      setHighlightedCard('todo-' + todo.id)
      setTimeout(() => setHighlightedCard(null), 1500)
      const newStats = await client.rpc.todoStats({})
      setStats(newStats)
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'todoStats', request: {}, response: newStats, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      addLog({ type: 'http', method: 'POST', endpoint: '/api/todos', request: { title }, response: { error: String(e) }, duration: performance.now() - start, status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, addTodo: false }))
    }
  }

  const addUser = async (name: string, email: string) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, addUser: true }))
    try {
      const user = await client.api.users.createUser({ name, email })
      setUsers(prev => [...prev, user])
      addLog({ type: 'http', method: 'POST', endpoint: '/api/users', request: { name, email }, response: user, duration: performance.now() - start, status: 'success' })
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-user-id="${user.id}"]`)
        if (el) gsap.fromTo(el, { y: -20, scale: 0.8, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' })
      })
      setHighlightedCard('user-' + user.id)
      setTimeout(() => setHighlightedCard(null), 1500)
    } catch (e) {
      addLog({ type: 'http', method: 'POST', endpoint: '/api/users', request: { name, email }, response: { error: String(e) }, duration: performance.now() - start, status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, addUser: false }))
    }
  }

  const toggleTodo = async (id: number) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`toggle-${id}`]: true }))
    try {
      const updated = await client.rpc.toggleTodo({ id })
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
      const btnEl = document.querySelector(`[data-toggle-btn="${id}"]`)
      if (btnEl) gsap.fromTo(btnEl, { scale: 1 }, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' })
      const newStats = await client.rpc.todoStats({})
      setStats(newStats)
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'toggleTodo', request: { id }, response: updated, duration: Math.round(performance.now() - start), status: 'success' })
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'todoStats', request: {}, response: newStats, duration: 0, status: 'success' })
    } catch (e) {
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'toggleTodo', request: { id }, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`toggle-${id}`]: false }))
    }
  }

  const deleteTodoHttp = async (id: number) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`delete-todo-${id}`]: true }))
    try {
      const deleted = await client.api.todos.deleteTodo({ params: { id } })
      const el = document.querySelector(`[data-todo-id="${id}"]`)
      if (el) await gsap.to(el, { scale: 0.9, x: 50, opacity: 0, duration: 0.3, ease: 'power2.in' })
      setTodos(prev => prev.filter(t => t.id !== id))
      addLog({ type: 'http', method: 'DELETE', endpoint: `/api/todos/${id}`, request: {}, response: deleted, duration: Math.round(performance.now() - start), status: 'success' })
      const newStats = await client.rpc.todoStats({})
      setStats(newStats)
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'todoStats', request: {}, response: newStats, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      addLog({ type: 'http', method: 'DELETE', endpoint: `/api/todos/${id}`, request: {}, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`delete-todo-${id}`]: false }))
    }
  }

  const updateTodoHttp = async (id: number, title: string) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`update-todo-${id}`]: true }))
    try {
      const updated = await client.api.todos.updateTodo({ params: { id }, payload: { title } })
      setTodos(prev => prev.map(t => t.id === id ? updated : t))
      addLog({ type: 'http', method: 'PATCH', endpoint: `/api/todos/${id}`, request: { title }, response: updated, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      addLog({ type: 'http', method: 'PATCH', endpoint: `/api/todos/${id}`, request: { title }, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`update-todo-${id}`]: false }))
    }
  }

  const deleteUserHttp = async (id: number) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`delete-user-${id}`]: true }))
    try {
      const deleted = await client.api.users.deleteUser({ params: { id } })
      const el = document.querySelector(`[data-user-id="${id}"]`)
      if (el) await gsap.to(el, { scale: 0.9, x: 50, opacity: 0, duration: 0.3, ease: 'power2.in' })
      setUsers(prev => prev.filter(u => u.id !== id))
      addLog({ type: 'http', method: 'DELETE', endpoint: `/api/users/${id}`, request: {}, response: deleted, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      addLog({ type: 'http', method: 'DELETE', endpoint: `/api/users/${id}`, request: {}, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`delete-user-${id}`]: false }))
    }
  }

  const updateUserHttp = async (id: number, name: string, email: string) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`update-user-${id}`]: true }))
    try {
      const updated = await client.api.users.updateUser({ params: { id }, payload: { name, email } })
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      addLog({ type: 'http', method: 'PATCH', endpoint: `/api/users/${id}`, request: { name, email }, response: updated, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      addLog({ type: 'http', method: 'PATCH', endpoint: `/api/users/${id}`, request: { name, email }, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`update-user-${id}`]: false }))
    }
  }

  const deleteTodoRpc = async (id: number) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`delete-rpc-${id}`]: true }))
    try {
      const deleted = await client.rpc.deleteTodo({ id })
      const el = document.querySelector(`[data-todo-id="${id}"]`)
      if (el) await gsap.to(el, { scale: 0.9, x: 50, opacity: 0, duration: 0.3, ease: 'power2.in' })
      setTodos(prev => prev.filter(t => t.id !== id))
      const newStats = await client.rpc.todoStats({})
      setStats(newStats)
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'deleteTodo', request: { id }, response: deleted, duration: Math.round(performance.now() - start), status: 'success' })
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'todoStats', request: {}, response: newStats, duration: 0, status: 'success' })
    } catch (e) {
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'deleteTodo', request: { id }, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`delete-rpc-${id}`]: false }))
    }
  }

  const updateTodoRpc = async (id: number, title: string) => {
    const start = performance.now()
    setLoading(prev => ({ ...prev, [`update-rpc-${id}`]: true }))
    try {
      const updated = await client.rpc.updateTodo({ id, title })
      setTodos(prev => prev.map(t => t.id === id ? updated : t))
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'updateTodo', request: { id, title }, response: updated, duration: Math.round(performance.now() - start), status: 'success' })
    } catch (e) {
      addLog({ type: 'rpc', method: 'RPC', endpoint: 'updateTodo', request: { id, title }, response: { error: String(e) }, duration: Math.round(performance.now() - start), status: 'error' })
    } finally {
      setLoading(prev => ({ ...prev, [`update-rpc-${id}`]: false }))
    }
  }

  const clearLogs = () => setLogs([])

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      <Header
        connected={connected}
        avgDuration={avgDuration}
        onRefresh={loadData}
        loadingInit={loading.init}
        headerRef={headerRef}
        hexagonRef={hexagonRef}
        statusRef={statusRef}
      />

      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8 space-y-8">
        <MetricsPanel
          metricsRef={metricsRef}
          httpCount={httpCount}
          rpcCount={rpcCount}
          successCount={successCount}
          errorCount={errorCount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div ref={httpPanelRef} className="space-y-4">
            <div className="flex items-center gap-3">
              <div ref={httpGlowRef} className="w-8 h-8 rounded-[10px] bg-[#3E63FF]/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-[#3E63FF]" />
              </div>
              <div>
                <h2 className="text-xl font-display tracking-wide">HTTP API</h2>
                <p className="text-xs text-muted-foreground/60 font-mono tracking-wider">REST endpoints via Effect HttpApi</p>
              </div>
              <Badge variant="outline" className="ml-auto border-[#3E63FF]/25 text-[#3E63FF] text-xs font-mono rounded-md">
                <Radio className="w-3 h-3 mr-1" /> LIVE
              </Badge>
            </div>
            <TodoPanel
              todos={todos}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodoHttp}
              onUpdateTodo={updateTodoHttp}
              loading={loading}
              highlightedCard={highlightedCard}
            />
            <UserPanel
              users={users}
              onAddUser={addUser}
              onDeleteUser={deleteUserHttp}
              onUpdateUser={updateUserHttp}
              loading={loading}
              highlightedCard={highlightedCard}
            />
          </div>

          <div ref={rpcPanelRef} className="space-y-4">
            <RpcPanel
              todos={todos}
              stats={stats}
              onToggleTodo={toggleTodo}
              onDeleteTodoRpc={deleteTodoRpc}
              onUpdateTodoRpc={updateTodoRpc}
              loading={loading}
              rpcGlowRef={rpcGlowRef}
              totalRef={totalRef}
              completedRef={completedRef}
              openRef={openRef}
            />
          </div>
        </div>

        <LogPanel logs={logs} onClearLogs={clearLogs} apiLogRef={apiLogRef} />
      </main>

      <Footer />
    </div>
  )
}
