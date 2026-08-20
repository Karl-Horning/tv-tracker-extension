/**
 * @fileoverview Service worker entry point for the TV Tracker extension.
 *
 * Registers chrome.runtime, chrome.alarms, and chrome.storage event
 * listeners.
 */

import { updateBadge } from "./badge";
import { ALARM_NAME, handleAlarm, registerAlarm } from "./refresh";

chrome.runtime.onInstalled.addListener(() => {
    registerAlarm();
    void updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
    void updateBadge();
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName !== "local") return;
    void updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    handleAlarm(alarm)
        .then(() => {
            if (alarm.name === ALARM_NAME) return updateBadge();
        })
        .catch((err: unknown) => {
            console.error("Failed to handle alarm:", err);
        });
});
