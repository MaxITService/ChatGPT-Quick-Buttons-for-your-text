'use strict';

/**
 * Processes the custom send button click for Copilot.
 * @param {Event} event - The click event triggered by the send button.
 * @param {string} customText - The custom text to be sent.
 * @param {boolean} autoSend - Flag indicating whether autosend is enabled.
 */
function processCopilotCustomSendButtonClick(event, customText, autoSend) {
    event.preventDefault();
    logConCgp('[buttons] Custom send button was clicked.');

    const injectionTargets = window.InjectionTargetsOnWebsite;
    const editorSelectors = injectionTargets.selectors.editors;
    const editorArea = editorSelectors.reduce((found, selector) => 
        found || document.querySelector(selector), null);

    if (!editorArea) {
        logConCgp('[buttons] Editor area not found. Unable to proceed.');
        return;
    }

    const isEditorInInitialState = (element) => {
        const currentValue = element.value ?? '';
        const isInitial = currentValue.trim() === '';
        logConCgp('[buttons] Editor initial state check:', isInitial);
        return isInitial;
    };

    const setEditorValueDirectly = (element, text) => {
        element.focus();
        logConCgp('[buttons] Editor focused for setting value directly.');

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(element),
            'value'
        )?.set;
        
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, text);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            logConCgp('[buttons] Events dispatched after setting value directly.');
        }
    };

    const locateSendButtons = () => {
        const sendButtonSelectors = injectionTargets.selectors.sendButtons;
        const sendButtons = sendButtonSelectors
            .map(selector => document.querySelector(selector))
            .filter(Boolean);

        logConCgp(sendButtons.length ? 
            '[buttons] Send buttons located.' : 
            '[buttons] Send buttons not found using dynamic selectors.');

        return sendButtons;
    };

    let originalSendButtons = locateSendButtons();

    const handleSendButtons = (sendButtons) => {
        if (!sendButtons.length) {
            logConCgp('[buttons] Send buttons are not available to handle.');
            return;
        }

        const existingText = editorArea.value ?? '';
        const newText = `${existingText}${customText}`;
        
        setEditorValueDirectly(editorArea, newText);

        if (editorArea.setSelectionRange) {
            editorArea.setSelectionRange(newText.length, newText.length);
            logConCgp('[buttons] Cursor moved to the end of the editor.');
        }

        if (globalMaxExtensionConfig.globalAutoSendEnabled && autoSend) {
            logConCgp('[buttons] Auto-send is enabled. Starting auto-send process.');
            startAutoSend([sendButtons[0]], editorArea);
        }
    };

    const startAutoSend = (sendButtons, editor) => {
        if (window.autoSendInterval) {
            logConCgp('[auto-send] Auto-send is already running. Skipping initiation.');
            return;
        }

        window.autoSendInterval = setInterval(() => {
            const currentText = editor.value?.trim() ?? '';

            if (!currentText) {
                clearInterval(window.autoSendInterval);
                window.autoSendInterval = null;
                logConCgp('[auto-send] Editor is empty. Stopping auto-send interval.');
                return;
            }

            const updatedSendButtons = locateSendButtons();
            const sendButton = updatedSendButtons[0];

            if (sendButton) {
                sendButton.click();
                clearInterval(window.autoSendInterval);
                window.autoSendInterval = null;
                logConCgp('[auto-send] Message sent and interval stopped.');
            } else {
                logConCgp('[auto-send] Send button not found during auto-send.');
            }
        }, 100);
    };

    const handleMessageInsertion = () => {
        const initialState = isEditorInInitialState(editorArea);

        if (initialState) {
            setEditorValueDirectly(editorArea, customText);

            if (editorArea.setSelectionRange) {
                editorArea.setSelectionRange(customText.length, customText.length);
            }

            originalSendButtons = locateSendButtons();

            if (!originalSendButtons.length) {
                const observer = new MutationObserver((mutations, obs) => {
                    originalSendButtons = locateSendButtons();
                    if (originalSendButtons.length) {
                        handleSendButtons(originalSendButtons);
                        obs.disconnect();
                        logConCgp('[buttons] Send buttons detected and observer disconnected.');
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                setTimeout(() => {
                    if (!window.autoSendInterval) {
                        observer.disconnect();
                        logConCgp('[buttons] MutationObserver disconnected after timeout.');
                    }
                }, 5000);
            } else {
                handleSendButtons(originalSendButtons);
            }
        } else {
            handleSendButtons(originalSendButtons);
        }
    };

    handleMessageInsertion();
}
