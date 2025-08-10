/**
 * File: buttons-clicking-grok.js
 * Version: 1.1
 *
 * Description:
 * This file implements the custom send button functionality for Grok.com. It handles the insertion
 * of custom text into the editor and ensures that the editor's auto-resize behavior is triggered.
 * The approach involves bulk inserting most of the text and then simulating a natural keystroke for
 * the final character to mimic real typing. This ensures that the cursor remains at the end and that
 * the auto-resize functionality is activated.
 *
 * Key Functions:
 * - simulateKeystroke: Simulates keydown, input, and keyup events for a single character while
 *   appending it to the editor. It also sets focus and positions the cursor correctly.
 * - insertWithNaturalLastSymbol: Inserts all characters except the last one via direct bulk insertion,
 *   then uses simulateKeystroke for the last character, adding an extra delay and re-check for short prompts.
 * - processGrokCustomSendButtonClick: Main function that determines the state of the editor,
 *   chooses the appropriate text insertion method (based on prompt size and whether the editor is empty),
 *   maintains focus and cursor positioning, and handles auto-send functionality.
 *
 * Notes:
 * - Supports both textarea/input elements and contenteditable elements.
 * - Relies on window.MaxExtensionUtils for utility functions (e.g., moving the cursor to the end)
 *   and globalMaxExtensionConfig for auto-send settings.
 */

'use strict';

/**
 * Helper function that simulates the natural typing of a single character.
 * It dispatches keydown, input, and keyup events and appends the character.
 * @param {HTMLElement} editorArea - The editor element.
 * @param {string} char - The character to simulate.
 * @param {boolean} isTextArea - Whether the editor is a textarea/input.
 * @returns {Promise} Resolves after a short delay.
 */
async function simulateKeystroke(editorArea, char, isTextArea) {
    editorArea.focus();
    const eventTypes = ['keydown', 'input', 'keyup'];
    for (const type of eventTypes) {
        let evt;
        if (type === 'input') {
            evt = new InputEvent(type, {
                data: char,
                inputType: 'insertText',
                bubbles: true,
                cancelable: true
            });
        } else {
            evt = new KeyboardEvent(type, {
                key: char,
                code: `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true
            });
        }
        editorArea.dispatchEvent(evt);
        if (type === 'input') {
            if (isTextArea) {
                editorArea.value += char;
            } else {
                editorArea.innerText += char;
            }
        }
    }
    if (isTextArea) {
        editorArea.focus();
        editorArea.setSelectionRange(editorArea.value.length, editorArea.value.length);
    } else {
        setTimeout(() => {
            if (window.MaxExtensionUtils && typeof window.MaxExtensionUtils.moveCursorToEnd === 'function') {
                window.MaxExtensionUtils.moveCursorToEnd(editorArea);
            }
        }, 50);
    }
    // Small delay to let the editor process the keystroke
    return new Promise(resolve => setTimeout(resolve, 50));
}

/**
 * Inserts text into the editor by direct bulk insertion for all characters except the last one,
 * which is simulated naturally to trigger auto-resize.
 * For short prompts, an extra delay is added before the final keystroke and a verification
 * is performed to ensure the last character remains.
 * @param {HTMLElement} editorArea - The editor element.
 * @param {string} text - The text to insert.
 * @param {boolean} isTextArea - Whether the editor is a textarea/input.
 * @returns {Promise} Resolves after insertion.
 */
async function insertWithNaturalLastSymbol(editorArea, text, isTextArea) {
    if (text.length === 0) return;
    let lastChar;
    if (text.length === 1) {
        // For a single-character prompt, add a small extra delay before simulating.
        await new Promise(resolve => setTimeout(resolve, 100));
        lastChar = text;
        await simulateKeystroke(editorArea, lastChar, isTextArea);
    } else {
        // Insert all characters except the last in one go.
        const bulkText = text.slice(0, -1);
        lastChar = text.slice(-1);
        if (isTextArea) {
            editorArea.value += bulkText;
        } else {
            editorArea.innerText += bulkText;
        }
        // For short prompts, wait a bit longer before the final keystroke.
        if (text.length < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        await simulateKeystroke(editorArea, lastChar, isTextArea);
    }
    // After inserting the last character, wait and then verify it remains.
    await new Promise(resolve => setTimeout(resolve, 100));
    const currentText = isTextArea ? editorArea.value : editorArea.innerText;
    if (!currentText.endsWith(lastChar)) {
        logConCgp('[grok] Last character missing after insertion, reattempting keystroke.');
        await simulateKeystroke(editorArea, lastChar, isTextArea);
    }
}

/**
 * Processes the custom send button click for Grok.
 * Inserts custom text into the editor while ensuring the editor auto-resizes.
 * Uses natural typing simulation only for the last character.
 * Additionally, selects the visible (active) editor in case multiple editor elements exist.
 * @param {Event} event - The click event triggered by the custom send button.
 * @param {string} customText - The custom text to be sent.
 * @param {boolean} autoSend - Flag indicating whether auto-send is enabled.
 */
async function processGrokCustomSendButtonClick(event, customText, autoSend) {
    // Prevent default button behavior
    event.preventDefault();
    logConCgp('[grok] Custom send button clicked.');

    // Select the visible (active) editor by filtering out hidden elements.
    const editorCandidates = window.InjectionTargetsOnWebsite.selectors.editors
        .map(selector => document.querySelector(selector))
        .filter(el => el && el.offsetParent !== null);
    const editorArea = editorCandidates.length > 0
        ? editorCandidates[editorCandidates.length - 1]
        : document.querySelector(window.InjectionTargetsOnWebsite.selectors.editors[0]);

    if (!editorArea) {
        logConCgp('[grok] Editor area not found. Aborting send process.');
        showToast('Could not find the text input area.', 'error');
        return;
    }

    // Determine if the editor is a textarea/input (has a "value" property) or a contenteditable element.
    const isTextArea = (editorArea.value !== undefined);

    // Check if the editor is in its initial state (i.e. empty)
    const isEditorInInitialState = () => {
        const currentText = isTextArea ? editorArea.value.trim() : editorArea.innerText.trim();
        const isInitial = currentText === '';
        logConCgp('[grok] Editor initial state check:', isInitial);
        return isInitial;
    };

    // Threshold for large prompt; for very large texts, we continue with full direct insertion.
    const LARGE_PROMPT_THRESHOLD = 200;

    if (isEditorInInitialState()) {
        if (customText.length > LARGE_PROMPT_THRESHOLD) {
            logConCgp('[grok] Editor is in initial state with large prompt. Using direct insertion for bulk text, then natural typing for last symbol.');
            // Insert bulk text (all but last symbol) directly.
            const bulkText = customText.slice(0, -1);
            const lastChar = customText.slice(-1);
            if (isTextArea) {
                editorArea.value = bulkText;
            } else {
                editorArea.innerText = bulkText;
            }
            // Then simulate natural typing for the last character.
            await simulateKeystroke(editorArea, lastChar, isTextArea);
        } else {
            logConCgp('[grok] Editor is in initial state with small prompt. Inserting text with natural typing for last symbol.');
            await insertWithNaturalLastSymbol(editorArea, customText, isTextArea);
        }
        logConCgp('[grok] Custom text inserted into editor.');
    } else {
        logConCgp('[grok] Editor already has content. Appending custom text using natural typing for last symbol.');
        await insertWithNaturalLastSymbol(editorArea, customText, isTextArea);
        logConCgp('[grok] Custom text appended.');
    }

    // If auto-send is enabled in both the global configuration and the function parameter, initiate auto-send.
    if (globalMaxExtensionConfig.globalAutoSendEnabled && autoSend) {
        logConCgp('[grok] Auto-send enabled. Waiting 100ms before sending.');
        // Added extra delay to ensure the last character is fully processed.
        await new Promise(resolve => setTimeout(resolve, 100));

        let attempts = 0;
        const maxAttempts = 50; // 5 seconds of attempts

        const intervalId = setInterval(() => {
            const currentText = isTextArea ? editorArea.value.trim() : editorArea.innerText.trim();
            if (currentText.length === 0) {
                logConCgp('[grok] Editor became empty during auto-send. Stopping auto-send.');
                clearInterval(intervalId);
                window.autoSendInterval = null;
                return;
            }
            // Locate the Grok send button using selectors from InjectionTargetsOnWebsite.
            const sendButton = document.querySelector(
                window.InjectionTargetsOnWebsite.selectors.sendButtons.find(selector => document.querySelector(selector))
            );
            if (sendButton) {
                logConCgp('[grok] Send button found. Clicking send button.');
                window.MaxExtensionUtils.simulateClick(sendButton);
                clearInterval(intervalId);
                window.autoSendInterval = null;
                logConCgp('[grok] Auto-send: Send button clicked, auto-send stopped.');
            } else if (++attempts >= maxAttempts) {
                clearInterval(intervalId);
                window.autoSendInterval = null;
                logConCgp('[grok] Send button not found after multiple attempts.');
                showToast('Send button not found. Auto-send stopped.', 'error');
            } else {
                logConCgp(`[grok] Send button not found. Attempt ${attempts}/${maxAttempts}`);
            }
        }, 100);
        window.autoSendInterval = intervalId;
    }
}

// Expose the function globally
window.processGrokCustomSendButtonClick = processGrokCustomSendButtonClick;
