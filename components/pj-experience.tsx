'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  type AssistantHistoryItem,
  type AvailabilitySlot,
  getConsultationAvailability,
  sendAssistantMessage,
  submitConsultationRequest,
} from '@/app/pj/assistant-api';
import { App as LiveKitApp } from '@/components/app/app';

type Message = AssistantHistoryItem & { id: string };
const makeId = () => `pj_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
export function PjExperience({
  voiceReady,
  agentName,
}: {
  voiceReady: boolean;
  agentName?: string;
}) {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hey! I'm PJ, your PJ Web Development assistant. ðŸ‘‹ I can help with websites, online stores, AI assistants, bookings and project enquiries. What would you like to build?",
    },
  ]);
  const [draft, setDraft] = useState(''),
    [sending, setSending] = useState(false),
    [error, setError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false),
    [bookingOpen, setBookingOpen] = useState(false);
  const [date, setDate] = useState(''),
    [slots, setSlots] = useState<AvailabilitySlot[]>([]),
    [slot, setSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false),
    [booking, setBooking] = us¶»§q«^