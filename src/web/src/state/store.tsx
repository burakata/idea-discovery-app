import type { ReactNode } from 'react'
import { ApiProvider } from './apiStore'
import { DemoProvider } from './demoStore'

// The one door to the data (docs/engineering.md section 8). The build decides
// what is behind it: the demo or the API. The other implementation is removed
// from the bundle, because __DEMO__ is a build-time constant.
export { useStore } from './context'
// The demo's reducer, exported for its tests.
export { createInitialState, reducer } from './demoStore'

export function StoreProvider({ children }: { children: ReactNode }) {
  return __DEMO__ ? <DemoProvider>{children}</DemoProvider> : <ApiProvider>{children}</ApiProvider>
}
