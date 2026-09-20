"use client";
import { createContext, useContext } from "react";
export interface StorePreferencesValue { desktopQuality: string; mobileQuality: string; sizeUnit: "cm" | "in"; shippingAndReturns?: string[]; cdn?: { assetBaseUrl: string; mediaBaseUrl: string; optimizeLocalImages: boolean } }
const Context = createContext<StorePreferencesValue>({ desktopQuality: "auto", mobileQuality: "auto", sizeUnit: "cm" });
export const useStorePreferences = () => useContext(Context);
export function StorePreferences({ value, children }: { value: StorePreferencesValue; children: React.ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
