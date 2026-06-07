import { Sparkles, Braces, ShieldCheck } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-10">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-5 flex items-center justify-between text-xs text-muted-foreground/40 font-mono tracking-wider">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          <span>Built with Effect + Vite + React</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Braces className="w-3 h-3" /> Type-safe
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Schema-validated
          </span>
        </div>
      </div>
    </footer>
  )
}
