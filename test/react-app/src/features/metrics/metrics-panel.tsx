import { Card, CardContent } from '@/components/ui/card'
import { Globe, Zap, CheckCheck, AlertCircle } from 'lucide-react'

interface MetricsPanelProps {
  metricsRef: React.RefObject<HTMLDivElement | null>
  httpCount: number
  rpcCount: number
  successCount: number
  errorCount: number
}

export function MetricsPanel({ metricsRef, httpCount, rpcCount, successCount, errorCount }: MetricsPanelProps) {
  return (
    <div ref={metricsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="glass glass-hover overflow-hidden rounded-[14px]">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">HTTP Calls</p>
            <p className="text-3xl font-display mt-1 tracking-wide">{httpCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#3E63FF]/8 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#3E63FF]" />
          </div>
        </CardContent>
      </Card>
      <Card className="glass glass-hover overflow-hidden rounded-[14px]">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">RPC Calls</p>
            <p className="text-3xl font-display mt-1 tracking-wide">{rpcCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#FF5A4A]/8 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#FF5A4A]" />
          </div>
        </CardContent>
      </Card>
      <Card className="glass glass-hover overflow-hidden rounded-[14px]">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">Success</p>
            <p className="text-3xl font-display mt-1 tracking-wide text-[#10B981]">{successCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#10B981]/8 flex items-center justify-center">
            <CheckCheck className="w-5 h-5 text-[#10B981]" />
          </div>
        </CardContent>
      </Card>
      <Card className="glass glass-hover overflow-hidden rounded-[14px]">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">Errors</p>
            <p className="text-3xl font-display mt-1 tracking-wide text-[#FF5A4A]">{errorCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#FF5A4A]/8 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[#FF5A4A]" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
