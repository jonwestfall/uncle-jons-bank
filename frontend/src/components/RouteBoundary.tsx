import { Component, Suspense, type ReactNode } from 'react'

interface RouteErrorBoundaryState {
  hasError: boolean
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch() {
    // Intentionally swallow and present route-level fallback UI.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <h2>Something went wrong</h2>
          <p>Please refresh this page or try a different section.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense
        fallback={
          <div className="container">
            <p>Loading page...</p>
          </div>
        }
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  )
}
