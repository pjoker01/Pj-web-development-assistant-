import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Bot, CheckCircle2, MessageCircle, Mic, ShieldCheck, Sparkles } from 'lucide-react';

const AGENT_ID = 'agent_7301m5zb2r3efxr9s2dtr76m4fjy';
const WIDGET_SCRIPT = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
const BOOKING_API = 'https://chat.pjwebdev.online/api/pj-assistant';
type Slot = { start: string; end: string; available: boolean };
const localDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };

export default function PJAssistant() {
  const widgetContainer = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(localDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSlots([]);
    setSelectedSlot('');
    setBookingError('');
    fetch(`${BOOKING_API}/booking-availability?date=${encodeURIComponent(date)}`)
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load availability.'); return body; })
      .then(body => { if (!cancelled) setSlots(Array.isArray(body.slots) ? body.slots.filter((slot: Slot) => slot.available) : []); })
      .catch(error => { if (!cancelled) setBookingError(error.message || 'Unable to load availability.'); });
    return () => { cancelled = true; };
  }, [date]);

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookingLoading(true); setBookingError(''); setBookingMessage('');
    try {
      if (!selectedSlot) throw new Error('Please choose an available appointment time.');
      const response = await fetch(`${BOOKING_API}/booking-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, customerContact, requestedStart: selectedSlot, serviceName: 'Website consultation', notes: projectNotes, idempotencyKey: `pjassistant-${crypto.randomUUID()}` })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to send your request.');
      setBookingMessage(body.message || 'Request received. PJ will review it before confirming.');
      setCustomerName(''); setCustomerContact(''); setProjectNotes(''); setSelectedSlot('');
    } catch (error: any) { setBookingError(error.message || 'Unable to send your request. Please try again.'); }
    finally { setBookingLoading(false); }
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'PJ Assistant | PJ Web Development';
    let script = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SCRIPT}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = WIDGET_SCRIPT;
      script.async = true;
      script.type = 'text/javascript';
      document.body.appendChild(script);
    }
    const widget = document.createElement('elevenlabs-convai');
    widget.setAttribute('agent-id', AGENT_ID);
    widgetContainer.current?.appendChild(widget);
    return () => {
      widget.remove();
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#090b10] text-[#f7f5f0]">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-48 left-1/2 h-[34rem] w-[44rem] -translate-x-1/2 rounded-full bg-orange-500/10 blur-[120px]" />
        <div className="absolute right-[-10rem] top-[35%] h-80 w-80 rounded-full bg-amber-400/5 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="https://pjwebdev.online" className="flex items-center gap-3" aria-label="PJ Web Development homepage">
          <img src="/pj-web-development-logo.webp" alt="PJ Web Development" className="h-11 w-11 rounded-xl object-contain" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide">PJ WEB DEVELOPMENT</span>
            <span className="mt-1 block text-xs text-white/45">Your Vision. Our Code.</span>
          </span>
        </a>
        <a href="https://pjwebdev.online" className="hidden items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-orange-300/40 hover:text-white sm:inline-flex">
          Main website <ArrowUpRight size={15} />
        </a>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100svh-90px)] w-full max-w-6xl items-center gap-12 px-5 pb-28 pt-10 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-20 md:pt-4">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/[0.07] px-3.5 py-2 text-xs font-medium text-orange-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-300" />
            Your digital business assistant
          </div>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl">
            Meet <span className="bg-gradient-to-r from-orange-300 via-amber-200 to-orange-500 bg-clip-text text-transparent">PJ Assistant.</span>
            <br />Let's build your next idea.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
            Get clear answers about PJ Web Development, explore digital solutions for your business, and start planning your project — through text or voice.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-300/10 text-orange-200"><MessageCircle size={19} /></span>
              <span><span className="block text-sm font-medium">Ask in your own words</span><span className="mt-1 block text-xs leading-5 text-white/45">Services, project ideas and support.</span></span>
            </div>
            <div className="flex gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-300/10 text-orange-200"><Mic size={19} /></span>
              <span><span className="block text-sm font-medium">Talk by voice</span><span className="mt-1 block text-xs leading-5 text-white/45">Use the microphone option in the assistant.</span></span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/45">
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-orange-300" /> Friendly project guidance</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-orange-300" /> AI assistant, not a human</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-orange-400/15 via-transparent to-amber-200/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-orange-200/20 bg-[#10141d]/95 p-6 shadow-2xl shadow-black/40 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-200/20 bg-gradient-to-br from-orange-300/20 to-amber-300/5 text-orange-200"><Bot size={28} /></div>
              <div>
                <p className="font-semibold">PJ Assistant</p>
                <p className="mt-1 text-xs text-white/45">PJ Web Development</p>
              </div>
              <Sparkles size={18} className="ml-auto text-orange-200/70" />
            </div>
            <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-200/80">Start a conversation</p>
              <p className="mt-3 text-sm leading-6 text-white/70">Hi! I'm PJ Assistant, the AI business assistant for PJ Web Development. What are you looking to build or improve online?</p>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/55">Open the assistant chat bubble to start a text conversation or switch to voice. If it doesn't appear, the assistant may not yet be enabled for public access.</p>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/40">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" /> Please share only the details needed for your enquiry. Do not enter passwords or payment details.
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-white/35"><span className="h-1.5 w-1.5 rounded-full bg-orange-300" /> Text and voice powered by the PJ Assistant service</div>
          </div>
        </div>
      </section>

      <div id="book-consultation" className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8">
        <div className="overflow-hidden rounded-[1.75rem] border border-orange-200/20 bg-[#10141d]/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-300/10 text-orange-200"><CheckCircle2 size={21} /></div>
            <div><h2 className="text-xl font-semibold">Book a project consultation</h2><p className="mt-1 text-sm leading-6 text-white/55">Choose an available time and send a request directly to PJ. Your appointment is only confirmed after PJ approves it.</p></div>
          </div>
          <form onSubmit={submitBooking} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-white/70">Preferred date
              <input type="date" min={localDate()} value={date} onChange={e => setDate(e.target.value)} required className="rounded-xl border border-white/10 bg-[#090b10] px-3 py-3 text-white outline-none focus:border-orange-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-white/70">Available time
              <select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} required className="rounded-xl border border-white/10 bg-[#090b10] px-3 py-3 text-white outline-none focus:border-orange-300/50">
                <option value="">Choose a time</option>
                {slots.map(slot => <option key={slot.start} value={slot.start}>{new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-white/70">Your name
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} minLength={2} maxLength={120} required placeholder="Full name" className="rounded-xl border border-white/10 bg-[#090b10] px-3 py-3 text-white outline-none focus:border-orange-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-white/70">Phone or email
              <input value={customerContact} onChange={e => setCustomerContact(e.target.value)} minLength={5} maxLength={160} required placeholder="How PJ can reach you" className="rounded-xl border border-white/10 bg-[#090b10] px-3 py-3 text-white outline-none focus:border-orange-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-white/70 sm:col-span-2">What would you like to discuss? <span className="text-xs text-white/35">(optional)</span>
              <textarea value={projectNotes} onChange={e => setProjectNotes(e.target.value)} maxLength={1000} rows={3} placeholder="Website, online store, AI assistant, or another project..." className="resize-y rounded-xl border border-white/10 bg-[#090b10] px-3 py-3 text-white outline-none focus:border-orange-300/50" />
            </label>
            {bookingError && <p role="alert" className="sm:col-span-2 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{bookingError}{bookingError.includes('calendar') || bookingError.includes('availability') ? ' You can also contact PJ through the main website.' : ''}</p>}
            {bookingMessage && <p role="status" className="sm:col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-100">{bookingMessage}</p>}
            {!bookingError && !slots.length && <p className="sm:col-span-2 text-xs text-white/40">No available times are currently listed for this date. Try another date.</p>}
            <button type="submit" disabled={bookingLoading || !slots.length} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-300 to-amber-200 px-5 py-3.5 text-sm font-semibold text-[#17100a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{bookingLoading ? 'Sending request…' : 'Request consultation'} <ArrowUpRight size={16} /></button>
          </form>
          <p className="mt-4 text-xs leading-5 text-white/35">Submitting this form sends a booking request, not a confirmed appointment. Please do not include passwords or payment details.</p>
        </div>
      </div>


      <footer className="relative z-10 border-t border-white/[0.08] px-5 py-6 text-center text-xs text-white/35">
        © {new Date().getFullYear()} PJ Web Development · Your Vision. Our Code. Together Online.
      </footer>

      {/** Official ElevenLabs widget. Voice and text are enabled in the agent's widget configuration. */}
      <div ref={widgetContainer} />
    </main>
  );
}
