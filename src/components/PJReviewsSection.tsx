import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

type Review = { id: string; reviewer_name: string; business_name?: string | null; rating: number; review_text: string };

export default function PJReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('https://chat.pjwebdev.online/api/reviews?source=website')
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setReviews(Array.isArray(data.reviews) ? data.reviews : []))
      .catch(() => setNotice('Reviews are temporarily unavailable. You can still submit feedback below.'));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (rating < 1) { setError('Please choose a star rating.'); return; }
    if (name.trim().length < 2 || message.trim().length < 10) { setError('Add your name and a review of at least 10 characters.'); return; }
    setBusy(true);
    try {
      const response = await fetch('https://chat.pjwebdev.online/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_name: name.trim(), business_name: business.trim(), rating, review_text: message.trim(), source: 'website' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not submit your review.');
      setName(''); setBusiness(''); setRating(0); setMessage('');
      setNotice(data.message || 'Thanks! Your review will appear after moderation.');
    } catch (e: any) { setError(e?.message || 'Could not submit your review.'); }
    finally { setBusy(false); }
  }

  const average = reviews.length ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length : 0;
  return <section className="mt-8 mb-6 rounded-3xl border border-amber-300/15 bg-gradient-to-br from-[#17130f] via-[#10131b] to-[#191018] p-5 sm:p-7 shadow-xl" aria-labelledby="pj-reviews-title">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] uppercase tracking-[0.24em] text-amber-300 font-semibold">Real experiences</p><h2 id="pj-reviews-title" className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Reviews &amp; testimonials</h2><p className="mt-2 text-sm leading-6 text-slate-300">Worked with PJ Web Development? Share your honest experience.</p></div>
      {reviews.length > 0 && <div className="rounded-2xl border border-amber-300/20 px-4 py-3"><div className="flex gap-1 text-amber-300">{[1,2,3,4,5].map(n => <Star key={n} className={'h-4 w-4 ' + (n <= Math.round(average) ? 'fill-current' : '')}/>)}</div><p className="mt-1 text-xs text-slate-400">{average.toFixed(1)} average · {reviews.length} published</p></div>}
    </div>
    {reviews.length > 0 && <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">{reviews.slice(0,6).map(r => <article key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-transform duration-300 hover:-translate-y-0.5"><div className="flex gap-1 text-amber-300">{[1,2,3,4,5].map(n => <Star key={n} className={'h-4 w-4 ' + (n <= r.rating ? 'fill-current' : '')}/>)}</div><p className="mt-3 text-sm leading-6 text-slate-200">{r.review_text}</p><p className="mt-4 text-sm font-semibold text-white">{r.reviewer_name}</p>{r.business_name && <p className="text-xs text-slate-400">{r.business_name}</p>}</article>)}</div>}
    {reviews.length === 0 && <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-300">No published reviews yet. If we've worked together, be the first to share your experience.</p>}
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><label className="text-sm font-semibold text-white">Your rating · select 1–5 stars</label><div className="flex items-center gap-1">{[1,2,3,4,5].map(n => <button key={n} type="button" onClick={() => setRating(n)} aria-label={n + ' stars'} aria-pressed={rating === n} className="rounded-lg p-1 text-amber-300 hover:scale-110 transition-transform"><Star className={'h-6 w-6 ' + (n <= rating ? 'fill-current' : '')}/></button>)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><input value={name} onChange={e => setName(e.target.value)} maxLength={80} required placeholder="Your name" aria-label="Your name" className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder:text-slate-500"/><input value={business} onChange={e => setBusiness(e.target.value)} maxLength={100} placeholder="Business name (optional)" aria-label="Business name (optional)" className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder:text-slate-500"/></div>
      <textarea value={message} onChange={e => setMessage(e.target.value)} minLength={10} maxLength={1200} required rows={3} placeholder="What was your experience like?" aria-label="Write your review" className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white placeholder:text-slate-500"/>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">Reviews are checked for spam before publication. Honest feedback is welcome.</p><button disabled={busy} className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-[#21170c] hover:bg-amber-200 disabled:opacity-60">{busy ? 'Submitting…' : 'Submit review'}</button></div>
    </form>
  </section>;
}
