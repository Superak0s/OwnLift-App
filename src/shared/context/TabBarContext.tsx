import React, { createContext, useContext, useState, type ReactNode } from "react"

interface TabBarContextValue {
  isTabBarCollapsed: boolean
  setIsTabBarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
}

const TabBarContext = createContext<TabBarContextValue | undefined>(undefined)

export function TabBarProvider({ children }: { children: ReactNode }) {
  const [isTabBarCollapsed, setIsTabBarCollapsed] = useState(false)
  return (
    <TabBarContext.Provider value={{ isTabBarCollapsed, setIsTabBarCollapsed }}>
      {children}
    </TabBarContext.Provider>
  )
}

export function useTabBar(): TabBarContextValue {
  const context = useContext(TabBarContext)
  if (!context) {
    throw new Error("useTabBar must be used within a TabBarProvider")
  }
  return context
}