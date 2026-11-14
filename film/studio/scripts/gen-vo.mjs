// One Eleven v4 take (Eric) with character timestamps. Usage: node scripts/gen-vo.mjs scripts/vo-v3.txt
import fs from "node:fs"
const key = fs.readFileSync(".env.local", "utf8").match(/^ELEVENLABS_API_KEY=(.*)$/m)[1].replace(/^"|"$/g, "")
const text = fs.readFileSync(process.argv[2], "utf8").trim()
const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/cjVigY5qzO86Huf0OWal/with-timestamps?output_format=mp3_44100_128", {
  method: "POST",
  headers: { "xi-api-key": key, "content-type": "application/json" },
  body: JSON.stringify({ text, model_id: "eleven_v4", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
})
if (!res.ok) { console.error("HTTP", res.status, (await res.text()).slice(0, 300)); process.exit(1) }
const j = await res.json()
fs.writeFileSync("public/vo/vo.mp3", Buffer.from(j.audio_base64, "base64"))
fs.writeFileSync("public/vo/vo-alignment.json", JSON.stringify({ alignment: j.alignment, normalized_alignment: j.normalized_alignment, text }))
const st = j.alignment.character_end_times_seconds
console.log("chars", text.length, "duration", st[st.length - 1].toFixed(2), "s")
