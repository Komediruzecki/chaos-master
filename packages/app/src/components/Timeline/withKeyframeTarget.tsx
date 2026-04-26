import { useKeyframeTarget } from '@/contexts/KeyframeTargetContext'
import type { JSX } from 'solid-js'

type KeyframeTargetWrapperProps = {
  parameterPath: string
  children: JSX.Element
  class?: string
}

export function withKeyframeTarget(props: KeyframeTargetWrapperProps) {
  const { setTargetedParameter } = useKeyframeTarget()

  return (
    <span
      class={props.class}
      onClick={(e) => {
        e.stopPropagation()
        setTargetedParameter(props.parameterPath)
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      style="cursor: pointer;"
    >
      {props.children}
    </span>
  )
}

// Helper to wrap standard elements
export function wrapForKeyframeTarget(
  element: JSX.Element,
  parameterPath: string,
  className: string = '',
) {
  return <withKeyframeTarget parameterPath={parameterPath} class={className}>{element}</withKeyframeTarget>
}