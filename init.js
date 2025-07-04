// init.js
// Version: 1.5
//
// Documentation:
/**
 * This file serves as the main initializer for the OneClickPrompts extension.
 *
 * Overview:
 * - Retrieves configuration data from the service worker.
 * - Identifies the active website (e.g., ChatGPT or Claude) and loads 
 *   the appropriate extension scripts.
 * - Applies necessary settings and manages keyboard shortcuts to enhance 
 *   user interaction.
 * - Monitors URL changes in single-page applications and ensures resiliency 
 *   by validating and reinitializing custom modifications in the DOM.
 * - Uses debouncing to limit excessive function executions for performance.
 *
 * Usage:
 * - Ensure the following scripts are loaded (in order) before this file:
 *   1. buttons.js
 *   2. buttons-init.js
 *   3. buttons-injection.js
 * - The initialization process starts automatically upon script load.
 *
 * Dependencies:
 * - This is the main script, and it depends on all other helper files that are 
 *   used as content scripts.
 * - Popup page scripts are handled separately.
 *
 */
//Instructions for AI: do not remove comments!  MUST NOT REMOVE COMMENTS. This one too!
// ALL CODE IN ALL FILES MUST USE logConCgp FOR LOGGING. NO CONSOLE LOGGING.

'use strict';

/**
 * Main entry point. Retrieves configuration and then starts the async initialization.
 */
function publicStaticVoidMain() {
    chrome.runtime.sendMessage({ type: 'getConfig' }, (response) => {
        if (chrome.runtime.lastError) {
            logConCgp('[init] Error loading configuration:', chrome.runtime.lastError.message);
            return;
        }
        if (response && response.config) {
            logConCgp('[init] Configuration successfully loaded:', response.config);
            commenceExtensionInitialization(response.config);
        } else {
            logConCgp('[init] Failed to load configuration from service worker. Initialization aborted.');
        }
    });
}

/**
 * Initializes the extension using an async "decide-first" approach.
 * @param {Object} configurationObject - The configuration object.
 */
async function commenceExtensionInitialization(configurationObject) {
    logConCgp('[init] Async initialization started.');
    window.globalMaxExtensionConfig = configurationObject;

    /**
     * Helper to get panel visibility setting from storage, wrapped in a Promise.
     * @returns {Promise<boolean>} - True if the panel should be visible.
     */
    async function getFloatingPanelVisibility() {
        return new Promise(resolve => {
            const hostname = window.location.hostname;
            chrome.runtime.sendMessage({ type: 'getFloatingPanelSettings', hostname: hostname }, response => {
                if (chrome.runtime.lastError) {
                    logConCgp('[init] Error getting panel settings:', chrome.runtime.lastError.message);
                    resolve(false);
                    return;
                }
                resolve(response?.settings?.isVisible || false);
            });
        });
    }

    const shouldPanelBeVisible = await getFloatingPanelVisibility();

    if (shouldPanelBeVisible) {
        logConCgp('[init] Decide-first: Panel should be visible. Creating panel and buttons directly.');
        if (window.MaxExtensionFloatingPanel) {
            await window.MaxExtensionFloatingPanel.createFloatingPanel();
            const panelContent = document.getElementById('max-extension-floating-panel-content');
            const panel = window.MaxExtensionFloatingPanel.panelElement;

            if (panel && panelContent) {
                // Create buttons directly in the panel. No flicker.
                window.MaxExtensionButtonsInit.createAndInsertCustomElements(panelContent);

                // Manually make panel visible and set state.
                panel.style.display = 'flex';
                window.MaxExtensionFloatingPanel.isPanelVisible = true;
            } else {
                logConCgp('[init] Decide-first: Failed to create panel. Falling back to inline injection.');
                buttonBoxCheckingAndInjection(true); // Fallback
            }
        }
    } else {
        logConCgp('[init] Decide-first: Panel is hidden. Using standard inline injection.');
        buttonBoxCheckingAndInjection(true);
    }

    // After the initial decision and creation, initialize the full floating panel system.
    // This loads settings, profiles, and attaches event listeners.
    if (window.MaxExtensionFloatingPanel) {
        window.MaxExtensionFloatingPanel.initialize();
        logConCgp('[init] Floating panel system initialized in a controlled manner.');
    }

    // --- All subsequent logic for shortcuts and SPA navigation remains the same ---
    const activeWebsite = window.InjectionTargetsOnWebsite.activeSite;

    // Make the listener idempotent by removing it before adding it. This prevents duplicate listeners
    // when the extension re-initializes and also cleans up the listener if shortcuts are disabled
    // or when navigating away from the relevant site.
    window.removeEventListener('keydown', manageKeyboardShortcutEvents);

    if (activeWebsite === 'ChatGPT' && window.globalMaxExtensionConfig.enableShortcuts) {
        window.addEventListener('keydown', manageKeyboardShortcutEvents);
        logConCgp('[init] Keyboard shortcut listener is active for ChatGPT.');
    }

    resilientStartAndRetryOnSPANavigation(() => {
        logConCgp('[init] Path change detected via MutationObserver. Re-initializing script...');
        const debouncedEnhancedInitialization = debounceFunctionExecution(() => {
            publicStaticVoidMain();
        }, 100);
        debouncedEnhancedInitialization();
    });

    patchHistoryMethods();
}

/**
 * Manages keyboard shortcut events to trigger custom send buttons on the webpage.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function manageKeyboardShortcutEvents(event) {
    if (!globalMaxExtensionConfig.enableShortcuts) return;
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.code.startsWith('Digit')) {
        let pressedKey = event.code.replace('Digit', '');
        if (pressedKey === '0') pressedKey = '10';
        const targetButton = document.querySelector(`button[data-shortcut-key="${pressedKey}"]`);
        if (targetButton) {
            event.preventDefault();
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, shiftKey: event.shiftKey });
            targetButton.dispatchEvent(clickEvent);
        } else {
            logConCgp('[init] No button found for the pressed shortcut key:', pressedKey);
        }
    }
}

/**
 * Debounces a function to limit how often it can be executed.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounceFunctionExecution(func, delay) {
    let timeoutIdentifier;
    return function (...argumentsList) {
        clearTimeout(timeoutIdentifier);
        timeoutIdentifier = setTimeout(() => func.apply(this, argumentsList), delay);
    };
}

/**
 * Observes changes to the URL in Single Page Applications.
 * @param {Function} callback - The function to execute when a URL change is detected.
 */
function resilientStartAndRetryOnSPANavigation(callback) {
    let previousUrl = location.href;
    const urlChangeObserver = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== previousUrl) {
            previousUrl = currentUrl;
            callback();
        }
    });
    urlChangeObserver.observe(document, { subtree: true, childList: true });
}

/**
 * Monkey-patches History API methods for immediate navigation detection.
 */
function patchHistoryMethods() {
    if (history.__patchedByOneClickPrompts) return;
    history.__patchedByOneClickPrompts = true;
    const methods = ['pushState', 'replaceState'];
    methods.forEach(method => {
        const original = history[method];
        history[method] = function (...args) {
            const result = original.apply(this, args);
            logConCgp(`[init] ${method} called. URL:`, args[2]);
            publicStaticVoidMain(); // Re-run the full initialization logic
            return result;
        };
    });
}

// Automatically start the initialization process upon script load.
publicStaticVoidMain();