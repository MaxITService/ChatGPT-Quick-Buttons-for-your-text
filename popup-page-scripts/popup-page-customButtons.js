// popup-page-customButtons.js
// The extension adds custom buttons to webpage, and needs to manage them via the popup page.
// This file contains functions to create, update, delete custom buttons and separators, that will
// be used in the actual web page, but this popup manages their existance and position, by representing them
// as cards in  <div id="buttonCardsList" ...> </div>
// This file creates elements that represent custom buttons (card like elements)
// Button cards contain: emoji input, text input, auto-send toggle, delete button, that are
// used to create custom buttons for the extension. 
// and separators for mostly visual funciton (separatprs behave like button cards with less stuff)
// separator cards contain: visuals, delete button. 
// version: 1.0

// -------------------------
// Create Button Element - this is start of everything, there can be zero to infinite buttons
// -------------------------

/**
 * Creates a button element for the button list.
 * @param {Object} button - The button data from the profile.
 * @param {number} index - The index of the button in the customButtons array.
 * @returns {HTMLElement} - The button item element.
 */
function createButtonCardElement(button, index) {
    const buttonItem = document.createElement('div');
    buttonItem.className = 'button-item';
    buttonItem.dataset.index = index;
    buttonItem.draggable = true; // Ensure the item is draggable

    if (button.separator) {
        buttonItem.classList.add('separator-item');
        buttonItem.innerHTML = `
            <div class="separator-line"></div>
            <span class="separator-text">Separator</span>
            <div class="separator-line"></div>
            <button class="delete-button danger">Delete</button>
        `;
    } else {
        buttonItem.innerHTML = `
            <div class="drag-handle" draggable="true">&#9776;</div>
            <input type="text" class="emoji-input" value="${button.icon}">
            <textarea class="text-input" rows="1">${button.text}</textarea>
            <label class="checkbox-row">
                <input type="checkbox" class="autosend-toggle" ${button.autoSend ? 'checked' : ''}>
                <span>Auto-send</span>
                ${ index < 10 
                    ? `<span class="shortcut-indicator">[Ctrl+${index === 9 ? 0 : index + 1}]</span>` 
                    : '' 
                }
            </label>
            <button class="delete-button danger">Delete</button>
        `;
    }

    return buttonItem;
}


/**
 * Updates the list of custom button cards in the buttonCardsList.
 */
function updatebuttonCardsList() {
    buttonCardsList.innerHTML = ''; // This already removes old listeners
    if (currentProfile.customButtons && currentProfile.customButtons.length > 0) {
        currentProfile.customButtons.forEach((button, index) => {
            const buttonElement = createButtonCardElement(button, index);
            buttonCardsList.appendChild(buttonElement);
        });
    } else {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No custom buttons. Add buttons using the buttons above.';
        emptyMessage.className = 'empty-message';
        buttonCardsList.appendChild(emptyMessage);
    }

    // After updating the list, attach event listeners
    textareaSaverAndResizerFunc();
    attachEmojiInputListeners();
    attachAutoSendToggleListeners();
}

// -------------------------
// management section for buttons, where user can add button card with:
//  specific emoji, text, auto-send toggle or clear it and start over.

/**
 * Clears the text in the button text input field. Used only for adding new button.
 */
function clearText() {
    document.getElementById('buttonText').value = '';
    logToGUIConsole('Cleared button text input.');
    document.getElementById('buttonIcon').value = '';
    showToast('Button text cleared', 'info');
}

/**
 * Adds a new custom button and related card to the current profile.
 */
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
    updatebuttonCardsList();
    logToGUIConsole('Added new button');
}


// Section for managing buttons and separators, where user can add, delete, move or update them.
/**
 * Adds a separator to the current profile.
 */
async function addSeparator() {
    currentProfile.customButtons.push({ separator: true });
    await saveCurrentProfile();
    updatebuttonCardsList();
    logToGUIConsole('Added separator');
}

/**
 * Deletes a button at a specified index.
 * @param {number} index - The index of the button to delete.
 */
async function deleteButton(index) {
    currentProfile.customButtons.splice(index, 1);
    await saveCurrentProfile();
    updatebuttonCardsList();
    logToGUIConsole('Deleted button');
}


// -------------------------
// Drag and Drop Functionality
// -------------------------

let isDragging = false;
let draggedItem = null;
let lastDragPosition = { x: 0, y: 0 };

function handleDragStart(e) {
    // Define interactive elements that should not initiate dragging.
    const interactiveTags = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'];
    if (interactiveTags.includes(e.target.tagName)) {
        // Do not initiate drag when interacting with these elements.
        return;
    }
    const buttonItem = e.target.closest('.button-item');
    if (buttonItem) {
        isDragging = true;
        draggedItem = buttonItem;
        buttonItem.classList.add('dragging');
        document.body.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';

        const img = new Image();
        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
        e.dataTransfer.setDragImage(img, 0, 0);
    }
}

function autoScroll(e) {
    const scrollThreshold = 220;
    const maxScrollSpeed = 400;
    const { innerWidth, innerHeight } = window;
    let scrollX = 0, scrollY = 0;

    if (e.clientY < scrollThreshold) {
        scrollY = -maxScrollSpeed * ((scrollThreshold - e.clientY) / scrollThreshold);
    } else if (innerHeight - e.clientY < scrollThreshold) {
        scrollY = maxScrollSpeed * ((scrollThreshold - (innerHeight - e.clientY)) / scrollThreshold);
    }

    if (e.clientX < scrollThreshold) {
        scrollX = -maxScrollSpeed * ((scrollThreshold - e.clientX) / scrollThreshold);
    } else if (innerWidth - e.clientX < scrollThreshold) {
        scrollX = maxScrollSpeed * ((scrollThreshold - (innerWidth - e.clientX)) / scrollThreshold);
    }

    if (scrollX !== 0 || scrollY !== 0) {
        window.scrollBy({
            top: scrollY,
            left: scrollX,
            behavior: 'smooth'
        });
    }
}

function handleDragOver(e) {
    e.preventDefault();
    if (!isDragging) return;

    e.dataTransfer.dropEffect = 'move';
    autoScroll(e);
    lastDragPosition = { x: e.clientX, y: e.clientY };

    const target = e.target.closest('.button-item');
    if (!target || target === draggedItem) return;

    const bounding = target.getBoundingClientRect();
    const parent = target.parentNode;
    const offsetY = e.clientY - bounding.top;
    const isBefore = offsetY < bounding.height / 2;

    if (isBefore) {
        parent.insertBefore(draggedItem, target);
    } else {
        parent.insertBefore(draggedItem, target.nextSibling);
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!isDragging || !draggedItem) return;
    finalizeDrag();
    logToGUIConsole('Reordered buttons');
}

function handleDragEnd(e) {
    if (!isDragging || !draggedItem) return;
    finalizeDrag();
}

function finalizeDrag() {
    isDragging = false;
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }

    document.body.classList.remove('dragging');
    // Removed clearInterval call as scrollInterval is unused.

    const newOrder = Array.from(buttonCardsList.children).map(child => parseInt(child.dataset.index));
    currentProfile.customButtons = newOrder.map(index => currentProfile.customButtons[index]);

    saveCurrentProfile();
    updatebuttonCardsList();
}


// -------------------------
// Section that controls what happens inside cards of buttons and separators:
/**
 * Adds an input listener to a textarea (by its ID) so that its height
 * dynamically adjusts to fit its content.
 *
 * @param {string} textareaId - The ID of the textarea element.
 */
function textareaInputAreaResizerFun(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) {
        console.error(`Textarea with id "${textareaId}" not found.`);
        return;
    }

    textarea.style.overflow = 'hidden';
    textarea.style.resize = 'none';

    const resizeTextarea = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };

    textarea.addEventListener('input', resizeTextarea);
    resizeTextarea();
}

/**
 * Attaches input listeners to emoji input fields to update button icons.
 * Modified to use debouncedSaveCurrentProfile() for throttled saving.
 */
function attachEmojiInputListeners() {
    const emojiInputs = buttonCardsList.querySelectorAll('input.emoji-input');
    emojiInputs.forEach(input => {
        input.addEventListener('input', () => {
            const buttonItem = input.closest('.button-item');
            const index = parseInt(buttonItem.dataset.index);
            currentProfile.customButtons[index].icon = input.value;
            debouncedSaveCurrentProfile();
        });
    });
}

/**
 * Attaches listeners to auto-send toggle inputs to update button settings.
 * Modified to use debouncedSaveCurrentProfile() for throttled saving.
 */
function attachAutoSendToggleListeners() {
    const autoSendToggles = buttonCardsList.querySelectorAll('input.autosend-toggle');
    autoSendToggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            const buttonItem = toggle.closest('.button-item');
            const index = parseInt(buttonItem.dataset.index);
            currentProfile.customButtons[index].autoSend = toggle.checked;
            debouncedSaveCurrentProfile();
            logToGUIConsole(`Updated auto-send for button at index ${index} to ${toggle.checked}`);
        });
    });
}

/**
 * Automatically resizes textareas based on their content and attaches input listeners.
 * Modified to use debouncedSaveCurrentProfile() for throttled saving.
 */
function textareaSaverAndResizerFunc() {
    const textareas = buttonCardsList.querySelectorAll('textarea.text-input');
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
            
            // Use debounced save to throttle saving
            debouncedSaveCurrentProfile();
        });
    });
}
