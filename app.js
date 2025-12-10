document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION & STATE ---
    const STORAGE_KEY = 'planmaster_local_data';
    
    let tasks = [];
    let currentDate = new Date();
    let currentDragTask = null;
    let timerInterval = null;
    let timeLeft = 25 * 60;
    let isTimerRunning = false;

    // --- 2. INITIALIZATION (NO AUTH) ---
    function initApp() {
        loadTasksFromStorage();
        const avatar = document.getElementById('user-avatar');
        if(avatar) avatar.title = "Local User";
        checkOnboarding();
        setupEventListeners();
        const syncStatus = document.getElementById('sync-status');
        if(syncStatus) {
            syncStatus.textContent = 'Penyimpanan Lokal';
            syncStatus.className = 'text-blue-500 font-bold';
        }
    }

    // --- 3. STORAGE OPERATIONS ---
    function loadTasksFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            tasks = data ? JSON.parse(data) : [];
            refreshUI();
        } catch (e) {
            console.error("Gagal memuat data lokal", e);
            tasks = [];
        }
    }

    function saveTasksToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            refreshUI();
        } catch (e) {
            console.error("Penyimpanan penuh atau error", e);
            showNotification("Gagal menyimpan (Penyimpanan Penuh? Hapus file besar)", true);
        }
    }

    function refreshUI() {
        renderCalendar();
        renderTaskList();
        updateStats();
    }

    // --- 4. TASK ACTIONS ---
    window.saveTask = function() {
        const titleInput = document.getElementById('task-title');
        const title = titleInput ? titleInput.value : '';
        if (!title) {
            showNotification("Judul tugas harus diisi!", true);
            return;
        }

        const idInput = document.getElementById('task-id');
        const id = idInput.value || Date.now().toString(); 
        
        const categoryEl = document.querySelector('input[name="category"]:checked');
        const category = categoryEl ? categoryEl.value : 'kerja';
        const priority = document.getElementById('task-priority').value;
        const date = document.getElementById('task-date').value;
        const time = document.getElementById('task-time').value;
        const desc = document.getElementById('task-desc').value;

        const checklistItems = [];
        document.querySelectorAll('.checklist-input').forEach(input => {
            if(input.value) checklistItems.push({ text: input.value, done: input.parentElement.querySelector('input[type="checkbox"]').checked });
        });

        const fileListContainer = document.getElementById('file-list');
        const files = Array.from(fileListContainer.children).map(div => {
            return {
                name: div.dataset.name,
                size: div.dataset.size,
                type: div.dataset.type,
                content: div._fileContent || div.dataset.content || null 
            };
        });

        const taskData = {
            id, 
            title, category, priority, date, time, desc, 
            checklist: checklistItems,
            files: files,
            completed: false, 
            createdAt: new Date().toISOString()
        };

        const existingIndex = tasks.findIndex(t => t.id === id);
        
        if (existingIndex >= 0) {
            taskData.completed = tasks[existingIndex].completed;
            taskData.createdAt = tasks[existingIndex].createdAt; 
            if (tasks[existingIndex].completedAt) {
                taskData.completedAt = tasks[existingIndex].completedAt;
            }
            tasks[existingIndex] = taskData;
        } else {
            tasks.push(taskData);
        }

        saveTasksToStorage();
        window.closeTaskModal();
        showNotification("Tugas berhasil disimpan!");
    };

    window.deleteTask = function(id) {
        if(window.confirm('Hapus tugas ini?')) {
            tasks = tasks.filter(t => t.id !== id);
            saveTasksToStorage();
            window.closeTaskModal(); // Tutup modal jika penghapusan dilakukan dari dalam modal
            showNotification("Tugas dihapus.");
        }
    };

    window.toggleTaskStatus = function(id, currentStatus) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            const newStatus = !currentStatus;
            task.completed = newStatus;
            if (newStatus) {
                task.completedAt = new Date().toISOString().split('T')[0];
            } else {
                delete task.completedAt;
            }
            saveTasksToStorage();
        }
    };

    async function updateTaskDate(id, newDate) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.date = newDate;
            saveTasksToStorage();
        }
    }

    // --- 5. CALENDAR LOGIC ---
    function renderCalendar() {
        const grid = document.getElementById('calendar-grid');
        if(!grid) return;
        grid.innerHTML = '';
        
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        document.getElementById('current-month-display').textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const startDayIndex = firstDay.getDay(); 
        for (let i = 0; i < startDayIndex; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell bg-gray-50 dark:bg-slate-900 opacity-50';
            grid.appendChild(cell);
        }

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell group';
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const todayStr = new Date().toISOString().split('T')[0];
            if (dateStr === todayStr) cell.classList.add('today');

            cell.innerHTML = `<div class="text-right text-sm text-gray-500 mb-1 font-medium ${dateStr === todayStr ? 'text-blue-600' : ''}">${d}</div>`;

            const dayTasks = tasks.filter(t => t.date === dateStr);
            const taskContainer = document.createElement('div');
            taskContainer.className = 'space-y-1 overflow-hidden max-h-[80px]';
            
            dayTasks.forEach(task => {
                const taskEl = document.createElement('div');
                const colorClass = task.category === 'kerja' ? 'bg-blue-100 text-blue-800 border-blue-300' : 
                                   task.category === 'pribadi' ? 'bg-green-100 text-green-800 border-green-300' : 
                                   'bg-purple-100 text-purple-800 border-purple-300';
                
                taskEl.className = `text-xs p-1 rounded border-l-2 truncate cursor-pointer hover:opacity-80 ${colorClass} ${task.completed ? 'line-through opacity-50' : ''}`;
                taskEl.textContent = `${task.time ? task.time + ' ' : ''}${task.title}`;
                taskEl.onclick = (e) => { e.stopPropagation(); window.openTaskModal(task); };
                taskEl.draggable = true;
                taskEl.ondragstart = (e) => handleDragStart(e, task);
                taskContainer.appendChild(taskEl);
            });

            cell.appendChild(taskContainer);
            cell.ondragover = (e) => { e.preventDefault(); cell.classList.add('drag-over'); };
            cell.ondragleave = (e) => { cell.classList.remove('drag-over'); };
            cell.ondrop = (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                handleDrop(dateStr);
            };
            cell.onclick = (e) => {
               if(e.target === cell || e.target.classList.contains('text-right')) {
                   window.openTaskModal(null, dateStr);
               }
            };
            grid.appendChild(cell);
        }
    }

    window.changeMonth = function(delta) {
        currentDate.setMonth(currentDate.getMonth() + delta);
        renderCalendar();
    };

    // --- 6. TASK LIST LOGIC ---
    function getActiveFilters() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return null;
        const checkboxes = Array.from(sidebar.querySelectorAll('input[type="checkbox"]'));
        const allCheckbox = checkboxes.find(cb => cb.getAttribute('onchange')?.includes("'all'"));
        if (allCheckbox && allCheckbox.checked) return null;
        const active = [];
        const cats = ['kerja', 'pribadi', 'kuliah'];
        cats.forEach(cat => {
            const cb = checkboxes.find(c => c.getAttribute('onchange')?.includes(`'${cat}'`));
            if (cb && cb.checked) active.push(cat);
        });
        return active.length > 0 ? active : null; 
    }

    function renderTaskList() {
        const container = document.getElementById('task-list-container');
        if(!container) return;
        const searchInput = document.getElementById('global-search');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        container.innerHTML = '';

        const activeCats = getActiveFilters();
        const filtered = tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(search);
            let matchesCategory = true;
            if (activeCats) {
                matchesCategory = activeCats.includes(t.category);
            }
            return matchesSearch && matchesCategory; 
        }).sort((a,b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);

        document.getElementById('task-count').textContent = filtered.length;

        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-400 text-sm mt-10">Tidak ada tugas yang cocok.</div>`;
            return;
        }

        filtered.forEach(task => {
            const div = document.createElement('div');
            div.className = `task-card p-3 rounded bg-white dark:bg-slate-700 shadow-sm border border-gray-100 dark:border-slate-600 ${task.priority === 'high' ? 'border-l-red-500' : task.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500'}`;
            
            // Tambahkan tombol hapus kecil di sebelah kanan list
            div.innerHTML = `
                <div class="flex items-start gap-2 group relative">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} class="mt-1 cursor-pointer" onclick="event.stopPropagation(); toggleTaskStatus('${task.id}', ${task.completed})">
                    <div class="flex-1 min-w-0 pr-6">
                        <h4 class="text-sm font-medium truncate dark:text-gray-200 ${task.completed ? 'line-through text-gray-400' : ''}">${task.title}</h4>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">${task.date || 'Tanpa tanggal'} ${task.files && task.files.length ? '<i class="fas fa-paperclip ml-1"></i>' : ''}</p>
                    </div>
                    <button onclick="event.stopPropagation(); deleteTask('${task.id}')" class="absolute top-0 right-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            `;
            
            div.draggable = true;
            div.ondragstart = (e) => handleDragStart(e, task);
            div.onclick = () => window.openTaskModal(task);
            
            container.appendChild(div);
        });
    }

    function handleDragStart(e, task) {
        currentDragTask = task;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(task));
    }

    function handleDrop(dateStr) {
        if (currentDragTask) {
            updateTaskDate(currentDragTask.id, dateStr);
            showNotification(`Jadwal dipindahkan ke ${dateStr}`);
            currentDragTask = null;
        }
    }

    // --- 7. MODAL & FORM UI ---
    window.openTaskModal = function(task = null, datePreselect = null) {
        const modal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');
        const deleteBtn = document.getElementById('btn-delete-task'); // Ambil tombol hapus

        if(form) form.reset();
        const checklistContainer = document.getElementById('checklist-container');
        if(checklistContainer) checklistContainer.innerHTML = '';
        const fileList = document.getElementById('file-list');
        if(fileList) fileList.innerHTML = '';

        if (task) {
            document.getElementById('modal-title').textContent = 'Edit Tugas';
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-date').value = task.date || '';
            document.getElementById('task-time').value = task.time || '';
            document.getElementById('task-desc').value = task.desc || '';
            document.getElementById('task-priority').value = task.priority || 'medium';
            if(task.category) {
                const catInput = document.querySelector(`input[name="category"][value="${task.category}"]`);
                if(catInput) catInput.checked = true;
            }
            if(task.checklist) {
                task.checklist.forEach(item => window.addChecklistItem(item.text, item.done));
            }
            if(task.files) {
                task.files.forEach(f => renderFileItem(f));
            }
            
            // Tampilkan tombol hapus dan set aksi
            if(deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = () => window.deleteTask(task.id);
            }

        } else {
            document.getElementById('modal-title').textContent = 'Tugas Baru';
            document.getElementById('task-id').value = '';
            if(datePreselect) document.getElementById('task-date').value = datePreselect;
            window.addChecklistItem(); 
            
            // Sembunyikan tombol hapus untuk tugas baru
            if(deleteBtn) deleteBtn.classList.add('hidden');
        }

        if(modal) modal.classList.add('active');
    };

    window.closeTaskModal = function() {
        const modal = document.getElementById('task-modal');
        if(modal) modal.classList.remove('active');
    };

    window.handleQuickAdd = function(e) {
        if (e.key === 'Enter') {
            const title = e.target.value;
            if(!title) return;
            const newTask = {
                id: Date.now().toString(),
                title: title,
                completed: false,
                category: 'pribadi', 
                priority: 'medium',
                date: '',
                createdAt: new Date().toISOString()
            };
            tasks.push(newTask);
            saveTasksToStorage();
            e.target.value = '';
            showNotification("Tugas cepat ditambahkan");
        }
    };

    // --- 8. CHECKLIST & FILE ---
    window.addChecklistItem = function(text = '', done = false) {
        const container = document.getElementById('checklist-container');
        if(!container) return;
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2';
        div.innerHTML = `
            <input type="checkbox" ${done ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded">
            <input type="text" value="${text}" class="checklist-input flex-1 bg-transparent border-b border-gray-200 dark:border-slate-600 focus:border-blue-500 text-sm py-1 outline-none dark:text-gray-300" placeholder="Langkah...">
            <button type="button" onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    };

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    if(dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); window.handleFileSelect(e.dataTransfer.files); });
        dropZone.addEventListener('click', () => { if(fileInput) fileInput.click(); });
    }

    window.handleFileSelect = function(files) {
        Array.from(files).forEach(file => {
            if(file.size > 500 * 1024) { 
                showNotification('File terlalu besar (>500KB)!', true);
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const fileData = { name: file.name, size: (file.size/1024).toFixed(1) + ' KB', type: file.type, content: e.target.result };
                const item = renderFileItem(fileData, true);
                setTimeout(() => {
                    const progress = item.querySelector('.progress-bar');
                    if(progress) progress.style.width = '100%';
                    setTimeout(() => {
                         item.querySelector('.loading-state').remove();
                         item.querySelector('.actions').classList.remove('hidden');
                    }, 500);
                }, 1000);
            };
            reader.readAsDataURL(file);
        });
    };

    function renderFileItem(file, isUploading = false) {
        const list = document.getElementById('file-list');
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-2 bg-gray-100 dark:bg-slate-700 rounded text-sm group';
        div.dataset.name = file.name;
        div.dataset.size = file.size;
        div.dataset.type = file.type;
        if(file.content) { div._fileContent = file.content; div.dataset.content = file.content; }

        const isImage = file.type.includes('image');
        const iconClass = isImage ? 'fa-image text-purple-500' : 'fa-file-pdf text-red-500';
        let iconHtml = `<i class="fas ${iconClass} text-lg"></i>`;
        if(isImage && file.content) iconHtml = `<img src="${file.content}" style="width: 32px; height: 32px; object-fit: cover;" class="rounded border border-gray-300">`;
        
        let viewBtn = '';
        if(file.content) viewBtn = `<a href="${file.content}" target="_blank" class="text-blue-500 hover:text-blue-700 mr-2" title="Lihat"><i class="fas fa-eye"></i></a>`;

        div.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                ${iconHtml}
                <div class="flex flex-col overflow-hidden"><span class="truncate font-medium dark:text-gray-200">${file.name}</span><span class="text-xs text-gray-500">${file.size}</span></div>
            </div>
            ${isUploading ? `<div class="loading-state w-24"><div class="h-1 w-full bg-gray-200 rounded overflow-hidden"><div class="progress-bar h-full bg-blue-500 w-0 transition-all duration-1000"></div></div></div>` : ''}
            <div class="actions ${isUploading ? 'hidden' : ''} flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                ${viewBtn}
                <button type="button" class="text-gray-400 hover:text-red-500" onclick="this.closest('div[data-name]').remove()"><i class="fas fa-trash"></i></button>
            </div>
        `;
        if(list) list.appendChild(div);
        return div;
    }

    // --- 10. POMODORO ---
    window.togglePomodoro = function() { document.getElementById('pomodoro-modal').classList.toggle('active'); };
    function updateTimerDisplay() {
        const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
        document.getElementById('timer-display').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const circle = document.querySelector('.timer-circle');
        if(isTimerRunning) circle.classList.add('timer-active'); else circle.classList.remove('timer-active');
    }
    window.startTimer = function() {
        if (isTimerRunning) return;
        isTimerRunning = true; updateTimerDisplay();
        if (Notification.permission !== "granted") Notification.requestPermission();
        timerInterval = setInterval(() => {
            if (timeLeft > 0) { timeLeft--; updateTimerDisplay(); } else { clearInterval(timerInterval); isTimerRunning = false; new Notification("Waktu Habis!"); showNotification("Waktu Habis!"); window.resetTimer(); }
        }, 1000);
    };
    window.pauseTimer = function() { clearInterval(timerInterval); isTimerRunning = false; updateTimerDisplay(); };
    window.resetTimer = function() { window.pauseTimer(); timeLeft = 25 * 60; updateTimerDisplay(); };

    // --- 11. STATS ---
    window.showStats = function() { document.getElementById('stats-modal').classList.add('active'); updateStats(); };
    let prodChart = null;
    function updateStats() {
        const completed = tasks.filter(t => t.completed).length, total = tasks.length;
        const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
        document.getElementById('stat-completed').textContent = completed;
        document.getElementById('stat-rate').textContent = rate + '%';
        const ctx = document.getElementById('productivityChart').getContext('2d');
        const labels = [], data = [];
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            labels.push(d.toLocaleDateString('id-ID', {weekday: 'short'}));
            const count = tasks.filter(t => { if (!t.completed) return false; if (t.completedAt) return t.completedAt === dateStr; return t.date === dateStr; }).length;
            data.push(count);
        }
        if(prodChart) prodChart.destroy();
        prodChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Tugas Selesai', data: data, backgroundColor: '#4285F4', borderRadius: 4 }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
    }

    // --- 12. UTILS ---
    function setupEventListeners() {
        const searchInput = document.getElementById('global-search');
        if(searchInput) searchInput.addEventListener('input', renderTaskList);
        const themeToggle = document.getElementById('theme-toggle');
        if(themeToggle) themeToggle.addEventListener('click', () => { document.body.classList.toggle('dark'); themeToggle.innerHTML = document.body.classList.contains('dark') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; });
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        if(menuToggle && sidebar) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.innerWidth >= 768) { sidebar.classList.toggle('collapsed'); } 
                else { sidebar.classList.toggle('-translate-x-full'); if (!sidebar.classList.contains('-translate-x-full')) sidebar.classList.add('z-50'); else setTimeout(() => sidebar.classList.remove('z-50'), 300); }
            });
            document.addEventListener('click', (e) => {
                if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) { sidebar.classList.add('-translate-x-full'); }
            });
        }
    }
    window.filterCategory = function() { renderTaskList(); };
    function showNotification(msg) {
        const div = document.createElement('div');
        div.className = `fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 text-sm animate-bounce`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
    function checkOnboarding() {
        if(!localStorage.getItem('onboardingShown')) { document.getElementById('onboarding-modal').classList.remove('hidden'); localStorage.setItem('onboardingShown', 'true'); }
    }
    initApp();
});