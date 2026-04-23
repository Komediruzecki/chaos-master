import { createContext, createSignal } from 'solid-js'
import { createTimelineState } from '@/utils/timeline'
import { useContextSafe } from '@/utils/useContextSafe'
import type { JSX } from 'solid-js'

export type TimelineContextValue = ReturnType<typeof createTimelineState>

export const TimelineContext = createContext<TimelineContextValue>({} as TimelineContextValue)

export const TimelineContextProvider = TimelineContext.Provider

export function useTimeline() {
  return useContextSafe(TimelineContext, 'useTimeline', 'TimelineContextProvider')()
}

export function createTimelineStateSignal() {
  return createSignal(createTimelineState())
}

export function TimelineProvider(props: { children: JSX.Element }) {
  const [timeline] = createTimelineStateSignal()
  return (
    <TimelineContext.Provider value={timeline()}>
      {props.children}
    </TimelineContext.Provider>
  )
}
