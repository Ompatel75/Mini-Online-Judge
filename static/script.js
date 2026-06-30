const API_URL = window.location.origin + "/api";
let currentToken = null;
let currentUser = null;
let authMode = 'login'; // login or register
let selectedProblemId = null;
let pollInterval = null;

// --- UI Navigation ---
function switchAuthTab(mode) {
    authMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('register-fields').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('auth-submit-btn').textContent = mode === 'register' ? 'Register' : 'Login';
    document.getElementById('auth-error').textContent = '';
}

function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('welcome-msg').textContent = `Welcome, ${currentUser.username}!`;
    
    const navLinks = document.getElementById('nav-links');
    navLinks.innerHTML = `<button class="text-btn" onclick="logout()">Logout</button>`;
    
    if (currentUser.is_admin) {
        document.getElementById('admin-badge').style.display = 'block';
        document.getElementById('admin-panel').style.display = 'block';
    } else {
        document.getElementById('admin-badge').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
    }
    
    loadProblems();
}

function logout() {
    currentToken = null;
    currentUser = null;
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('nav-links').innerHTML = '';
}

// --- API Calls ---

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = "";

    try {
        if (authMode === 'register') {
            const email = document.getElementById('auth-email').value;
            const res = await fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            if (!res.ok) throw new Error((await res.json()).detail || "Registration failed");
            // Auto login after register
            await loginRequest(username, password);
        } else {
            await loginRequest(username, password);
        }
    } catch (err) {
        errorEl.textContent = err.message;
    }
}

async function loginRequest(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!res.ok) throw new Error("Invalid credentials");
    
    const data = await res.json();
    currentToken = data.access_token;
    await fetchUserProfile();
}

async function fetchUserProfile() {
    const res = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
        currentUser = await res.json();
        showDashboard();
    }
}

async function handleAddProblem(e) {
    e.preventDefault();
    const msgEl = document.getElementById('admin-msg');
    
    const problemData = {
        title: document.getElementById('prob-title').value,
        description: document.getElementById('prob-desc').value,
        time_limit: parseFloat(document.getElementById('prob-time').value),
        memory_limit: parseInt(document.getElementById('prob-mem').value),
        tags: document.getElementById('prob-tags').value || ""
    };
    
    try {
        const probRes = await fetch(`${API_URL}/problems/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(problemData)
        });
        
        if (!probRes.ok) throw new Error("Failed to create problem");
        const prob = await probRes.json();
        
        const tcData = {
            input_data: document.getElementById('prob-input').value,
            expected_output: document.getElementById('prob-expected').value,
            is_hidden: false
        };
        
        await fetch(`${API_URL}/problems/${prob.id}/testcases`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(tcData)
        });
        
        msgEl.textContent = "Problem created successfully!";
        msgEl.style.color = "var(--success)";
        e.target.reset();
        loadProblems();
        
        setTimeout(() => msgEl.textContent = "", 3000);
        
    } catch (err) {
        msgEl.textContent = err.message;
        msgEl.style.color = "var(--error)";
    }
}

async function loadProblems() {
    const res = await fetch(`${API_URL}/problems/`);
    const problems = await res.json();
    
    let statuses = {};
    if (currentToken) {
        try {
            const statRes = await fetch(`${API_URL}/submissions/me/status`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (statRes.ok) {
                statuses = await statRes.json();
            }
        } catch (e) {}
    }
    
    const container = document.getElementById('problems-container');
    container.innerHTML = '';
    
    if (problems.length === 0) {
        container.innerHTML = '<p>No problems available yet.</p>';
        return;
    }
    
    problems.forEach(p => {
        const card = document.createElement('div');
        card.className = 'problem-card';
        
        let statusBadge = '';
        const v = statuses[p.id];
        if (v === 'AC') {
            statusBadge = '<span class="status-badge ac-badge">✓ Solved</span>';
        } else if (v && v !== 'PENDING' && v !== 'RUNNING') {
            statusBadge = '<span class="status-badge wa-badge">✗ Attempted</span>';
        }

        card.innerHTML = `
            <div>
                <h4 style="display:flex; align-items:center; gap:0.5rem;">
                    ${p.title}
                    ${statusBadge}
                </h4>
                <div class="tags-container">
                    ${p.tags ? p.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('') : ''}
                </div>
                <div class="meta" style="margin-top: 0.5rem;">
                    <span>⏳ ${p.time_limit}s</span>
                    <span>💾 ${p.memory_limit}MB</span>
                </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                ${currentUser && currentUser.is_admin ? `<button class="solve-btn" style="color:var(--error); border-color:var(--error);" onclick="deleteProblem(${p.id})">Delete</button>` : ''}
                <button class="solve-btn" onclick='openSubmitPanel(${p.id}, ${JSON.stringify(p.title)}, ${JSON.stringify(p.description).replace(/'/g, "&#39;")})'>Solve</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function deleteProblem(id) {
    if(!confirm("Are you sure you want to delete this problem?")) return;
    try {
        const res = await fetch(`${API_URL}/problems/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!res.ok) throw new Error("Failed to delete problem");
        loadProblems();
    } catch (err) {
        alert(err.message);
    }
}

// Add tab support to editor
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('code-editor');
    if (editor) {
        editor.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
            }
        });
    }
});

function openSubmitPanel(id, title, desc) {
    selectedProblemId = id;
    document.querySelector('.problems-list').classList.add('hidden');
    if(document.getElementById('admin-panel')) document.getElementById('admin-panel').classList.add('hidden');
    
    const panel = document.getElementById('submit-panel');
    panel.classList.remove('hidden');
    document.getElementById('submit-prob-title').textContent = title;
    document.getElementById('submit-prob-desc').textContent = desc;
    
    // Reset verdict
    document.getElementById('verdict-display').classList.add('hidden');
    document.getElementById('submit-code-form').reset();
    document.getElementById('submit-btn').disabled = false;
    if(pollInterval) clearInterval(pollInterval);
}

function hideSubmitPanel() {
    selectedProblemId = null;
    document.getElementById('submit-panel').classList.add('hidden');
    document.querySelector('.problems-list').classList.remove('hidden');
    if(currentUser.is_admin) document.getElementById('admin-panel').classList.remove('hidden');
    if(pollInterval) clearInterval(pollInterval);
}

async function handleSubmitCode(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const code = document.getElementById('code-editor').value;
    const vDisplay = document.getElementById('verdict-display');
    const vStatus = document.getElementById('verdict-status');
    const vTime = document.getElementById('verdict-time');
    
    btn.disabled = true;
    vDisplay.classList.remove('hidden');
    vStatus.textContent = "SUBMITTED...";
    vStatus.className = 'verdict-running';
    vTime.textContent = "";

    try {
        const res = await fetch(`${API_URL}/submissions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                problem_id: selectedProblemId,
                code: code,
                language: "cpp"
            })
        });
        
        if (!res.ok) throw new Error("Submission failed");
        const sub = await res.json();
        
        pollVerdict(sub.id);
        
    } catch (err) {
        vStatus.textContent = "ERROR: " + err.message;
        vStatus.className = 'verdict-re';
        btn.disabled = false;
    }
}

function pollVerdict(subId) {
    const vStatus = document.getElementById('verdict-status');
    const vTime = document.getElementById('verdict-time');
    const btn = document.getElementById('submit-btn');
    
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/submissions/${subId}`);
            const data = await res.json();
            
            vStatus.textContent = data.verdict;
            
            if (data.verdict !== "PENDING" && data.verdict !== "RUNNING") {
                clearInterval(pollInterval);
                btn.disabled = false;
                
                // Color coding
                if (data.verdict === "AC") vStatus.className = 'verdict-ac';
                else if (data.verdict === "WA") vStatus.className = 'verdict-wa';
                else if (data.verdict === "TLE") vStatus.className = 'verdict-tle';
                else vStatus.className = 'verdict-re';
                
                if (data.execution_time) {
                    vTime.textContent = `Time: ${data.execution_time.toFixed(3)}s`;
                }
            } else {
                vStatus.className = 'verdict-running';
            }
            
        } catch (err) {
            console.error("Polling error", err);
        }
    }, 1000); // poll every 1 second
}
