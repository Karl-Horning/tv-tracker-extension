/**
 * @fileoverview Service worker entry point for the TV Tracker extension.
 *
 * Registers chrome.runtime and chrome.alarms event listeners.
 */

import { handleAlarm, registerAlarm } from "./refresh";

chrome.runtime.onInstalled.addListener(registerAlarm);
chrome.alarms.onAlarm.addListener((alarm) => {
    handleAlarm(alarm).catch((err: unknown) => {
        console.error("Failed to handle alarm:", err);
    });
});
