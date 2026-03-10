import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are Amanda, the AI beauty consultant for Zolara Beauty Studio — a premium luxury salon located in Sakasaka, Tamale, Ghana (Opposite CalBank).

Your role is to help clients with:
- Information about our services (hair braiding, nail care, lashes, makeup, facials, wigs)
- Pricing guidance (washing GHS 40-70, cornrows GHS 30-50, braids GHS 160-500+, pedicure GHS 100-250, manicure GHS 60-100, acrylic nails GHS 120-300, lashes GHS 50-330)
- Booking appointments (direct them to the Book Now button or zolarasalon.com/book)
- Gift card purchases
- Opening hours: Monday-Saturday 8:30 AM - 9:00 PM, Closed Sundays
- Contact: 0594 365 314 / 020 884 8707
- Location: Sakasaka, Opposite CalBank, Tamale

Be warm, professional, and brief. You represent a luxury brand. Keep responses concise — 2-3 sentences max unless listing services or prices. Never use em-dashes. Use periods, commas, and colons instead.`;

export default function AmandaWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi, I'm Amanda. How can I help you today? I can tell you about our services, pricing, or help you book an appointment.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: newMessages,
        }),
      });

      const data = await res.json();
      const reply = data?.content?.[0]?.text ?? "I'm sorry, I couldn't process that. Please call us on 0594 365 314.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Please call us on 0594 365 314 or try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ backgroundColor: "#F5EFE6", border: "1px solid #D4B896", maxHeight: "480px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#1C1008" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#C9A87C", color: "#1C1008" }}>A</div>
              <div>
                <p className="text-xs font-bold text-white">Amanda</p>
                <p className="text-[10px]" style={{ color: "#C9A87C" }}>Zolara Beauty Consultant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "320px" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="text-xs leading-relaxed px-3 py-2 rounded-xl max-w-[85%]"
                  style={msg.role === "user"
                    ? { backgroundColor: "#1C1008", color: "#F5EFE6" }
                    : { backgroundColor: "#EDE3D5", color: "#1C1008", border: "1px solid #D4B896" }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: "#EDE3D5", border: "1px solid #D4B896" }}>
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#C9A87C" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t flex gap-2" style={{ borderColor: "#D4B896" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything..."
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{ backgroundColor: "#EDE3D5", border: "1px solid #D4B896", color: "#1C1008" }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "#C9A87C" }}
            >
              <Send className="w-3.5 h-3.5" style={{ color: "#1C1008" }} />
            </button>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105"
        style={{ backgroundColor: "#C9A87C" }}
        aria-label="Chat with Amanda"
      >
        {open ? (
          <X className="w-5 h-5" style={{ color: "#1C1008" }} />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="#1C1008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}
