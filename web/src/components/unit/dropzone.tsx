import { useRef, useState, type DragEvent } from "react"
import { FileText, ImageIcon, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

const ACCEPT = ["image/png", "image/jpeg", "application/pdf"]
const MAX = 6 * 1024 * 1024

export type DropzoneProps = {
  onFile: (f: File) => void
  file?: File | null
  disabled?: boolean
  className?: string
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Custom file picker: a large square drop area; the native input stays hidden. PNG, JPEG or PDF up to 6 MB. */
export function Dropzone({ onFile, file, disabled, className }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const take = (f: File | undefined) => {
    if (!f) return
    if (!ACCEPT.includes(f.type)) return setProblem("That file type is not supported. Use a PNG, JPEG or PDF.")
    if (f.size > MAX) return setProblem("That file is over 6 MB.")
    setProblem(null)
    onFile(f)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (!disabled) take(e.dataTransfer.files[0])
  }
  const Icon = file ? (file.type === "application/pdf" ? FileText : ImageIcon) : Upload

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "group flex min-h-[13rem] w-full cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed px-6 py-10 text-center transition-colors duration-500 ease-gl disabled:cursor-not-allowed disabled:opacity-50",
          over ? "border-ink bg-lav-soft" : "border-[var(--gray-300)] bg-band hover:border-ink hover:bg-lav-soft",
        )}
      >
        <span className="grid size-14 place-items-center bg-white text-ink transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
          <Icon className="size-6" />
        </span>
        {file ? (
          <span className="flex flex-col gap-1">
            <span className="text-[1.0625rem] font-semibold break-all text-ink">{file.name}</span>
            <span className="text-[0.9375rem] text-muted-foreground">
              {kb(file.size)} · <span className="wipe group-hover:after:scale-x-100">choose another file</span>
            </span>
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <span className="text-[1.0625rem] font-semibold text-ink">Drop your payslip here, or click to choose</span>
            <span className="text-[0.9375rem] text-muted-foreground">PNG, JPEG or PDF · up to 6 MB · it is read once and never stored</span>
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          take(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      {problem && <p className="text-[0.9375rem] font-medium text-indigo" role="alert">{problem}</p>}
    </div>
  )
}
