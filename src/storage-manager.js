(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  class StorageManager {
    constructor() {
      this.saveTimer = 0;
    }

    get(keys) {
      return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
          resolve({});
          return;
        }
        chrome.storage.local.get(keys, (result) => {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            console.error("[WAE] storage get failed", error);
            resolve({});
            return;
          }
          resolve(result || {});
        });
      });
    }

    set(items) {
      return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
          resolve();
          return;
        }
        chrome.storage.local.set(items, () => {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            console.error("[WAE] storage set failed", error);
          }
          resolve();
        });
      });
    }

    debounceSave(itemsFactory) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => {
        WAE.safeRun("debounced save", () => this.set(itemsFactory()));
      }, WAE.CONFIG.saveDebounceMs);
    }

    flushSave(itemsFactory) {
      window.clearTimeout(this.saveTimer);
      return this.set(itemsFactory());
    }
  }

  WAE.StorageManager = StorageManager;
})();
