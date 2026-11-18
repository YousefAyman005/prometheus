import { useStore } from 'zustand'
import { type AppState, createAppStore } from './createStore'

export const appStore = createAppStore(window.localStorage)

/** Subscribes a component to one slice of the app state. */
export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}
