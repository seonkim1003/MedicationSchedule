// API Configuration
// For local development, use: 'http://localhost:8787'
// For production, use your deployed Worker URL
const API_BASE_URL = 'https://medication-tracker-api.seonkim1003.workers.dev';

// User names
const USERS = ['Peter', 'Seonho', 'Angelina'];

// Get user ID for a specific user
function getUserIdForUser(userName) {
    return userName.toLowerCase();
}

// API Client
class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
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
        this.entries = {}; // Structure: { user: { dateKey: { medId: { doses: [...] } } } }
        this.selectedDate = null;
        this.selectedUsers = ['Peter', 'Seonho', 'Angelina']; // Default: all selected
        this.currentUser = 'Peter'; // User currently tracking
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderCalendar();
        this.attachEventListeners();
    }

    async loadData() {
        try {
            // Load data for all users
            const allData = {};
            for (const user of USERS) {
                const userId = getUserIdForUser(user);
                const apiClient = new APIClient(API_BASE_URL);
                apiClient.userId = userId;
                try {
                    const data = await apiClient.getData();
                    allData[user] = {
                        medications: data.medications || [],
                        entries: data.entries || {}
                    };
                } catch (error) {
                    console.error(`Failed to load data for ${user}:`, error);
                    allData[user] = { medications: [], entries: {} };
                }
            }
            
            // Use first user's medications as master list (or merge all)
            this.medications = allData[USERS[0]].medications || [];
            
            // Restructure entries by user
            this.entries = {};
            USERS.forEach(user => {
                this.entries[user] = allData[user].entries || {};
            });
        } catch (error) {
            console.error('Failed to load data:', error);
            this.medications = [];
            this.entries = {};
            USERS.forEach(user => {
                if (!this.entries[user]) {
                    this.entries[user] = {};
                }
            });
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

        // User selection checkboxes
        document.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedUsers();
            });
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

    updateSelectedUsers() {
        const checkboxes = document.querySelectorAll('.user-checkbox:checked');
        this.selectedUsers = Array.from(checkboxes).map(cb => cb.value);
        this.renderCalendar();
        if (document.getElementById('dataContent').classList.contains('active')) {
            this.renderDataView();
        }
    }

    getMedicationStatus(dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const statuses = [];
        
        // Get statuses for all selected users
        this.selectedUsers.forEach(user => {
            const userEntries = this.entries[user] || {};
            const dayEntries = userEntries[dateKey] || {};
            
            this.medications.forEach(med => {
                if (!this.shouldTrackMedication(med, date)) {
                    return;
                }
                
                const timesPerDay = med.timesPerDay || 1;
                const medEntries = dayEntries[med.id];
                
                for (let i = 0; i < timesPerDay; i++) {
                    if (medEntries && medEntries.doses && medEntries.doses[i]) {
                        const dose = medEntries.doses[i];
                        statuses.push(dose.taken ? 'taken' : 'missed');
                    } else {
                        statuses.push('pending');
                    }
                }
            });
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

            statuses.forEach(status => {
                const box = document.createElement('div');
                box.className = `status-box ${status}`;
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
            name.textContent = med.name;
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
        
        const newMed = {
            id: Date.now().toString(),
            name: name,
            timesPerDay: timesPerDay,
            frequency: frequencyType,
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
        document.getElementById('weeklyDaysRow').style.display = 'none';
        document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);

        try {
            // Save medications for all users (they share the same medication list)
            await this.api.saveMedications(this.medications);
            // Also save for each user to ensure consistency
            for (const user of USERS) {
                const userId = getUserIdForUser(user);
                const apiClient = new APIClient(API_BASE_URL);
                apiClient.userId = userId;
                await apiClient.saveMedications(this.medications);
            }
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
            // Delete medication for all users
            for (const user of USERS) {
                const userId = getUserIdForUser(user);
                const apiClient = new APIClient(API_BASE_URL);
                apiClient.userId = userId;
                await apiClient.deleteMedication(medicationId);
            }
            this.renderMedicationList();
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to delete medication:', error);
            alert('Failed to delete medication. Please try again.');
        }
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
        
        // Add user selector in modal
        this.renderUserSelector();
        this.renderTrackingInterface(dateKey);
        document.getElementById('trackingModal').classList.add('active');
    }

    renderUserSelector() {
        // Check if user selector already exists
        let userSelector = document.getElementById('trackingUserSelector');
        if (!userSelector) {
            userSelector = document.createElement('div');
            userSelector.id = 'trackingUserSelector';
            userSelector.className = 'tracking-user-selector';
            const modalBody = document.querySelector('#trackingModal .modal-body');
            modalBody.insertBefore(userSelector, modalBody.firstChild);
        }
        
        userSelector.innerHTML = `
            <label>Tracking for: </label>
            <select id="currentUserSelect">
                ${USERS.map(user => 
                    `<option value="${user}" ${user === this.currentUser ? 'selected' : ''}>${user}</option>`
                ).join('')}
            </select>
        `;
        
        document.getElementById('currentUserSelect').addEventListener('change', (e) => {
            this.currentUser = e.target.value;
            const dateKey = this.formatDateKey(this.selectedDate);
            this.renderTrackingInterface(dateKey);
        });
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

        const userEntries = this.entries[this.currentUser] || {};
        const dayEntries = userEntries[dateKey] || {};
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
        const user = this.currentUser;
        const userId = getUserIdForUser(user);

        if (!this.entries[user]) {
            this.entries[user] = {};
        }

        if (!this.entries[user][dateKey]) {
            this.entries[user][dateKey] = {};
        }

        if (!this.entries[user][dateKey][medicationId]) {
            this.entries[user][dateKey][medicationId] = { doses: [] };
        }

        if (!this.entries[user][dateKey][medicationId].doses) {
            this.entries[user][dateKey][medicationId].doses = [];
        }

        // Ensure doses array is large enough
        while (this.entries[user][dateKey][medicationId].doses.length <= doseIndex) {
            this.entries[user][dateKey][medicationId].doses.push(null);
        }

        this.entries[user][dateKey][medicationId].doses[doseIndex] = {
            taken: taken,
            timestamp: timestamp,
        };

        try {
            // Use user-specific API client
            const apiClient = new APIClient(API_BASE_URL);
            apiClient.userId = userId;
            await apiClient.saveEntry(dateKey, medicationId, taken, timestamp, doseIndex);
            this.renderTrackingInterface(dateKey);
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to save entry:', error);
            // Revert on error
            this.entries[user][dateKey][medicationId].doses[doseIndex] = null;
            alert('Failed to save entry. Please try again.');
        }
    }

    async updateTimestamp(dateKey, medicationId, doseIndex, timestamp) {
        const user = this.currentUser;
        const userId = getUserIdForUser(user);

        if (!this.entries[user] || !this.entries[user][dateKey] || !this.entries[user][dateKey][medicationId] || 
            !this.entries[user][dateKey][medicationId].doses || 
            !this.entries[user][dateKey][medicationId].doses[doseIndex]) {
            alert('No entry found to update');
            return;
        }

        this.entries[user][dateKey][medicationId].doses[doseIndex].timestamp = timestamp;

        try {
            const apiClient = new APIClient(API_BASE_URL);
            apiClient.userId = userId;
            await apiClient.updateEntryTimestamp(dateKey, medicationId, timestamp, doseIndex);
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

        const user = this.currentUser;
        const userId = getUserIdForUser(user);

        if (!this.entries[user] || !this.entries[user][dateKey] || !this.entries[user][dateKey][medicationId] || 
            !this.entries[user][dateKey][medicationId].doses || 
            !this.entries[user][dateKey][medicationId].doses[doseIndex]) {
            return;
        }

        // Remove the dose entry
        this.entries[user][dateKey][medicationId].doses[doseIndex] = null;

        // Clean up empty doses array if all doses are null
        const hasAnyDoses = this.entries[user][dateKey][medicationId].doses.some(d => d !== null);
        if (!hasAnyDoses) {
            delete this.entries[user][dateKey][medicationId];
            // If no medications left for this day, remove the day entry
            if (Object.keys(this.entries[user][dateKey]).length === 0) {
                delete this.entries[user][dateKey];
            }
        }

        try {
            const apiClient = new APIClient(API_BASE_URL);
            apiClient.userId = userId;
            await apiClient.deleteEntry(dateKey, medicationId, doseIndex);
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
        title.textContent = this.selectedUsers.length > 1 ? 'Medication Analytics (Comparison)' : 'Medication Analytics';
        analyticsContainer.appendChild(title);

        this.medications.forEach(med => {
            // Calculate stats for each selected user
            const userStats = {};
            this.selectedUsers.forEach(user => {
                userStats[user] = { totalDoses: 0, takenDoses: 0, missedDoses: 0 };
                
                const userEntries = this.entries[user] || {};
                Object.keys(userEntries).forEach(dateKey => {
                    const dayEntries = userEntries[dateKey];
                    const medEntry = dayEntries[med.id];
                    if (medEntry && medEntry.doses) {
                        medEntry.doses.forEach((dose) => {
                            if (dose) {
                                userStats[user].totalDoses++;
                                if (dose.taken) {
                                    userStats[user].takenDoses++;
                                } else {
                                    userStats[user].missedDoses++;
                                }
                            }
                        });
                    }
                });
            });

            const chart = document.createElement('div');
            chart.className = 'medication-chart';

            if (this.selectedUsers.length > 1) {
                // Comparison view
                chart.innerHTML = `
                    <div class="medication-chart-header">
                        <h4>${med.name}</h4>
                    </div>
                    <div class="comparison-stats">
                        ${this.selectedUsers.map(user => {
                            const stats = userStats[user];
                            const adherenceRate = stats.totalDoses > 0 ? Math.round((stats.takenDoses / stats.totalDoses) * 100) : 0;
                            return `
                                <div class="user-comparison">
                                    <div class="user-name">${user}</div>
                                    <div class="adherence-rate">${adherenceRate}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${adherenceRate}%">${adherenceRate}%</div>
                                    </div>
                                    <div class="chart-details">
                                        <div class="chart-detail-item">
                                            <span class="chart-detail-label">Taken:</span>
                                            <span class="chart-detail-value" style="color: #28a745;">${stats.takenDoses}</span>
                                        </div>
                                        <div class="chart-detail-item">
                                            <span class="chart-detail-label">Missed:</span>
                                            <span class="chart-detail-value" style="color: #dc3545;">${stats.missedDoses}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                // Single user view
                const user = this.selectedUsers[0] || USERS[0];
                const stats = userStats[user] || { totalDoses: 0, takenDoses: 0, missedDoses: 0 };
                const adherenceRate = stats.totalDoses > 0 ? Math.round((stats.takenDoses / stats.totalDoses) * 100) : 0;

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
                            <span class="chart-detail-value">${stats.totalDoses}</span>
                        </div>
                        <div class="chart-detail-item">
                            <span class="chart-detail-label">Taken:</span>
                            <span class="chart-detail-value" style="color: #28a745;">${stats.takenDoses}</span>
                        </div>
                        <div class="chart-detail-item">
                            <span class="chart-detail-label">Missed:</span>
                            <span class="chart-detail-value" style="color: #dc3545;">${stats.missedDoses}</span>
                        </div>
                        <div class="chart-detail-item">
                            <span class="chart-detail-label">Frequency:</span>
                            <span class="chart-detail-value">${med.timesPerDay || 1}x per day</span>
                        </div>
                    </div>
                `;
            }

            analyticsContainer.appendChild(chart);
        });
    }

    renderRecentEntries() {
        const entriesContainer = document.getElementById('recentEntries');
        entriesContainer.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = 'Recent Entries';
        entriesContainer.appendChild(title);

        // Collect all entries with dates for selected users
        const allEntries = [];
        this.selectedUsers.forEach(user => {
            const userEntries = this.entries[user] || {};
            Object.keys(userEntries).forEach(dateKey => {
                const dayEntries = userEntries[dateKey];
                Object.keys(dayEntries).forEach(medId => {
                    const medEntry = dayEntries[medId];
                    const medication = this.medications.find(m => m.id === medId);
                    if (medication && medEntry.doses) {
                        medEntry.doses.forEach((dose, index) => {
                            if (dose) {
                                allEntries.push({
                                    user: user,
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
            const userText = this.selectedUsers.length > 1 ? ` [${entry.user}]` : '';
            name.textContent = entry.medication + doseText + userText;
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

