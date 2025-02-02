// popup-page-profiles.js
// instructions for the AI: do not remove comments! MUST NOT REMOVE COMMENTS.
// There are just helper functions that handle profile switching and so on.
// -------------------------
// 1. Minimal Default Config
// -------------------------

// Minimal Default configuration object for empty profiles
const minimalDefaultConfig = {
    PROFILE_NAME: "Empty Profile",
    ENABLE_SHORTCUTS_DEFAULT: true,
    globalAutoSendEnabled: true,
    enableShortcuts: true,
    firstModificationDone: false,
    customButtons: [] // No buttons or separators
};

// -------------------------
// 2. Profile Management Functions
// -------------------------

/**
 * Loads all profiles and sets the current profile.
 */
async function loadProfiles() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'listProfiles' });
        profileSelect.innerHTML = ''; // Clear existing options

        response.profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile;
            option.textContent = profile;
            profileSelect.appendChild(option);
        });

        // Load current profile
        const configResponse = await chrome.runtime.sendMessage({ type: 'getConfig' });
        currentProfile = configResponse.config;
        profileSelect.value = currentProfile.PROFILE_NAME;

        updateInterface();
        logToConsole(`Loaded profile: ${currentProfile.PROFILE_NAME}`);
    } catch (error) {
        logToConsole(`Error loading profiles: ${error.message}`);
    }
}

/**
 * Switches to a different profile.
 * @param {string} profileName - The name of the profile to switch to.
 */
async function switchProfile(profileName) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'switchProfile',
            profileName: profileName
        });

        let newConfig = null;

        // If the primary response is missing config, attempt to retrieve via getConfig
        if (!response || !response.config) {
            logToConsole(`Warning: Received null config for profile "${profileName}". Attempting to retrieve default config...`);
            const configResponse = await chrome.runtime.sendMessage({ type: 'getConfig' });
            if (configResponse && configResponse.config) {
                newConfig = configResponse.config;
            } else {
                logToConsole('Error: Unable to retrieve default profile configuration during switchProfile.');
                return;
            }
        } else {
            newConfig = response.config;
        }

        currentProfile = newConfig;
        updateInterface();
        logToConsole(`Switched to profile: ${profileName}`);
        updateSaveStatus();
    } catch (error) {
        logToConsole(`Error switching profile: ${error.message}`);
    }
}


// -------------------------
// 3. Add New Empty Profile
// -------------------------

/**
 * Creates a new empty profile using minimalDefaultConfig.
 * @param {string} profileName - The name of the new profile.
 */
async function addNewEmptyProfile(profileName) {
    // Trim whitespace and validate profile name
    const trimmedProfileName = profileName.trim();
    if (trimmedProfileName === "") {
        showToast('Profile name cannot be empty.', 'error');
        logToConsole('Profile creation failed: Empty name provided.');
        return;
    }

    // Check if profile name already exists
    const existingProfiles = Array.from(profileSelect.options).map(option => option.value);
    if (existingProfiles.includes(trimmedProfileName)) {
        showToast('A profile with this name already exists.', 'error');
        logToConsole(`Profile creation failed: "${trimmedProfileName}" already exists.`);
        return;
    }

    try {
        // Initialize new profile with minimal settings
        const newConfig = { ...minimalDefaultConfig, PROFILE_NAME: trimmedProfileName };
        await chrome.runtime.sendMessage({
            type: 'saveConfig',
            profileName: trimmedProfileName,
            config: newConfig
        });

        await loadProfiles();
        profileSelect.value = trimmedProfileName;
        await switchProfile(trimmedProfileName);
        showToast(`Profile "${trimmedProfileName}" added successfully.`, 'success');
        logToConsole(`Created new empty profile: ${trimmedProfileName}`);
    } catch (error) {
        showToast(`Error creating profile: ${error.message}`, 'error');
        logToConsole(`Error creating profile: ${error.message}`);
    }
}

// -------------------------
// 4. Copy Current Profile
// -------------------------

/**
 * Copies the current profile to a new profile with a specified name.
 * @param {string} newProfileName - The name of the new profile.
 */
async function copyCurrentProfile(newProfileName) {
    // Trim whitespace and validate profile name
    const trimmedProfileName = newProfileName.trim();
    if (trimmedProfileName === "") {
        showToast('Profile name cannot be empty.', 'error');
        logToConsole('Profile copy failed: Empty name provided.');
        return;
    }

    // Check if profile name already exists
    const existingProfiles = Array.from(profileSelect.options).map(option => option.value);
    if (existingProfiles.includes(trimmedProfileName)) {
        showToast('A profile with this name already exists.', 'error');
        logToConsole(`Profile copy failed: "${trimmedProfileName}" already exists.`);
        return;
    }

    try {
        // Deep copy current profile settings
        const newConfig = JSON.parse(JSON.stringify(currentProfile));
        newConfig.PROFILE_NAME = trimmedProfileName;

        await chrome.runtime.sendMessage({
            type: 'saveConfig',
            profileName: trimmedProfileName,
            config: newConfig
        });

        await loadProfiles();
        profileSelect.value = trimmedProfileName;
        await switchProfile(trimmedProfileName);
        showToast(`Profile duplicated as "${trimmedProfileName}" successfully.`, 'success');
        logToConsole(`Copied profile to new profile: ${trimmedProfileName}`);
    } catch (error) {
        showToast(`Error copying profile: ${error.message}`, 'error');
        logToConsole(`Error copying profile: ${error.message}`);
    }
}

/**
 * Deletes the current profile.
 */
async function deleteCurrentProfile() {
    // --- Modified deletion logic for safety ---
    // Check that currentProfile is defined and has a PROFILE_NAME property.
    if (!currentProfile || !currentProfile.PROFILE_NAME) {
        showToast('No profile is loaded to delete.', 'error');
        return;
    }

    const profileName = currentProfile.PROFILE_NAME;

    if (profileName === 'Default') {
        alert('Cannot delete Default profile');
        return;
    }

    if (!confirm(`Delete profile "${profileName}"?`)) return;

    try {
        await chrome.runtime.sendMessage({
            type: 'deleteProfile',
            profileName: profileName
        });

        await loadProfiles();
        logToConsole(`Deleted profile: ${profileName}`);
        showToast(`Profile "${profileName}" deleted successfully.`, 'success');
    } catch (error) {
        showToast(`Error deleting profile: ${error.message}`, 'error');
        logToConsole(`Error deleting profile: ${error.message}`);
    }
}
