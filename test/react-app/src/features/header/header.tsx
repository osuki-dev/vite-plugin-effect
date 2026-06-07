import { Button } from '@/components/ui/button'
import { Hexagon, Wifi, WifiOff, Clock, RotateCcw } from 'lucide-react'

interface HeaderProps {
  connected: boolean
  avgDuration: number
  onRefresh: () => void
  loadingInit: boolean
  headerRef: React.RefObject<HTMLElement | null>
  hexagonRef: React.RefObject<HTMLDivElement | null>
  statusRef: React.RefObject<HTMLDivElement | null>
}

export default function Header({
  connected,
  avgDuration,
  onRefresh,
  loadingInit,
  headerRef,
  hexagonRef,
  statusRef,
}: HeaderProps) {
  return (
    <header ref={headerRef} className="sticky top-0 z-50 glass-strong border-b border-border/40">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div ref={hexagonRef} className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/15">
              <Hexagon className="w-4 h-4 text-primary-foreground" />
            </div>
            <div ref={statusRef} className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] rounded-full border-2 border-background animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-display tracking-wide leading-none">
              Effect Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass">
            {connected ? (
              <>
                <Wifi className="w-3 h-3 text-[#10B981]" />
                <span className="text-xs text-[#10B981] font-mono tracking-wider">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-[#FF5A4A]" />
                <span className="text-xs text-[#FF5A4A] font-mono tracking-wider">Offline</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-mono tracking-wider">{avgDuration}ms avg</span>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-[10px] glass hover:bg-white/5" onClick={onRefresh} disabled={loadingInit}>
            <RotateCcw className={`w-4 h-4 ${loadingInit ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </header>
  )
}
