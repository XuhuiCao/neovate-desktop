import { createContext, useContext } from "react";

const SidebarHoverContext = createContext(false);

export const SidebarHoverProvider = SidebarHoverContext.Provider;
export const useSidebarHoverActive = () => useContext(SidebarHoverContext);
