// API Configuration
const API_BASE_URL = 'https://your-worker.your-subdomain.workers.dev'; // Update with your Worker URL
// For local development, use: 'http://localhost:8787'

// Generate or retrieve user ID
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
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

    async saveEntry(date, medicationId, taken, timestamp) {
        return this.request('/api/entry', {
            method: 'POST',
            body: JSON.stringify({ date, medicationId, taken, timestamp }),
        });
    }

    async updateEntryTimestamp(date, medicationId, timestamp) {
        return this.request('/api/entry', {
            method: 'PUT',
            body: JSON.stringify({ date, medicationId, timestamp }),
        });
    }

    async deleteMedication(medicationId) {
        return this.request(`/api/medication/${medicationId}`, {
            method: 'DELETE',
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
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderCalendar();
        this.attachEventListeners();
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

    getMedicationStatus(dateKey) {
        const dayEntries = this.entries[dateKey] || {};
        return this.medications.map(med => {
            const entry = dayEntries[med.id];
            if (!entry) return 'pending';
            return entry.taken ? 'taken' : 'missed';
        });
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

            const name = document.createElement('div');
            name.className = 'medication-item-name';
            name.textContent = med.name;
            item.appendChild(name);

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

        const newMed = {
            id: Date.now().toString(),
            name: name,
        };

        this.medications.push(newMed);
        input.value = '';

        try {
            await this.api.saveMedications(this.medications);
            this.renderMedicationList();
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to save medication:', error);
            this.medications.pop(); // Revert on error
            alert('Failed to save medication. Please try again.');
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

        this.medications.forEach(med => {
            const entry = dayEntries[med.id];
            const taken = entry ? entry.taken : null;
            const timestamp = entry ? entry.timestamp : null;

            const item = document.createElement('div');
            item.className = 'medication-tracking-item';

            const title = document.createElement('h3');
            title.textContent = med.name;
            item.appendChild(title);

            const buttons = document.createElement('div');
            buttons.className = 'tracking-buttons';

            const yesBtn = document.createElement('button');
            yesBtn.className = `track-btn yes ${taken === true ? 'active' : ''}`;
            yesBtn.textContent = '✓ Yes';
            yesBtn.addEventListener('click', () => {
                this.trackMedication(dateKey, med.id, true);
            });
            buttons.appendChild(yesBtn);

            const noBtn = document.createElement('button');
            noBtn.className = `track-btn no ${taken === false ? 'active' : ''}`;
            noBtn.textContent = '✗ No';
            noBtn.addEventListener('click', () => {
                this.trackMedication(dateKey, med.id, false);
            });
            buttons.appendChild(noBtn);

            item.appendChild(buttons);

            if (timestamp) {
                const timestampDisplay = document.createElement('div');
                timestampDisplay.className = 'timestamp-display';
                const date = new Date(timestamp);
                timestampDisplay.innerHTML = `<strong>Recorded:</strong> ${date.toLocaleString()}`;
                item.appendChild(timestampDisplay);
            }

            // Edit timestamp option
            const editTimestamp = document.createElement('div');
            editTimestamp.className = 'edit-timestamp';

            const timeInput = document.createElement('input');
            timeInput.type = 'datetime-local';
            if (timestamp) {
                const date = new Date(timestamp);
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
                this.updateTimestamp(dateKey, med.id, newTimestamp);
            });
            editTimestamp.appendChild(updateBtn);

            item.appendChild(editTimestamp);
            container.appendChild(item);
        });
    }

    async trackMedication(dateKey, medicationId, taken) {
        const timestamp = new Date().toISOString();

        if (!this.entries[dateKey]) {
            this.entries[dateKey] = {};
        }

        this.entries[dateKey][medicationId] = {
            taken: taken,
            timestamp: timestamp,
        };

        try {
            await this.api.saveEntry(dateKey, medicationId, taken, timestamp);
            this.renderTrackingInterface(dateKey);
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to save entry:', error);
            // Revert on error
            delete this.entries[dateKey][medicationId];
            alert('Failed to save entry. Please try again.');
        }
    }

    async updateTimestamp(dateKey, medicationId, timestamp) {
        if (!this.entries[dateKey] || !this.entries[dateKey][medicationId]) {
            alert('No entry found to update');
            return;
        }

        this.entries[dateKey][medicationId].timestamp = timestamp;

        try {
            await this.api.updateEntryTimestamp(dateKey, medicationId, timestamp);
            this.renderTrackingInterface(dateKey);
            this.renderCalendar();
        } catch (error) {
            console.error('Failed to update timestamp:', error);
            alert('Failed to update timestamp. Please try again.');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MedicationTracker();
});

