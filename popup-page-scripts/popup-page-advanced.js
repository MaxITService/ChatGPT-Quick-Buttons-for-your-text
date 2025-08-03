/**
 * popup-page-advanced.js
 * Handles the advanced selector configuration UI in the popup
 */

document.addEventListener('DOMContentLoaded', () => {
    const advancedSection = document.getElementById('advancedSection');
    const advancedHelpSection = document.getElementById('advancedHelpSection');

    // This script only needs to handle logic specific to the advanced settings.
    // The general collapsible behavior is now managed by popup-page-collapsible.js.

    // --- Collapsible Dependency Logic ---
    // We have a special case: if the main "Advanced" section is collapsed, the
    // inner "Help" section should also be forced into a collapsed state.
    // A MutationObserver handles this dependency cleanly.
    if (advancedSection && advancedHelpSection) {
        const helpToggleIcon = advancedHelpSection.querySelector('.toggle-icon');

        const parentObserver = new MutationObserver(() => {
            // Check if the parent is collapsed while the child is expanded.
            if (!advancedSection.classList.contains('expanded') && advancedHelpSection.classList.contains('expanded')) {
                // Force the child to collapse.
                advancedHelpSection.classList.remove('expanded');

                // Manually reset the icon rotation, as this change is programmatic
                // and won't trigger the click listener in the central script.
                if (helpToggleIcon) {
                    helpToggleIcon.style.transform = 'rotate(0deg)';
                }
            }
        });

        parentObserver.observe(advancedSection, {
            attributes: true,
            attributeFilter: ['class']
        });
    }


    const websiteSelect = document.getElementById('selectorWebsiteSelect');
    const selectorConfig = document.getElementById('selectorConfig');
    const saveButton = document.getElementById('saveSelectors');
    const resetButton = document.getElementById('resetSelectors');

    // Load selectors for the selected website
    async function loadSelectors() {
        const site = websiteSelect.value;
        try {
            // First try to get custom selectors
            const response = await chrome.runtime.sendMessage({
                type: 'getCustomSelectors',
                site: site,
            });

            if (response && response.selectors) {
                // Use custom selectors if available
                selectorConfig.value = JSON.stringify(response.selectors, null, 2);
                console.log(`Loaded custom selectors for ${site}`);
            } else {
                // Fall back to default selectors
                // Create a temporary instance to access the default selectors
                const defaultSelectors = getDefaultSelectorsForSite(site);
                selectorConfig.value = JSON.stringify(defaultSelectors, null, 2);
                console.log(`Loaded default selectors for ${site}`);
            }

            // After programmatic value set, resize to content.
            if (typeof resizeVerticalTextarea === 'function') {
                // If hidden (collapsed), defer until visible via rAF to let layout settle
                requestAnimationFrame(() => resizeVerticalTextarea(selectorConfig));
            }
        } catch (error) {
            console.error('Error loading selectors:', error);
            showToast('Error loading selectors', 'error');
        }
    }

    // Helper function to get default selectors for a site
    function getDefaultSelectorsForSite(site) {
        // Use the getDefaultSelectors method from utils.js
        if (window.InjectionTargetsOnWebsite) {
            return window.InjectionTargetsOnWebsite.getDefaultSelectors(site);
        } else {
            // Fallback if InjectionTargetsOnWebsite is not available
            return {
                containers: [],
                sendButtons: [],
                editors: [],
                buttonsContainerId: site.toLowerCase() + '-custom-buttons-container'
            };
        }
    }

    // Save the current selector configuration
    async function saveSelectors() {
        try {
            // Parse the JSON to validate it
            const config = JSON.parse(selectorConfig.value);

            // Validate the structure
            if (!validateSelectors(config)) {
                throw new Error('Invalid selector structure');
            }

            // Save to storage
            const response = await chrome.runtime.sendMessage({
                type: 'saveCustomSelectors',
                site: websiteSelect.value,
                selectors: config,
            });

            if (response && response.success) {
                showToast('Selectors saved successfully', 'success');
            } else {
                throw new Error('Failed to save selectors');
            }
        } catch (error) {
            console.error('Error saving selectors:', error);
            showToast(`Error saving: ${error.message}`, 'error');
        }
    }

    // Reset selectors to defaults
    async function resetSelectors() {
        try {
            // Remove custom selectors
            const response = await chrome.runtime.sendMessage({
                type: 'saveCustomSelectors',
                site: websiteSelect.value,
                selectors: null, // null means remove
            });

            if (response && response.success) {
                // Load the defaults
                const defaultSelectors = getDefaultSelectorsForSite(websiteSelect.value);
                selectorConfig.value = JSON.stringify(defaultSelectors, null, 2);
                showToast('Selectors reset to defaults', 'info');

                // Ensure textarea fits to new content
                if (typeof resizeVerticalTextarea === 'function') {
                    requestAnimationFrame(() => resizeVerticalTextarea(selectorConfig));
                }
            } else {
                throw new Error('Failed to reset selectors');
            }
        } catch (error) {
            console.error('Error resetting selectors:', error);
            showToast(`Error resetting: ${error.message}`, 'error');
        }
    }

    // Validate the selector structure
    function validateSelectors(selectors) {
        return selectors &&
            selectors.containers && Array.isArray(selectors.containers) &&
            selectors.sendButtons && Array.isArray(selectors.sendButtons) &&
            selectors.editors && Array.isArray(selectors.editors) &&
            typeof selectors.buttonsContainerId === 'string';
    }

    // Event listeners
    websiteSelect.addEventListener('change', loadSelectors);
    saveButton.addEventListener('click', saveSelectors);
    resetButton.addEventListener('click', resetSelectors);

    // Initial load
    loadSelectors();

    // Make the selectorConfig textarea auto-resizable by reusing the global function
    if (typeof textareaInputAreaResizerFun === 'function') {
        textareaInputAreaResizerFun('selectorConfig');
    } else {
        console.error('Resizer function not found. Ensure popup-page-customButtons.js is loaded first.');
    }

    // Observe Advanced section expand/collapse to handle hidden measurement issues
    if (advancedSection && selectorConfig) {
        const onExpanded = () => {
            // Wait for paint so display: block takes effect, then measure
            requestAnimationFrame(() => {
                if (typeof resizeVerticalTextarea === 'function') {
                    resizeVerticalTextarea(selectorConfig);
                }
            });
        };
        const onCollapsed = () => {
            // Drop stale inline height so next expand re-measures from CSS baseline
            selectorConfig.style.height = 'auto';
        };

        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const isExpanded = advancedSection.classList.contains('expanded');
                    if (isExpanded) {
                        onExpanded();
                    } else {
                        onCollapsed();
                    }
                }
            }
        });
        mo.observe(advancedSection, { attributes: true, attributeFilter: ['class'] });
    }

    // Also re-fit while user edits (keeps parity with button card logic)
    if (selectorConfig && typeof resizeVerticalTextarea === 'function') {
        selectorConfig.addEventListener('input', () => resizeVerticalTextarea(selectorConfig));
    }
});