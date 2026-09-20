"use client";
import Script from "next/script";
import { useSyncExternalStore } from "react";
import type { SettingsOf } from "@/lib/settings/registry";

const key = "clothin.analytics-consent.v1";
const subscribe = (notify: () => void) => { window.addEventListener("storage", notify); window.addEventListener("clothin-consent", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("clothin-consent", notify); }; };
const snapshot = () => { try { return localStorage.getItem(key) ?? "unset"; } catch { return "unset"; } };
const serverSnapshot = () => "loading";

/** Only validated public IDs enter these fixed snippets. No arbitrary script field exists. */
export function StoreAnalytics({ config }: { config: SettingsOf<"analytics"> }) {
  const consent = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const enabled = config.ga4Enabled || config.gtmEnabled || config.metaEnabled || config.tiktokEnabled || config.pinterestEnabled || config.clarityEnabled;
  if (!enabled) return null;
  function choose(value: string) { try { localStorage.setItem(key, value); } catch { /* denied storage leaves tracking disabled */ } window.dispatchEvent(new Event("clothin-consent")); }
  const allowed = consent !== "loading" && (consent === "accepted" || !config.consentRequired && consent !== "declined");
  return <>
    {config.consentRequired && consent === "unset" ? <aside className="store-consent" aria-label="Analytics preferences"><p>May we use analytics cookies to understand visits and improve the store?</p><button onClick={() => choose("accepted")}>Accept</button><button onClick={() => choose("declined")}>Decline</button></aside> : null}
    {consent !== "loading" && consent !== "unset" ? <button className="store-consent-preferences" onClick={() => { choose("unset"); window.location.reload(); }}>Cookie preferences</button> : null}
    {allowed ? <>
      {config.ga4Enabled && config.ga4Id ? <><Script id="store-ga-init">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(config.ga4Id)});`}</Script><Script src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`} /></> : null}
      {config.gtmEnabled && config.gtmId ? <><Script id="store-gtm-init">{"window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});"}</Script><Script src={`https://www.googletagmanager.com/gtm.js?id=${config.gtmId}`} /></> : null}
      {config.metaEnabled && config.metaPixelId ? <><Script id="store-meta-init">{`window.fbq=window.fbq||function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};fbq.queue=fbq.queue||[];fbq.loaded=true;fbq.version='2.0';fbq('init',${JSON.stringify(config.metaPixelId)});fbq('track','PageView');`}</Script><Script src="https://connect.facebook.net/en_US/fbevents.js" /></> : null}
      {config.clarityEnabled && config.clarityId ? <><Script id="store-clarity-init">{"window.clarity=window.clarity||function(){(clarity.q=clarity.q||[]).push(arguments)};"}</Script><Script src={`https://www.clarity.ms/tag/${config.clarityId}`} /></> : null}
      {config.pinterestEnabled && config.pinterestTagId ? <><Script id="store-pinterest-init">{`window.pintrk=window.pintrk||function(){pintrk.queue.push(Array.prototype.slice.call(arguments))};pintrk.queue=pintrk.queue||[];pintrk.version='3.0';pintrk('load',${JSON.stringify(config.pinterestTagId)});pintrk('page');`}</Script><Script src="https://s.pinimg.com/ct/core.js" /></> : null}
      {config.tiktokEnabled && config.tiktokPixelId ? <><Script id="store-tiktok-init">{`window.TiktokAnalyticsObject='ttq';window.ttq=window.ttq||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq._i=ttq._i||{};ttq._i[${JSON.stringify(config.tiktokPixelId)}]=[];ttq._i[${JSON.stringify(config.tiktokPixelId)}]._u='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._t=ttq._t||{};ttq._t[${JSON.stringify(config.tiktokPixelId)}]=Date.now();ttq._o=ttq._o||{};ttq._o[${JSON.stringify(config.tiktokPixelId)}]={};ttq.page();`}</Script><Script src={`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${config.tiktokPixelId}&lib=ttq`} /></> : null}
    </> : null}
  </>;
}
