import React, { createContext, useContext, useState } from "react"

const TabBarContext = createContext()

export function TabBarProvider({ children }) {
  const [isTabBarCollapsed, setIsTabBarCollapsed] = useState(false)
  return (
    <TabBarContext.Provider value={{ isTabBarCollapsed, setIsTabBarCollapsed }}>
      {children}
    </TabBarContext.Provider>
  )
}

export function useTabBar() {
  return useContext(TabBarContext)
}
