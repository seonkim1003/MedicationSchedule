// API Configuration
// For local development, use: 'http://localhost:8787'
// For production, use your deployed Worker URL
const API_BASE_URL = 'https://medication-tracker-api.seonkim1003.workers.dev';

// Available users
const USERS = ['Seonho', 'Peter', 'Angelina'];

// Get user ID from localStorage
function getUserId() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && USERS.includes(currentUser)) {
        return currentUser.toLowerCase();
    }
    return null; // No user logged in
}

// Get current user name
function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

// API Client
class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.updateUserId();
    }

    updateUserId() {
        this.userId = getUserId();
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': this.userId,
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            // Provide more helpful error message
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                const helpfulError = new Error('Cannot connect to API. Make sure the Worker is running. For local development, run: npm run worker:dev');
                helpfulError.originalError = error;
                throw helpfulError;
            }
            throw error;
        }
    }

    async getData() {
        return this.request('/api/data');
    }

    async saveMedications(medications) {
        return this.request('/api/medications', {
            method: 'POST',
            body: JSON.stringify({ medications }),
        });
    }

    async saveEntry(date, medicationId, taken, timestamp, doseIndex = 0) {
        return this.request('/api/entry', {
            method: 'POST',
            body: JSON.stringify({ date, medicationId, taken, timestamp, doseIndex }),
        });
    }

    async updateEntryTimestamp(date, medicationId, timestamp, doseIndex = 0) {
        return this.request('/api/entry', {
            method: 'PUT',
            body: JSON.stringify({ date, medicationId, timestamp, doseIndex }),
        });
    }

    async deleteMedication(medicationId) {
        return this.request(`/api/medication/${medicationId}`, {
            method: 'DELETE',
        });
    }

    async deleteEntry(date, medicationId, doseIndex) {
        return this.request('/api/entry', {
            method: 'DELETE',
            body: JSON.stringify({ date, medicationId, doseIndex }),
        });
    }
}

// Calendar Application
class MedicationTracker {
    constructor() {
        this.api = new APIClient(API_BASE_URL);
        this.currentDate = new Date();
        this.medications = [];
        this.entries = {};
        this.selectedDate = null;
        this.checkLogin();
    }

    checkLogin() {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            // Show login modal
            document.getElementById('loginModal').classList.add('active');
            document.getElementById('mainContainer').style.display = 'none';
            this.attachLoginListeners();
        } else {
            // User is logged in, initialize app
            this.init();
        }
    }

    attachLoginListeners() {
        const loginButtons = document.querySelectorAll('.user-login-btn');
        loginButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const user = btn.getAttribute('data-user');
                this.login(user);
            });
        });

        // Prevent login modal from closing on outside click
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.addEventListener('click', (e) => {
                // Only prevent if clicking the modal background, not the content
                if (e.target.id === 'loginModal') {
                    e.stopPropagation();
                }
            });
        }
    }

    login(user) {
        if (!USERS.includes(user)) {
            alert('Invalid user selected');
            return;
        }
        
        localStorage.setItem('currentUser', user);
        this.api.updateUserId();
        
        // Hide login modal, show main container
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('mainContainer').style.display = 'block';
        
        // Update user display
        this.updateUserDisplay();
        
        // Initialize app
        this.init();
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('currentUser');
            this.api.updateUserId();
            
            // Hide main container, show login modal
            document.getElementById('mainContainer').style.display = 'none';
            document.getElementById('loginModal').classList.add('active');
            
            // Clear data
            this.medications = [];
            this.entries = {};
        }
    }

    updateUserDisplay() {
        const currentUser = getCurrentUser();
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay && currentUser) {
            userDisplay.textContent = `Logged in as: ${currentUser}`;
        }
    }

    async init() {
        // Ensure API client has the correct user ID
        this.api.updateUserId();
        await this.loadData();
        this.renderCalendar();
        this.attachEventListeners();
        this.updateUserDisplay();
    }

    async loadData() {
        try {
            const data = await this.api.getData();
            this.medications = data.medications || [];
            this.entries = data.entries || {};
        } catch (error) {
            console.error('Failed to load data:', error);
            // Use empty data if API fails
            this.medications = [];
            this.entries = {};
        }
    }

    attachEventListeners() {
        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // Tracking modal
        document.getElementById('closeTracking').addEventListener('click', () => {
            this.closeTrackingModal();
        });

        // Add medication
        document.getElementById('addMedicationBtn').addEventListener('click', () => {
            this.addMedication();
        });

        document.getElementById('newMedicationName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addMedication();
            }
        });

        // Frequency type change
        document.getElementById('frequencyType').addEventListener('change', (e) => {
            const weeklyRow = document.getElementById('weeklyDaysRow');
            if (e.target.value === 'weekly') {
                weeklyRow.style.display = 'block';
            } else {
                weeklyRow.style.display = 'none';
            }
        });

        // Tab switching
        document.getElementById('calendarTab').addEventListener('click', () => {
            this.switchTab('calendar');
        });

        document.getElementById('dataTab').addEventListener('click', () => {
            this.switchTab('data');
        });

        // Close modals on outside click
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettingsModal();
            }
        });

        document.getElementById('trackingModal').addEventListener('click', (e) => {
            if (e.target.id === 'trackingModal') {
                this.closeTrackingModal();
            }
        });

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    }

    getMonthYearString() {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }

    getDaysInMonth() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        return new Date(year, month + 1, 0).getDate();
    }

    getFirstDayOfMonth() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        return new Date(year, month, 1).getDay();
    }

    isToday(date) {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    shouldTrackMedication(med, date) {
        if (!med.frequency) return true; // Default to daily if no frequency set
        
        const frequency = med.frequency || 'daily';
        const dayOfWeek = date.getDay();
        
        switch (frequency) {
            case 'daily':
                return true;
            case 'every-other-day':
                // Track on even days of month (2nd, 4th, 6th, etc.)
                return date.getDate() % 2 === 0;
            case 'weekly':
                const daysOfWeek = med.daysOfWeek || [];
                return daysOfWeek.includes(dayOfWeek.toString());
            default:
                return true;
        }
    }

    getMedicationStatus(dateKey) {
        const dayEntries = this.entries[dateKey] || {};
        const date = new Date(dateKey + 'T00:00:00');
        const statuses = [];
        
        this.medications.forEach(med => {
            if (!this.shouldTrackMedication(med, date)) {
                return; // Skip medications not scheduled for this day
            }
            
            const timesPerDay = med.timesPerDay || 1;
            const medEntries = dayEntries[med.id];
            const medColor = med.color || '#ffc107'; // Default to yellow if no color set
            
            for (let i = 0; i < timesPerDay; i++) {
                if (medEntries && medEntries.doses && medEntries.doses[i]) {
                    const dose = medEntries.doses[i];
                    statuses.push({
                        status: dose.taken ? 'taken' : 'missed',
                        color: null
                    });
                } else {
                    statuses.push({
                        status: 'pending',
                        color: medColor
                    });
                }
            }
        });
        
        return statuses;
    }

    renderCalendar() {
        document.getElementById('monthYear').textContent = this.getMonthYearString();

        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';

        const daysInMonth = this.getDaysInMonth();
        const firstDay = this.getFirstDayOfMonth();
        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();
        const today = new Date();

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day-cell other-month';
            calendarDays.appendChild(emptyDay);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dateKey = this.formatDateKey(date);
            const statuses = this.getMedicationStatus(dateKey);

            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';
            if (this.isToday(date)) {
                dayCell.classList.add('today');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayCell.appendChild(dayNumber);

            const statusBoxes = document.createElement('div');
            statusBoxes.className = 'medication-status-boxes';

            statuses.forEach(statusInfo => {
                const box = document.createElement('div');
                const status = typeof statusInfo === 'string' ? statusInfo : statusInfo.status;
                box.className = `status-box ${status}`;
                // If it's a pending status with a custom color, apply it
                if (status === 'pending' && statusInfo.color) {
                    box.style.background = statusInfo.color;
                    box.style.borderColor = statusInfo.color;
                }
                statusBoxes.appendChild(box);
            });

            dayCell.appendChild(statusBoxes);

            dayCell.addEventListener('click', () => {
                this.openTrackingModal(date);
            });

            calendarDays.appendChild(dayCell);
        }

        // Fill remaining cells
        const totalCells = calendarDays.children.length;
        const remainingCells = 42 - totalCells;
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day-cell other-month';
            calendarDays.appendChild(emptyDay);
        }
    }

    openSettingsModal() {
        this.renderMedicationList();
        document.getElementById('settingsModal').classList.add('active');
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    renderMedicationList() {
        const list = document.getElementById('medicationList');
        list.innerHTML = '';

        if (this.medications.length === 0) {
            list.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No medications added yet. Add one below!</p>';
            return;
        }

        this.medications.forEach(med => {
            const item = document.createElement('div');
            item.className = 'medication-item';

            const info = document.createElement('div');
            info.style.flex = '1';
            
            const name = document.createElement('div');
            name.className = 'medication-item-name';
            name.style.display = 'flex';
            name.style.alignItems = 'center';
            name.style.gap = '10px';
            
            // Color indicator
            const colorIndicator = document.createElement('div');
            colorIndicator.style.width = '20px';
            colorIndicator.style.height = '20px';
            colorIndicator.style.borderRadius = '4px';
            colorIndicator.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            colorIndicator.style.backgroundColor = med.color || '#ffc107';
            colorIndicator.style.cursor = 'pointer';
            colorIndicator.title = 'Click to change color';
            colorIndicator.addEventListener('click', () => {
                this.editMedicationColor(med);
            });
            name.appendChild(colorIndicator);
            
            const nameText = document.createElement('span');
            nameText.textContent = med.name;
            name.appendChild(nameText);
            info.appendChild(name);

            const details = document.createElement('div');
            details.style.fontSize = '12px';
            details.style.color = '#666';
            details.style.marginTop = '4px';
            const timesPerDay = med.timesPerDay || 1;
            const frequency = med.frequency || 'daily';
            let freqText = '';
            if (frequency === 'daily') {
                freqText = 'Daily';
            } else if (frequency === 'every-other-day') {
                freqText = 'Every Other Day';
            } else if (frequency === 'weekly') {
                const days = med.daysOfWeek || [];
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                freqText = 'Weekly: ' + days.map(d => dayNames[parseInt(d)]).join(', ');
            }
            details.textContent = `${timesPerDay}x per day • ${freqText}`;
            info.appendChild(details);
            
            item.appendChild(info);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-med-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                this.deleteMedication(med.id);
            });
            item.appendChild(deleteBtn);

            list.appendChild(item);
        });
    }

    async addMedication() {
        const input = document.getElementById('newMedicationName');
        const name = input.value.trim();

        if (!name) {
            alert('Please enter a medication name');
            return;
        }

        const timesPerDay = parseInt(document.getElementById('timesPerDay').value) || 1;
        const frequencyType = document.getElementById('frequencyType').value;
        const medicationColor = document.getElementById('medicationColor').value;
        
        const newMed = {
            id: Date.now().toString(),
            name: name,
            timesPerDay: timesPerDay,
            frequency: frequencyType,
            color: medicationColor,
        };

        if (frequencyType === 'weekly') {
            const checkboxes = document.querySelectorAll('.day-checkbox:checked');
            const daysOfWeek = Array.from(checkboxes).map(cb => cb.value);
            if (daysOfWeek.length === 0) {
                alert('Please select at least one day of the week');
                return;
            }
            newMed.daysOfWeek = daysOfWeek;
        }

        this.medications.push(newMed);
        input.value = '';
        document.getElementById('timesPerDay').value = '1';
        document.getElementById('frequencyType').value = 'daily';
        document.getElementById('medicationColor').value = '#ffc107';
        document.getElementById('weeklyDaysRow').style.display = 'none';
        document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);

        try {
            await this.api.saveMedications(this.medications);
            this.renderMedicationList();
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to save medication:', error);
            this.medications.pop(); // Revert on error
            const errorMsg = error.message && error.message.includes('Cannot connect to API')
                ? 'Cannot connect to API server. Please make sure the Worker is running.\n\nFor local development, run: npm run worker:dev'
                : 'Failed to save medication. Please try again.';
            alert(errorMsg);
        }
    }

    async deleteMedication(medicationId) {
        if (!confirm('Are you sure you want to delete this medication?')) {
            return;
        }

        this.medications = this.medications.filter(m => m.id !== medicationId);

        try {
            await this.api.deleteMedication(medicationId);
            this.renderMedicationList();
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to delete medication:', error);
            alert('Failed to delete medication. Please try again.');
        }
    }

    async editMedicationColor(med) {
        // Create a modal-like color picker
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = med.color || '#ffc107';
        colorPicker.style.position = 'fixed';
        colorPicker.style.left = '50%';
        colorPicker.style.top = '50%';
        colorPicker.style.transform = 'translate(-50%, -50%)';
        colorPicker.style.width = '200px';
        colorPicker.style.height = '200px';
        colorPicker.style.zIndex = '10000';
        colorPicker.style.border = 'none';
        colorPicker.style.borderRadius = '10px';
        colorPicker.style.cursor = 'pointer';
        
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '9999';
        overlay.style.cursor = 'pointer';
        
        const handleColorChange = () => {
            med.color = colorPicker.value;
            document.body.removeChild(colorPicker);
            document.body.removeChild(overlay);
            
            // Save and update
            this.api.saveMedications(this.medications).then(() => {
                this.renderMedicationList();
                this.renderCalendar();
            }).catch(error => {
                console.error('Failed to update medication color:', error);
                alert('Failed to update medication color. Please try again.');
            });
        };
        
        colorPicker.addEventListener('change', handleColorChange);
        overlay.addEventListener('click', () => {
            document.body.removeChild(colorPicker);
            document.body.removeChild(overlay);
        });
        
        document.body.appendChild(overlay);
        document.body.appendChild(colorPicker);
        colorPicker.click();
    }

    openTrackingModal(date) {
        this.selectedDate = date;
        const dateKey = this.formatDateKey(date);
        const dateStr = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        document.getElementById('trackingDate').textContent = dateStr;
        this.renderTrackingInterface(dateKey);
        document.getElementById('trackingModal').classList.add('active');
    }

    closeTrackingModal() {
        document.getElementById('trackingModal').classList.remove('active');
        this.selectedDate = null;
    }

    renderTrackingInterface(dateKey) {
        const container = document.getElementById('medicationTracking');
        container.innerHTML = '';

        if (this.medications.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No medications configured. Please add medications in Settings first.</p>';
            return;
        }

        const dayEntries = this.entries[dateKey] || {};
        const date = new Date(dateKey + 'T00:00:00');

        this.medications.forEach(med => {
            // Check if medication should be tracked on this day
            if (!this.shouldTrackMedication(med, date)) {
                return; // Skip medications not scheduled for this day
            }

            const timesPerDay = med.timesPerDay || 1;
            const medEntries = dayEntries[med.id] || {};
            const doses = medEntries.doses || [];

            const item = document.createElement('div');
            item.className = 'medication-tracking-item';

            const title = document.createElement('h3');
            title.textContent = med.name;
            if (timesPerDay > 1) {
                title.textContent += ` (${timesPerDay}x per day)`;
            }
            item.appendChild(title);

            // Create tracking for each dose
            for (let i = 0; i < timesPerDay; i++) {
                const dose = doses[i];
                const doseTaken = dose ? dose.taken : null;
                const doseTimestamp = dose ? dose.timestamp : null;

                if (timesPerDay > 1) {
                    const doseLabel = document.createElement('div');
                    doseLabel.style.fontSize = '14px';
                    doseLabel.style.fontWeight = '600';
                    doseLabel.style.marginTop = i > 0 ? '20px' : '0';
                    doseLabel.style.marginBottom = '10px';
                    doseLabel.style.color = '#667eea';
                    doseLabel.textContent = `Dose ${i + 1}:`;
                    item.appendChild(doseLabel);
                }

                const buttons = document.createElement('div');
                buttons.className = 'tracking-buttons';

                const yesBtn = document.createElement('button');
                yesBtn.className = `track-btn yes ${doseTaken === true ? 'active' : ''}`;
                yesBtn.textContent = '✓ Yes';
                yesBtn.addEventListener('click', () => {
                    this.trackMedicationDose(dateKey, med.id, i, true);
                });
                buttons.appendChild(yesBtn);

                const noBtn = document.createElement('button');
                noBtn.className = `track-btn no ${doseTaken === false ? 'active' : ''}`;
                noBtn.textContent = '✗ No';
                noBtn.addEventListener('click', () => {
                    this.trackMedicationDose(dateKey, med.id, i, false);
                });
                buttons.appendChild(noBtn);

                item.appendChild(buttons);

                if (doseTimestamp) {
                    const timestampDisplay = document.createElement('div');
                    timestampDisplay.className = 'timestamp-display';
                    const date = new Date(doseTimestamp);
                    timestampDisplay.innerHTML = `<strong>Recorded:</strong> ${date.toLocaleString()}`;
                    item.appendChild(timestampDisplay);
                }

                // Edit timestamp option
                const editTimestamp = document.createElement('div');
                editTimestamp.className = 'edit-timestamp';

                const timeInput = document.createElement('input');
                timeInput.type = 'datetime-local';
                if (doseTimestamp) {
                    const date = new Date(doseTimestamp);
                    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16);
                    timeInput.value = localDateTime;
                }
                editTimestamp.appendChild(timeInput);

                const updateBtn = document.createElement('button');
                updateBtn.textContent = 'Update Timestamp';
                updateBtn.addEventListener('click', () => {
                    const newTimestamp = new Date(timeInput.value).toISOString();
                    this.updateTimestamp(dateKey, med.id, i, newTimestamp);
                });
                editTimestamp.appendChild(updateBtn);

                item.appendChild(editTimestamp);

                // Clear/Delete status button
                if (doseTaken !== null) {
                    const clearBtn = document.createElement('button');
                    clearBtn.className = 'clear-status-btn';
                    clearBtn.textContent = 'Clear Status';
                    clearBtn.addEventListener('click', () => {
                        this.clearMedicationStatus(dateKey, med.id, i);
                    });
                    item.appendChild(clearBtn);
                }
            }

            container.appendChild(item);
        });
    }

    async trackMedicationDose(dateKey, medicationId, doseIndex, taken) {
        const timestamp = new Date().toISOString();

        if (!this.entries[dateKey]) {
            this.entries[dateKey] = {};
        }

        if (!this.entries[dateKey][medicationId]) {
            this.entries[dateKey][medicationId] = { doses: [] };
        }

        if (!this.entries[dateKey][medicationId].doses) {
            this.entries[dateKey][medicationId].doses = [];
        }

        // Ensure doses array is large enough
        while (this.entries[dateKey][medicationId].doses.length <= doseIndex) {
            this.entries[dateKey][medicationId].doses.push(null);
        }

        this.entries[dateKey][medicationId].doses[doseIndex] = {
            taken: taken,
            timestamp: timestamp,
        };

        try {
            await this.api.saveEntry(dateKey, medicationId, taken, timestamp, doseIndex);
            this.renderTrackingInterface(dateKey);
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to save entry:', error);
            // Revert on error
            this.entries[dateKey][medicationId].doses[doseIndex] = null;
            alert('Failed to save entry. Please try again.');
        }
    }

    async updateTimestamp(dateKey, medicationId, doseIndex, timestamp) {
        if (!this.entries[dateKey] || !this.entries[dateKey][medicationId] || 
            !this.entries[dateKey][medicationId].doses || 
            !this.entries[dateKey][medicationId].doses[doseIndex]) {
            alert('No entry found to update');
            return;
        }

        this.entries[dateKey][medicationId].doses[doseIndex].timestamp = timestamp;

        try {
            await this.api.updateEntryTimestamp(dateKey, medicationId, timestamp, doseIndex);
            this.renderTrackingInterface(dateKey);
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to update timestamp:', error);
            alert('Failed to update timestamp. Please try again.');
        }
    }

    async clearMedicationStatus(dateKey, medicationId, doseIndex) {
        if (!confirm('Are you sure you want to clear this status?')) {
            return;
        }

        if (!this.entries[dateKey] || !this.entries[dateKey][medicationId] || 
            !this.entries[dateKey][medicationId].doses || 
            !this.entries[dateKey][medicationId].doses[doseIndex]) {
            return;
        }

        // Remove the dose entry
        this.entries[dateKey][medicationId].doses[doseIndex] = null;

        // Clean up empty doses array if all doses are null
        const hasAnyDoses = this.entries[dateKey][medicationId].doses.some(d => d !== null);
        if (!hasAnyDoses) {
            delete this.entries[dateKey][medicationId];
            // If no medications left for this day, remove the day entry
            if (Object.keys(this.entries[dateKey]).length === 0) {
                delete this.entries[dateKey];
            }
        }

        try {
            await this.api.deleteEntry(dateKey, medicationId, doseIndex);
            this.renderTrackingInterface(dateKey);
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to clear status:', error);
            alert('Failed to clear status. Please try again.');
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        if (tabName === 'calendar') {
            document.getElementById('calendarTab').classList.add('active');
            document.getElementById('calendarContent').classList.add('active');
        } else if (tabName === 'data') {
            document.getElementById('dataTab').classList.add('active');
            document.getElementById('dataContent').classList.add('active');
            this.renderDataView();
        }
    }

    renderDataView() {
        this.renderStats();
        this.renderMedicationAnalytics();
        this.renderRecentEntries();
    }

    renderStats() {
        const statsContainer = document.getElementById('dataStats');
        statsContainer.innerHTML = '';

        // Calculate total entries
        let totalEntries = 0;
        let totalTaken = 0;
        let totalMissed = 0;
        let totalDays = 0;

        Object.keys(this.entries).forEach(dateKey => {
            const dayEntries = this.entries[dateKey];
            Object.keys(dayEntries).forEach(medId => {
                const medEntry = dayEntries[medId];
                if (medEntry.doses) {
                    medEntry.doses.forEach(dose => {
                        if (dose) {
                            totalEntries++;
                            if (dose.taken) {
                                totalTaken++;
                            } else {
                                totalMissed++;
                            }
                        }
                    });
                }
            });
            totalDays++;
        });

        const adherenceRate = totalEntries > 0 ? Math.round((totalTaken / totalEntries) * 100) : 0;

        const stats = [
            { label: 'Total Entries', value: totalEntries, sublabel: 'All doses tracked' },
            { label: 'Taken', value: totalTaken, sublabel: 'Successfully taken' },
            { label: 'Missed', value: totalMissed, sublabel: 'Missed doses' },
            { label: 'Adherence Rate', value: `${adherenceRate}%`, sublabel: 'Overall compliance' }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <h3>${stat.label}</h3>
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.sublabel}</div>
            `;
            statsContainer.appendChild(card);
        });
    }

    renderMedicationAnalytics() {
        const analyticsContainer = document.getElementById('medicationAnalytics');
        analyticsContainer.innerHTML = '';

        if (this.medications.length === 0) {
            analyticsContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No medications to analyze. Add medications to see analytics.</p>';
            return;
        }

        const title = document.createElement('h3');
        title.textContent = 'Medication Analytics';
        analyticsContainer.appendChild(title);

        this.medications.forEach(med => {
            const chart = document.createElement('div');
            chart.className = 'medication-chart';

            // Calculate stats for this medication
            let totalDoses = 0;
            let takenDoses = 0;
            let missedDoses = 0;
            const dates = [];

            Object.keys(this.entries).forEach(dateKey => {
                const dayEntries = this.entries[dateKey];
                const medEntry = dayEntries[med.id];
                if (medEntry && medEntry.doses) {
                    medEntry.doses.forEach((dose, index) => {
                        if (dose) {
                            totalDoses++;
                            if (dose.taken) {
                                takenDoses++;
                            } else {
                                missedDoses++;
                            }
                            dates.push({ date: dateKey, doseIndex: index, ...dose });
                        }
                    });
                }
            });

            const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

            chart.innerHTML = `
                <div class="medication-chart-header">
                    <h4>${med.name}</h4>
                    <div class="adherence-rate">${adherenceRate}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${adherenceRate}%">${adherenceRate}%</div>
                </div>
                <div class="chart-details">
                    <div class="chart-detail-item">
                        <span class="chart-detail-label">Total Doses:</span>
                        <span class="chart-detail-value">${totalDoses}</span>
                    </div>
                    <div class="chart-detail-item">
                        <span class="chart-detail-label">Taken:</span>
                        <span class="chart-detail-value" style="color: #28a745;">${takenDoses}</span>
                    </div>
                    <div class="chart-detail-item">
                        <span class="chart-detail-label">Missed:</span>
                        <span class="chart-detail-value" style="color: #dc3545;">${missedDoses}</span>
                    </div>
                    <div class="chart-detail-item">
                        <span class="chart-detail-label">Frequency:</span>
                        <span class="chart-detail-value">${med.timesPerDay || 1}x per day</span>
                    </div>
                </div>
            `;

            analyticsContainer.appendChild(chart);
        });
    }

    renderRecentEntries() {
        const entriesContainer = document.getElementById('recentEntries');
        entriesContainer.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = 'Recent Entries';
        entriesContainer.appendChild(title);

        // Collect all entries with dates
        const allEntries = [];
        Object.keys(this.entries).forEach(dateKey => {
            const dayEntries = this.entries[dateKey];
            Object.keys(dayEntries).forEach(medId => {
                const medEntry = dayEntries[medId];
                const medication = this.medications.find(m => m.id === medId);
                if (medication && medEntry.doses) {
                    medEntry.doses.forEach((dose, index) => {
                        if (dose) {
                            allEntries.push({
                                date: dateKey,
                                medication: medication.name,
                                doseIndex: index,
                                ...dose
                            });
                        }
                    });
                }
            });
        });

        // Sort by timestamp (most recent first)
        allEntries.sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
            const dateB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
            return dateB - dateA;
        });

        // Show last 20 entries
        const recentEntries = allEntries.slice(0, 20);

        if (recentEntries.length === 0) {
            entriesContainer.innerHTML += '<p style="color: #999; text-align: center; padding: 20px;">No entries yet. Start tracking your medications!</p>';
            return;
        }

        const entryList = document.createElement('div');
        entryList.className = 'entry-list';

        recentEntries.forEach(entry => {
            const entryItem = document.createElement('div');
            entryItem.className = 'entry-item';

            const info = document.createElement('div');
            info.className = 'entry-item-info';

            const name = document.createElement('div');
            name.className = 'entry-item-name';
            const doseText = entry.doseIndex > 0 ? ` (Dose ${entry.doseIndex + 1})` : '';
            name.textContent = entry.medication + doseText;
            info.appendChild(name);

            const date = document.createElement('div');
            date.className = 'entry-item-date';
            const dateObj = entry.timestamp ? new Date(entry.timestamp) : new Date(entry.date);
            date.textContent = dateObj.toLocaleString();
            info.appendChild(date);

            entryItem.appendChild(info);

            const status = document.createElement('div');
            status.className = `entry-item-status ${entry.taken ? 'taken' : 'missed'}`;
            status.textContent = entry.taken ? '✓ Taken' : '✗ Missed';
            entryItem.appendChild(status);

            entryList.appendChild(entryItem);
        });

        entriesContainer.appendChild(entryList);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MedicationTracker();
});
