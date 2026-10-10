import { createContext, useContext } from 'react'

// The group you're looking at: { status: 'none' | 'loading' | 'error' | 'ready', group, members }.
// Provided by GroupProvider in App.jsx.
export const GroupCtx = createContext({ status: 'none' })
export const useGroupCtx = () => useContext(GroupCtx)
