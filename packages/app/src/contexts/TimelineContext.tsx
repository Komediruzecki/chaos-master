import { createContext, createSignal } from 'solid-js'
import { createTimelineState } from '@/utils/timeline'
import { useContextSafe } from '@/utils/useContextSafe'
import type { JSX } from 'solid-js'

export type TimelineState = ReturnType<typeof createTimelineState>

export const TimelineContext = createContext<ReturnType<typeof createSignal<TimelineState>>>(createSignal(createTimelineState()))

export const TimelineContextProvider = TimelineContext.Provider

export function createTimelineStateSignal() {
  return createSignal(createTimelineState())
}

export function useTimeline() {
  return useContextSafe(TimelineContext, 'useTimeline', 'TimelineContextProvider')()
}

export function TimelineProvider(props: { children: JSX.Element }) {
  const [timeline] = createTimelineStateSignal()
  return (
    <TimelineContext.Provider value={timeline}>
      {props.children}
    </TimelineContext.Provider>
  )
}
