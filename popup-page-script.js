// popup-page-script.js
// Version: 1.5
// Main script for Max Extension configuration interface

'use strict';

// State management
let currentProfile = null;
let isDragging = false;
let draggedItem = null;

// DOM Elements
const profileSelect = document.getElementById('profileSelect');
const buttonList = document.getElementById('buttonList');
const consoleOutput = document.getElementById('console');
const saveStatus = document.getElementById('saveStatus');

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
// Console Logging Function
// -------------------------

// Console logging (this is user visible console, not debug one)
function logToConsole(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `${timestamp}: ${message}`;
    consoleOutput.appendChild(logEntry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// -------------------------
// 2. Profile Management Functions
// -------------------------

// Load all profiles and set the current profile
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

// Switch to a different profile
async function switchProfile(profileName) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'switchProfile',
            profileName: profileName
        });

        currentProfile = response.config;
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

// Function to create a new empty profile using minimalDefaultConfig
async function addNewEmptyProfile() {
    const profileName = prompt('Enter new profile name:');
    if (!profileName) {
        logToConsole('Profile creation canceled: No name provided.');
        return;
    }

    // Trim whitespace and validate profile name
    const trimmedProfileName = profileName.trim();
    if (trimmedProfileName === "") {
        alert('Profile name cannot be empty.');
        logToConsole('Profile creation failed: Empty name provided.');
        return;
    }

    // Check if profile name already exists
    const existingProfiles = Array.from(profileSelect.options).map(option => option.value);
    if (existingProfiles.includes(trimmedProfileName)) {
        alert('A profile with this name already exists. Please choose a different name.');
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
        logToConsole(`Created new empty profile: ${trimmedProfileName}`);
    } catch (error) {
        logToConsole(`Error creating profile: ${error.message}`);
    }
}

// -------------------------
// 4. Copy Current Profile
// (Optional: No changes needed for Step 1 and 2)
// -------------------------

async function copyCurrentProfile() { // Existing Function
    const newProfileName = prompt('Enter a name for the new profile:');
    if (!newProfileName) {
        logToConsole('Profile copy canceled: No name provided.');
        return;
    }

    // Check if profile name already exists
    const existingProfiles = Array.from(profileSelect.options).map(option => option.value);
    if (existingProfiles.includes(newProfileName)) {
        alert('A profile with this name already exists. Please choose a different name.');
        logToConsole(`Profile copy failed: "${newProfileName}" already exists.`);
        return;
    }

    try {
        // Deep copy current profile settings
        const newConfig = JSON.parse(JSON.stringify(currentProfile));
        newConfig.PROFILE_NAME = newProfileName;

        await chrome.runtime.sendMessage({
            type: 'saveConfig',
            profileName: newProfileName,
            config: newConfig
        });

        await loadProfiles();
        profileSelect.value = newProfileName;
        await switchProfile(newProfileName);
        logToConsole(`Copied profile to new profile: ${newProfileName}`);
    } catch (error) {
        logToConsole(`Error copying profile: ${error.message}`);
    }
}

// Delete the current profile
async function deleteCurrentProfile() {
    if (currentProfile.PROFILE_NAME === 'Default') {
        alert('Cannot delete Default profile');
        return;
    }

    if (!confirm(`Delete profile "${currentProfile.PROFILE_NAME}"?`)) return;

    try {
        await chrome.runtime.sendMessage({
            type: 'deleteProfile',
            profileName: currentProfile.PROFILE_NAME
        });

        await loadProfiles();
        logToConsole(`Deleted profile: ${currentProfile.PROFILE_NAME}`);
    } catch (error) {
        logToConsole(`Error deleting profile: ${error.message}`);
    }
}

// -------------------------
// 5. Button Management Functions
// -------------------------

function createButtonElement(button, index) {
    const buttonItem = document.createElement('div');
    buttonItem.className = 'button-item';
    buttonItem.dataset.index = index;
    buttonItem.draggable = true; // Ensure the item is draggable

    if (button.separator) {
        buttonItem.classList.add('separator-item');
        // Updated separator with labeled text
        buttonItem.innerHTML = `
            <div class="separator-line"></div>
            <span class="separator-text">Separator</span>
            <div class="separator-line"></div>
            <button class="delete-button">Delete</button>
        `;
    } else {
        buttonItem.innerHTML = `
            <div class="drag-handle" draggable="true">&#9776;</div>
            <input type="text" class="emoji-input" value="${button.icon}">
            <textarea class="text-input" rows="1">${button.text}</textarea>
            <label>
                <input type="checkbox" class="autosend-toggle" ${button.autoSend ? 'checked' : ''}>
                Auto-send
            </label>
            <button class="delete-button">Delete</button>
        `;
    }

    return buttonItem;
}

function updateButtonList() {
    buttonList.innerHTML = '';
    if (currentProfile.customButtons && currentProfile.customButtons.length > 0) {
        currentProfile.customButtons.forEach((button, index) => {
            const buttonElement = createButtonElement(button, index);
            buttonList.appendChild(buttonElement);
        });
    } else {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No custom buttons. Add buttons using the buttons above.';
        emptyMessage.className = 'empty-message';
        buttonList.appendChild(emptyMessage);
    }

    // After updating the list, attach event listeners
    attachTextareaAutoResize();
    attachEmojiInputListeners();
    attachAutoSendToggleListeners();
}

async function addButton() {
    const icon = document.getElementById('buttonIcon').value || '✨';
    const text = document.getElementById('buttonText').value || 'New Button';
    const autoSend = document.getElementById('buttonAutoSendToggle').checked;

    currentProfile.customButtons.push({
        icon: icon,
        text: text,
        autoSend: autoSend
    });

    await saveCurrentProfile();
    updateButtonList();
    logToConsole('Added new button');
}

async function addSeparator() {
    currentProfile.customButtons.push({ separator: true });
    await saveCurrentProfile();
    updateButtonList();
    logToConsole('Added separator');
}

async function deleteButton(index) {
    currentProfile.customButtons.splice(index, 1);
    await saveCurrentProfile();
    updateButtonList();
    logToConsole('Deleted button');
}

// -------------------------
// 6. Drag and Drop Handling
// -------------------------

function handleDragStart(e) {
    if (e.target.classList.contains('drag-handle') || e.target.classList.contains('separator-item')) {
        isDragging = true;
        draggedItem = e.target.closest('.button-item');
        draggedItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';

        // Set a transparent image as drag image to avoid default ghost
        const img = new Image();
        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
        e.dataTransfer.setDragImage(img, 0, 0);
    } else {
        e.preventDefault();
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.button-item');
    if (!target || target === draggedItem) return;

    const bounding = target.getBoundingClientRect();
    const offset = bounding.y + (bounding.height / 2);
    const parent = target.parentNode;

    if (e.clientY - bounding.y < bounding.height / 2) {
        parent.insertBefore(draggedItem, target);
    } else {
        parent.insertBefore(draggedItem, target.nextSibling);
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    isDragging = false;
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }

    // Update the order in the profile
    const newOrder = Array.from(buttonList.children).map(child => parseInt(child.dataset.index));
    currentProfile.customButtons = newOrder.map(index => currentProfile.customButtons[index]);

    saveCurrentProfile();
    updateButtonList();
    logToConsole('Reordered buttons');
}

function handleDragEnd(e) {
    isDragging = false;
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
}

// -------------------------
// 7. Settings Management
// -------------------------

async function updateGlobalSettings() {
    currentProfile.globalAutoSendEnabled = document.getElementById('autoSendToggle').checked;
    currentProfile.enableShortcuts = document.getElementById('shortcutsToggle').checked;
    await saveCurrentProfile();
    logToConsole('Updated global settings');
}

async function revertToDefault() {
    if (!confirm('Revert current profile to default settings?')) return;

    try {
        const response = await chrome.runtime.sendMessage({ type: 'createDefaultProfile' });
        currentProfile = response.config;
        await saveCurrentProfile();
        updateInterface();
        logToConsole('Reverted to default settings');
    } catch (error) {
        logToConsole(`Error reverting to default: ${error.message}`);
    }
}

// -------------------------
// 8. Save and Update Functions
// -------------------------

async function saveCurrentProfile() {
    try {
        await chrome.runtime.sendMessage({
            type: 'saveConfig',
            profileName: currentProfile.PROFILE_NAME,
            config: currentProfile
        });
        updateSaveStatus();
        return true;
    } catch (error) {
        logToConsole(`Error saving profile: ${error.message}`);
        return false;
    }
}

function updateSaveStatus() {
    const timestamp = new Date().toLocaleTimeString();
    saveStatus.textContent = `Last saved: ${timestamp}`;
}

function updateInterface() {
    // Update button list
    updateButtonList();

    // Update settings
    document.getElementById('autoSendToggle').checked = currentProfile.globalAutoSendEnabled;
    document.getElementById('shortcutsToggle').checked = currentProfile.enableShortcuts;

    // Clear input fields
    document.getElementById('buttonIcon').value = '';
    document.getElementById('buttonText').value = '';
    document.getElementById('buttonAutoSendToggle').checked = true; // Reset to default checked
}

// -------------------------
// 9. Event Listeners Attachment Functions
// -------------------------

// Function to auto-resize textareas and handle input changes
function attachTextareaAutoResize() {
    const textareas = buttonList.querySelectorAll('textarea.text-input');
    textareas.forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;

        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
            // Update the corresponding button text
            const buttonItem = textarea.closest('.button-item');
            const index = parseInt(buttonItem.dataset.index);
            currentProfile.customButtons[index].text = textarea.value;
            saveCurrentProfile();
        });
    });
}

// Function to handle emoji input changes
function attachEmojiInputListeners() {
    const emojiInputs = buttonList.querySelectorAll('input.emoji-input');
    emojiInputs.forEach(input => {
        input.addEventListener('input', () => {
            const buttonItem = input.closest('.button-item');
            const index = parseInt(buttonItem.dataset.index);
            currentProfile.customButtons[index].icon = input.value;
            saveCurrentProfile();
        });
    });
}

// Function to handle auto-send toggle changes
function attachAutoSendToggleListeners() {
    const autoSendToggles = buttonList.querySelectorAll('input.autosend-toggle');
    autoSendToggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            const buttonItem = toggle.closest('.button-item');
            const index = parseInt(buttonItem.dataset.index);
            currentProfile.customButtons[index].autoSend = toggle.checked;
            saveCurrentProfile();
            logToConsole(`Updated auto-send for button at index ${index} to ${toggle.checked}`);
        });
    });
}

// -------------------------
// 10. Event Listeners
// -------------------------

document.addEventListener('DOMContentLoaded', () => {
    loadProfiles();

    // Profile management
    profileSelect.addEventListener('change', (e) => switchProfile(e.target.value));
    document.getElementById('addProfile').addEventListener('click', addNewEmptyProfile); // Updated Event Listener
    document.getElementById('copyProfile').addEventListener('click', copyCurrentProfile);
    document.getElementById('deleteProfile').addEventListener('click', deleteCurrentProfile);

    // Button management
    document.getElementById('addButton').addEventListener('click', addButton);
    document.getElementById('addSeparator').addEventListener('click', addSeparator);

    // Settings
    document.getElementById('autoSendToggle').addEventListener('change', updateGlobalSettings);
    document.getElementById('shortcutsToggle').addEventListener('change', updateGlobalSettings);
    document.getElementById('revertDefault').addEventListener('click', revertToDefault);

    // Drag and drop
    buttonList.addEventListener('dragstart', handleDragStart);
    buttonList.addEventListener('dragover', handleDragOver);
    buttonList.addEventListener('drop', handleDrop);
    buttonList.addEventListener('dragend', handleDragEnd);

    // Button list event delegation
    buttonList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-button')) {
            const buttonItem = e.target.closest('.button-item');
            const index = parseInt(buttonItem.dataset.index);
            await deleteButton(index);
        }
    });

    // Initialize event listeners
    attachTextareaAutoResize();
    attachEmojiInputListeners();
    attachAutoSendToggleListeners();
});
