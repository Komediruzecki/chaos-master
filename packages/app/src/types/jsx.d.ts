import type { Component,JSX  } from 'solid-js'

type KeyframeTargetWrapperProps = {
  parameterPath: string
  children: JSX.Element
  class?: string
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'withKeyframeTarget': KeyframeTargetWrapperProps & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'children'>
    }
  }
}
