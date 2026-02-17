// API Base URL
const API_BASE_URL = window.API_BASE_URL || 'http://localhost/class-o-connect/api';
let currentUser = null;
let currentClassId = null;
let currentAssignmentFilter = 'all';
let assignmentFileData = null;
let noteFileData = null;
let quizTimerInterval = null;
let quizTimeRemaining = 0;
let currentQuizId = null;
let questionCounter = 1;

console.log('✅ Script.js loaded successfully');

// Add this utility function at the top of your script.js or before the notes functions

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - HTML-safe text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Alternative implementation (you only need ONE of these):
/*
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
*/

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function () {
  console.log('🚀 Dashboard initializing...');
  
  // Load theme first
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
  }
  
  // Restore sidebar state
  if (localStorage.getItem("sidebarCollapsed") === "true") {
    document.body.classList.add("sidebar-collapsed");
    const collapseBtn = document.getElementById("collapseBtn");
    if (collapseBtn) collapseBtn.textContent = "➡️";
  }
  
  // Setup sidebar collapse button
  setupSidebarCollapse();
  
  try {
    // Check authentication
    console.log('🔐 Checking authentication...');
    const response = await fetch(`${API_BASE_URL}/auth.php`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Auth data:', data);

    if (!data.success) {
      console.log('❌ Not authenticated, redirecting to login...');
      window.location.href = 'login.html';
      return;
    }

    currentUser = data.data;
    console.log('✅ Current user:', currentUser);

    // Set user info in UI
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const roleBadgeEl = document.getElementById('roleBadge');
    
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userAvatarEl) userAvatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
    
    // Set role badge and show appropriate buttons
    const createBtn = document.getElementById('createClassBtn');
    const joinBtn = document.getElementById('joinClassBtn');
    
    if (currentUser.role === 'teacher') {
      console.log('👨‍🏫 User is a teacher');
      if (roleBadgeEl) roleBadgeEl.textContent = 'Teacher';
      if (createBtn) createBtn.style.display = 'inline-block';
      if (joinBtn) joinBtn.style.display = 'none';
    } else {
      console.log('👨‍🎓 User is a student');
      if (roleBadgeEl) roleBadgeEl.textContent = 'Student';
      if (joinBtn) joinBtn.style.display = 'inline-block';
      if (createBtn) createBtn.style.display = 'none';
    }

    // Load classes
    console.log('📚 Loading classes...');
    await loadClasses();
    
    console.log('✅ Dashboard loaded successfully!');

  } catch (err) {
    console.error('❌ Dashboard initialization error:', err);
    alert('❌ Failed to load dashboard. Please try logging in again.');
    window.location.href = 'login.html';
  }
});

// Setup sidebar collapse functionality
function setupSidebarCollapse() {
  const collapseBtn = document.getElementById("collapseBtn");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-collapsed");
      collapseBtn.textContent = document.body.classList.contains("sidebar-collapsed") ? "➡️" : "📱";
      localStorage.setItem("sidebarCollapsed", document.body.classList.contains("sidebar-collapsed"));
    });
  }
}

// Logout function
async function logout() {
  if (!confirm("Are you sure you want to logout?")) return;

  try {
    console.log('🚪 Logging out...');
    await fetch(`${API_BASE_URL}/auth.php?action=logout`, {
      method: "POST",
      credentials: "include"
    });

    console.log('✅ Logged out successfully');
    window.location.replace("login.html");
  } catch (err) {
    console.error("❌ Logout failed", err);
    window.location.replace("login.html");
  }
}

// Toggle theme
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
  }
  console.log('🎨 Theme changed to:', newTheme);
}

// Modal functions
function openModal(modalId) {
  console.log('Opening modal:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  console.log('Closing modal:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
  
  // Clear quiz timer
  if (modalId === 'takeQuizModal' && quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
  
  // Clear file data
  if (modalId === 'submitAssignmentModal') {
    assignmentFileData = null;
    const fileInput = document.getElementById('assignmentFileInput');
    if (fileInput) fileInput.value = '';
    const fileInfo = document.getElementById('assignmentFileInfo');
    if (fileInfo) fileInfo.innerHTML = '';
    const uploadArea = document.getElementById('assignmentFileUploadArea');
    if (uploadArea) uploadArea.classList.remove('has-file');
  }
  
  if (modalId === 'uploadNoteModal') {
    noteFileData = null;
    const fileInput = document.getElementById('noteFileInput');
    if (fileInput) fileInput.value = '';
    const fileInfo = document.getElementById('noteFileInfo');
    if (fileInfo) fileInfo.innerHTML = '';
    const uploadArea = document.getElementById('noteFileUploadArea');
    if (uploadArea) uploadArea.classList.remove('has-file');
  }
}

// Close modals when clicking outside
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    const modalId = event.target.id;
    closeModal(modalId);
  }
}

// Show section function - UPDATED VERSION WITH CACHE BUSTING
function showSection(sectionName) {
  console.log('📍 Switching to section:', sectionName);
  
  // Update sidebar active state
  document.querySelectorAll('.menu button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const clickedButton = event?.target?.closest('button');
  if (clickedButton) {
    clickedButton.classList.add('active');
  }

  // Hide all sections
  const sections = [
    'homeSection', 
    'classesSection',
    'classDetailSection',
    'flashcardsSection', 
    'attendanceSection',
    'gameSection',
    'analyticsSection',
    'schedulerSection',
    'conferencingSection',
    'trendingSection',
    'chatbotSection'
  ];
  
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Show selected section
  const targetSection = document.getElementById(sectionName + 'Section');
  if (targetSection) {
    targetSection.style.display = 'block';
    console.log('✅ Section displayed:', sectionName);
  } else {
    console.error('❌ Section not found:', sectionName + 'Section');
  }
  
  // Load classes if classes section
  if (sectionName === 'classes') {
    loadClasses();
  }

  // Refresh game iframe
  if (sectionName === 'game') {
    const gameIframe = document.getElementById('gameFrame');
    if (gameIframe) {
      gameIframe.src = 'game.html?v=' + new Date().getTime();
    }
  }

  // ✅ FORCE RELOAD ATTENDANCE WITH CACHE BUSTING
  if (sectionName === 'attendance') {
    const attendanceIframe = document.getElementById('attendanceFrame');
    if (attendanceIframe) {
      // Use contentWindow.location.reload with force flag
      try {
        attendanceIframe.contentWindow.location.reload(true);
        console.log('🔄 Force reloading attendance iframe');
      } catch (e) {
        // Fallback if reload fails
        attendanceIframe.src = attendanceIframe.src.split('?')[0] + '?v=' + new Date().getTime();
        console.log('🔄 Reloading attendance via src change');
      }
    } else {
      console.error('❌ Attendance iframe not found!');
    }
  }
  
  // ✅ FORCE RELOAD SCHEDULER WITH CACHE BUSTING (with debugging)
if (sectionName === 'scheduler') {
  const schedulerIframe = document.querySelector('#schedulerSection iframe');
  console.log('🔍 Scheduler iframe found:', schedulerIframe);
  console.log('🔍 Current src:', schedulerIframe?.src);
  
  if (schedulerIframe) {
    const newSrc = 'scheduler.html?v=' + new Date().getTime();
    console.log('🔄 Setting src to:', newSrc);
    schedulerIframe.src = newSrc;
  } else {
    console.error('❌ Scheduler iframe not found!');
  }
}
}

function backToClasses() {
  showSection('classes');
}

// Load classes from backend
async function loadClasses() {
  try {
    console.log('📚 Fetching classes...');
    
    const response = await fetch(`${API_BASE_URL}/classes.php?action=list`, {
      method: 'GET',
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Classes data:', data);
    
    if (!data.success) {
      console.error('Failed to load classes');
      return;
    }
    
    const userClasses = data.data.classes || [];
    const container = document.getElementById('classList');
    
    if (userClasses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>📚 No Classes Yet</h3>
          <p>${currentUser.role === 'teacher' ? 'Create your first class!' : 'Join a class using a code!'}</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = userClasses.map(classItem => `
      <div class="class-card" onclick="openClass('${classItem.id}')">
        <h3>${classItem.name}</h3>
        <div class="class-code">${classItem.class_code}</div>
        <p>${classItem.subject}</p>
        <div class="class-meta">
          <div>👨‍🏫 ${classItem.teacher_name || currentUser.name}</div>
          <div>👥 ${classItem.member_count || 0} member(s)</div>
          <div>📅 ${new Date(classItem.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading classes:', error);
  }
}

// Create class
async function createClass(event) {
  event.preventDefault();
  
  const className = document.getElementById('className').value.trim();
  const subject = document.getElementById('classSubject').value.trim();
  const description = document.getElementById('classDescription').value.trim();
  
  try {
    const response = await fetch(`${API_BASE_URL}/classes.php?action=create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: className,
        subject: subject,
        description: description
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal('createClassModal');
      document.getElementById('className').value = '';
      document.getElementById('classSubject').value = '';
      document.getElementById('classDescription').value = '';
      
      await loadClasses();
      alert('✅ Class created! Code: ' + data.data.class_code);
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error creating class:', error);
    alert('❌ Failed to create class');
  }
}

// Join class
async function joinClass(event) {
  event.preventDefault();
  
  const code = document.getElementById('joinClassCode').value.trim().toUpperCase();
  
  try {
    const response = await fetch(`${API_BASE_URL}/classes.php?action=join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ code: code })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal('joinClassModal');
      document.getElementById('joinClassCode').value = '';
      await loadClasses();
      alert('✅ Successfully joined the class!');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error joining class:', error);
    alert('❌ Failed to join class');
  }
}

// Open class details
async function openClass(classId) {
  currentClassId = classId;
  
  try {
    const response = await fetch(`${API_BASE_URL}/classes.php?action=get&class_id=${classId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      alert('❌ ' + data.message);
      return;
    }
    
    const classData = data.data;
    window.currentClassData = classData;
    
    // Update header
    document.getElementById('classDetailTitle').textContent = classData.name;
    document.getElementById('classCodeDisplay').textContent = classData.class_code;
    document.getElementById('classDetailDescription').textContent = classData.description || classData.subject;
    
    // Show/hide role-based buttons
    const isTeacher = currentUser.role === 'teacher';
    document.getElementById('createAnnouncementBtn').style.display = isTeacher ? 'inline-block' : 'none';
    document.getElementById('createAssignmentBtn').style.display = isTeacher ? 'inline-block' : 'none';
    document.getElementById('createQuizBtn').style.display = isTeacher ? 'inline-block' : 'none';
    document.getElementById('uploadNoteBtn').style.display = isTeacher ? 'inline-block' : 'none';
    document.getElementById('leaveClassBtn').style.display = !isTeacher ? 'inline-block' : 'none';
    document.getElementById('deleteClassBtn').style.display = isTeacher ? 'inline-block' : 'none';
    
    // Load content
    await loadAnnouncements();
    showSection('classDetail');
    
  } catch (error) {
    console.error('Error loading class:', error);
    alert('❌ Failed to load class');
  }
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  // Show selected tab
  const selectedTab = document.getElementById(tabName + '-tab');
  if (selectedTab) {
    selectedTab.classList.add('active');
    selectedTab.style.display = 'block';
  }
  
  // Load content based on tab
  if (tabName === 'announcements') loadAnnouncements();
  else if (tabName === 'assignments') loadAssignments();
  else if (tabName === 'quizzes') loadQuizzes();
  else if (tabName === 'notes') loadNotes();
  else if (tabName === 'members') loadMembers();
}

// ==================== ANNOUNCEMENTS ====================

async function loadAnnouncements() {
  try {
    const response = await fetch(`${API_BASE_URL}/announcements.php?action=list&class_id=${currentClassId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    const announcements = data.data.announcements || [];
    const container = document.getElementById('announcementsList');
    
    if (announcements.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>📢 No Announcements</h3><p>No announcements yet.</p></div>';
      return;
    }
    
    container.innerHTML = announcements.map(a => `
      <div class="content-item">
        <div class="content-header">
          <div>
            <div class="content-title">${a.title}</div>
            <div class="content-meta">${a.author_name} • ${new Date(a.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div class="content-description">${a.content}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading announcements:', error);
  }
}

async function createAnnouncement(event) {
  event.preventDefault();
  
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  
  try {
    const response = await fetch(`${API_BASE_URL}/announcements.php?action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        class_id: currentClassId,
        title: title,
        content: content
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal('createAnnouncementModal');
      document.getElementById('announcementTitle').value = '';
      document.getElementById('announcementContent').value = '';
      await loadAnnouncements();
      alert('✅ Announcement posted!');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error creating announcement:', error);
    alert('❌ Failed to create announcement');
  }
}
// ==================== NOTES UPLOAD - FIXED ====================
function handleNoteFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  console.log('📁 File selected:', file.name, 'Size:', file.size, 'bytes');
  
  if (file.size > 10 * 1024 * 1024) {
    alert('❌ File must be less than 10MB');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    noteFileData = {
      name: file.name,
      type: file.type,
      size: file.size,
      data: e.target.result
    };
    
    console.log('✅ File read successfully. Base64 length:', noteFileData.data.length);
    
    document.getElementById('noteFileUploadArea').classList.add('has-file');
    document.getElementById('noteFileInfo').innerHTML = `
      <div class="file-info">
        <span>📄</span>
        <div style="flex: 1;">
          <div style="font-weight: 600;">${file.name}</div>
          <div style="font-size: 0.85rem; color: var(--muted);">${(file.size / 1024).toFixed(2)} KB</div>
        </div>
        <button type="button" class="btn-danger btn-small" onclick="clearNoteFile()">✕</button>
      </div>
    `;
  };
  
  reader.onerror = function(error) {
    console.error('❌ File read error:', error);
    alert('❌ Failed to read file');
  };
  
  reader.readAsDataURL(file);
}
function clearNoteFile() {
  console.log('🗑️ Clearing note file');
  noteFileData = null;
  document.getElementById('noteFileInput').value = '';
  document.getElementById('noteFileInfo').innerHTML = '';
  document.getElementById('noteFileUploadArea').classList.remove('has-file');
}

async function uploadNote(event) {
  event.preventDefault();
  
  const title = document.getElementById('noteTitle').value.trim();
  const description = document.getElementById('noteDescription').value.trim();
  
  console.log('📤 Upload note initiated');
  console.log('Title:', title);
  console.log('Description:', description);
  console.log('Current Class ID:', currentClassId);
  console.log('Note File Data:', noteFileData);
  
  if (!title) {
    alert('❌ Please enter a title');
    return;
  }
  
  if (!noteFileData) {
    alert('❌ Please select a file to upload');
    return;
  }
  
  if (!currentClassId) {
    alert('❌ No class selected');
    console.error('currentClassId is not set!');
    return;
  }
  
  const payload = {
    class_id: currentClassId,
    title: title,
    description: description,
    file_name: noteFileData.name,
    file_data: noteFileData.data
  };
  
  console.log('📤 Uploading note with payload:', {
    class_id: payload.class_id,
    title: payload.title,
    fileName: payload.file_name,
    fileSize: noteFileData.size,
    dataLength: payload.file_data.length,
    descriptionLength: description.length
  });
  
  try {
    const url = `${API_BASE_URL}/notes.php?action=upload`;
    console.log('🌐 Making request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    
    console.log('📥 Response received');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('OK:', response.ok);
    
    // Try to get response text first
    const responseText = await response.text();
    console.log('📥 Raw response:', responseText);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
    }
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Response was:', responseText);
      throw new Error('Invalid JSON response from server: ' + responseText.substring(0, 100));
    }
    
    console.log('📥 Parsed response data:', data);
    
    if (data.success) {
      console.log('✅ Upload successful!');
      closeModal('uploadNoteModal');
      document.getElementById('noteTitle').value = '';
      document.getElementById('noteDescription').value = '';
      clearNoteFile();
      await loadNotes();
      alert('✅ Note uploaded successfully!');
    } else {
      console.error('❌ Upload failed:', data.message);
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
    console.error('Error stack:', error.stack);
    alert('❌ Failed to upload note: ' + error.message);
  }
}
async function loadNotes() {
  try {
    console.log('📚 Loading notes for class:', currentClassId);
    
    if (!currentClassId) {
      console.error('❌ currentClassId is not set');
      const container = document.getElementById('notesList');
      if (container) {
        container.innerHTML = '<div class="empty-state"><h3>⚠️ Error</h3><p>No class selected</p></div>';
      }
      return;
    }
    
    const url = `${API_BASE_URL}/notes.php?action=list&class_id=${currentClassId}`;
    console.log('🌐 Fetching from:', url);
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('📥 Response status:', response.status, response.statusText);
    
    // Get response text first for debugging
    const responseText = await response.text();
    console.log('📥 Raw response (first 500 chars):', responseText.substring(0, 500));
    
    if (!response.ok) {
      console.error('❌ HTTP error:', response.status);
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Response was:', responseText);
      throw new Error('Server returned invalid JSON');
    }
    
    console.log('📥 Parsed data:', data);
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load notes');
    }
    
    const notes = data.data?.notes || [];
    console.log('📚 Found', notes.length, 'notes');
    
    const container = document.getElementById('notesList');
    
    if (!container) {
      console.error('❌ notesList container not found in DOM');
      return;
    }
    
    if (notes.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>📚 No Study Materials</h3><p>No study materials uploaded yet.</p></div>';
      return;
    }
    
    // Store notes in window for download function
    window.notesData = notes;
    
    // Build HTML - fix the quote escaping issue
    container.innerHTML = notes.map((n, index) => {
      // Escape HTML to prevent XSS
      const title = escapeHtml(n.title);
      const teacherName = escapeHtml(n.teacher_name);
      const description = n.description ? escapeHtml(n.description) : '';
      const uploadedAt = new Date(n.uploaded_at).toLocaleString();
      const isTeacher = currentUser && currentUser.role === 'teacher';
      
      return `
        <div class="content-item">
          <div class="content-header">
            <div>
              <div class="content-title">📄 ${title}</div>
              <div class="content-meta">By ${teacherName} • ${uploadedAt}</div>
            </div>
          </div>
          ${description ? `<div class="content-description">${description}</div>` : ''}
          <div class="content-actions">
            <button class="btn btn-small" onclick="downloadNoteById(${index})">⬇️ Download</button>
            ${isTeacher ? `<button class="btn-danger btn btn-small" onclick="deleteNote(${n.id})">🗑️ Delete</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    console.log('✅ Notes rendered successfully');
    
  } catch (error) {
    console.error('❌ Error loading notes:', error);
    console.error('Error stack:', error.stack);
    
    const container = document.getElementById('notesList');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>❌ Failed to Load Notes</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn" onclick="loadNotes()">🔄 Retry</button>
        </div>
      `;
    }
  }
}

// Helper function to download note by index
function downloadNoteById(index) {
  try {
    if (!window.notesData || !window.notesData[index]) {
      alert('❌ Note data not found');
      return;
    }
    
    const note = window.notesData[index];
    console.log('⬇️ Downloading:', note.file_name);
    
    const link = document.createElement('a');
    link.href = note.file_data;
    link.download = note.file_name;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    
    console.log('✅ Download initiated');
  } catch (error) {
    console.error('❌ Download error:', error);
    alert('❌ Failed to download file');
  }
}



async function deleteNote(noteId) {
  if (!confirm('Are you sure you want to delete this study material?')) return;
  
  try {
    console.log('🗑️ Deleting note:', noteId);
    
    const response = await fetch(`${API_BASE_URL}/notes.php?action=delete&note_id=${noteId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Delete response:', data);
    
    if (data.success) {
      await loadNotes();
      alert('✅ Study material deleted successfully');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('❌ Error deleting note:', error);
    alert('❌ Failed to delete note');
  }
}

function downloadFile(fileName, fileData) {
  try {
    console.log('⬇️ Downloading file:', fileName);
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('✅ Download initiated');
  } catch (error) {
    console.error('❌ Download error:', error);
    alert('❌ Failed to download file');
  }
}
// ==================== MEMBERS ====================

async function loadMembers() {
  try {
    const response = await fetch(`${API_BASE_URL}/classes.php?action=members&class_id=${currentClassId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    const members = data.data.members || [];
    const container = document.getElementById('membersList');
    
    if (members.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No Members</h3></div>';
      return;
    }
    
    container.innerHTML = members.map(m => `
      <div class="content-item">
        <div class="content-header">
          <div>
            <div class="content-title">${m.name}</div>
            <div class="content-meta">${m.email}</div>
          </div>
          <span class="status-badge ${m.role === 'teacher' ? 'status-graded' : 'status-submitted'}">
            ${m.role === 'teacher' ? '👨‍🏫 Teacher' : '👨‍🎓 Student'}
          </span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading members:', error);
  }
}

// ==================== CLASS MANAGEMENT ====================

async function leaveClass() {
  if (!confirm('Are you sure you want to leave this class?')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/classes.php?action=leave&class_id=${currentClassId}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('✅ Left the class');
      showSection('classes');
      await loadClasses();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function deleteClass() {
  if (!confirm('⚠️ Delete this class? This will remove all content and cannot be undone!')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/classes.php?action=delete&class_id=${currentClassId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('✅ Class deleted');
      showSection('classes');
      await loadClasses();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function copyClassCode() {
  const code = document.getElementById('classCodeDisplay').textContent;
  navigator.clipboard.writeText(code).then(() => {
    alert('✅ Class code copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('❌ Failed to copy code');
  });
}

// Initialize modal event listeners
document.addEventListener('DOMContentLoaded', function() {
  // File upload drag and drop
  const assignmentUpload = document.getElementById('assignmentFileUploadArea');
  if (assignmentUpload) {
    assignmentUpload.addEventListener('dragover', (e) => {
      e.preventDefault();
      assignmentUpload.style.borderColor = 'var(--primary)';
    });
    
    assignmentUpload.addEventListener('dragleave', (e) => {
      e.preventDefault();
      assignmentUpload.style.borderColor = 'var(--border)';
    });
    
    assignmentUpload.addEventListener('drop', (e) => {
      e.preventDefault();
      assignmentUpload.style.borderColor = 'var(--border)';
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        document.getElementById('assignmentFileInput').files = files;
        handleAssignmentFileSelect({ target: { files: files } });
      }
    });
  }
  
  const noteUpload = document.getElementById('noteFileUploadArea');
  if (noteUpload) {
    noteUpload.addEventListener('dragover', (e) => {
      e.preventDefault();
      noteUpload.style.borderColor = 'var(--primary)';
    });
    
    noteUpload.addEventListener('dragleave', (e) => {
      e.preventDefault();
      noteUpload.style.borderColor = 'var(--border)';
    });
    
    noteUpload.addEventListener('drop', (e) => {
      e.preventDefault();
      noteUpload.style.borderColor = 'var(--border)';
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        document.getElementById('noteFileInput').files = files;
        handleNoteFileSelect({ target: { files: files } });
      }
    });
  }
});
// ==================== COMPLETE ASSIGNMENTS SECTION ====================

async function loadAssignments() {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments.php?action=list&class_id=${currentClassId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    const assignments = data.data.assignments || [];
    const container = document.getElementById('assignmentsList');
    const isTeacher = currentUser.role === 'teacher';
    
    // Show/hide filter buttons for students
    const filterContainer = document.getElementById('assignmentFilterContainer');
    if (filterContainer) {
      filterContainer.style.display = isTeacher ? 'none' : 'flex';
    }
    
    if (assignments.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>📝 No Assignments</h3><p>No assignments yet.</p></div>';
      return;
    }
    
    container.innerHTML = assignments.map(a => {
      const dueDate = new Date(a.due_date);
      const isOverdue = dueDate < new Date();
      const submission = a.user_submission;
      
      return `
        <div class="content-item" data-status="${submission ? (submission.grade !== null ? 'graded' : 'submitted') : (isOverdue ? 'overdue' : 'pending')}">
          <div class="content-header">
            <div>
              <div class="content-title">${a.title}</div>
              <div class="content-meta">
                Due: ${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                • ${a.points} points
              </div>
            </div>
            ${submission ? 
              (submission.grade !== null && submission.grade !== undefined ? 
                `<span class="status-badge status-graded">Graded: ${submission.grade}/${a.points}</span>` : 
                `<span class="status-badge status-submitted">Submitted</span>`
              ) : 
              (isOverdue ? 
                `<span class="status-badge status-overdue">Overdue</span>` : 
                `<span class="status-badge status-pending">Pending</span>`
              )
            }
          </div>
          <div class="content-description">${a.description}</div>
          ${submission && submission.feedback ? 
            `<div style="margin: 1rem 0; padding: 1rem; background: rgba(16, 185, 129, 0.05); border-radius: 8px;">
              <strong>✅ Teacher Feedback:</strong>
              <div style="margin-top: 0.5rem; white-space: pre-wrap;">${submission.feedback}</div>
            </div>` : 
            ''
          }
          <div class="content-actions">
            ${!isTeacher && !submission ? 
              `<button class="btn btn-small" onclick="openSubmitAssignment(${a.id}, '${a.title.replace(/'/g, "\\'")}')">📤 Submit</button>` : 
              ''
            }
            ${isTeacher ? 
              `<button class="btn btn-small" onclick="viewSubmissions(${a.id})">📋 View Submissions (${a.submission_count || 0})</button>
               <button class="btn-danger btn btn-small" onclick="deleteAssignment(${a.id})">🗑️ Delete</button>` : 
              ''
            }
          </div>
        </div>
      `;
    }).join('');
    
    // Apply current filter if student
    if (!isTeacher && currentAssignmentFilter !== 'all') {
      filterAssignments(currentAssignmentFilter);
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
    alert('❌ Failed to load assignments');
  }
}

function filterAssignments(status) {
  currentAssignmentFilter = status;
  
  // Update button states
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === status) {
      btn.classList.add('active');
    }
  });
  
  // Filter assignment items
  const items = document.querySelectorAll('#assignmentsList .content-item');
  items.forEach(item => {
    const itemStatus = item.dataset.status;
    
    if (status === 'all') {
      item.style.display = 'block';
    } else if (status === 'pending') {
      item.style.display = (itemStatus === 'pending' || itemStatus === 'overdue') ? 'block' : 'none';
    } else {
      item.style.display = itemStatus === status ? 'block' : 'none';
    }
  });
}

async function createAssignment(event) {
  event.preventDefault();
  
  const title = document.getElementById('assignmentTitle').value.trim();
  const description = document.getElementById('assignmentDescription').value.trim();
  const dueDate = document.getElementById('assignmentDueDate').value;
  const points = document.getElementById('assignmentPoints').value || 100;
  
  if (!title || !description || !dueDate) {
    alert('❌ Please fill all required fields');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/assignments.php?action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        class_id: currentClassId,
        title: title,
        description: description,
        due_date: dueDate,
        points: parseInt(points)
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal('createAssignmentModal');
      document.getElementById('assignmentTitle').value = '';
      document.getElementById('assignmentDescription').value = '';
      document.getElementById('assignmentDueDate').value = '';
      document.getElementById('assignmentPoints').value = '100';
      await loadAssignments();
      alert('✅ Assignment created successfully!');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error creating assignment:', error);
    alert('❌ Failed to create assignment');
  }
}

function openSubmitAssignment(assignmentId, assignmentTitle) {
  document.getElementById('submitAssignmentId').value = assignmentId;
  document.querySelector('#submitAssignmentModal .modal-header h3').textContent = `Submit: ${assignmentTitle}`;
  openModal('submitAssignmentModal');
}

function handleAssignmentFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 10 * 1024 * 1024) {
    alert('❌ File must be less than 10MB');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    assignmentFileData = {
      name: file.name,
      type: file.type,
      size: file.size,
      data: e.target.result
    };
    
    document.getElementById('assignmentFileUploadArea').classList.add('has-file');
    document.getElementById('assignmentFileInfo').innerHTML = `
      <div class="file-info">
        <span>📄</span>
        <div style="flex: 1;">
          <div style="font-weight: 600;">${file.name}</div>
          <div style="font-size: 0.85rem; color: var(--muted);">${(file.size / 1024).toFixed(2)} KB</div>
        </div>
        <button type="button" class="btn-danger btn-small" onclick="clearAssignmentFile()">✕</button>
      </div>
    `;
  };
  reader.readAsDataURL(file);
}

function clearAssignmentFile() {
  assignmentFileData = null;
  document.getElementById('assignmentFileInput').value = '';
  document.getElementById('assignmentFileInfo').innerHTML = '';
  document.getElementById('assignmentFileUploadArea').classList.remove('has-file');
}

async function submitAssignment(event) {
  event.preventDefault();
  
  const assignmentId = document.getElementById('submitAssignmentId').value;
  const submissionText = document.getElementById('submissionText').value.trim();
  
  if (!assignmentFileData && !submissionText) {
    alert('❌ Please upload a file or enter text');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/assignments.php?action=submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        assignment_id: parseInt(assignmentId),
        submission_text: submissionText,
        file_name: assignmentFileData?.name || null,
        file_data: assignmentFileData?.data || null
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal('submitAssignmentModal');
      document.getElementById('submissionText').value = '';
      clearAssignmentFile();
      await loadAssignments();
      alert('✅ Assignment submitted successfully!');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error submitting assignment:', error);
    alert('❌ Failed to submit assignment');
  }
}

async function deleteAssignment(assignmentId) {
  if (!confirm('⚠️ Are you sure you want to delete this assignment? This will also delete all student submissions.')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/assignments.php?action=delete&assignment_id=${assignmentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      await loadAssignments();
      alert('✅ Assignment deleted successfully');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Failed to delete assignment');
  }
}

async function viewSubmissions(assignmentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments.php?action=submissions&assignment_id=${assignmentId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      alert('❌ ' + data.message);
      return;
    }
    
    const submissions = data.data.submissions || [];
    const container = document.getElementById('submissionsList');
    
    // Get assignment details for max points
    const assignmentResponse = await fetch(`${API_BASE_URL}/assignments.php?action=list&class_id=${currentClassId}`, {
      credentials: 'include'
    });
    const assignmentData = await assignmentResponse.json();
    const assignment = assignmentData.data.assignments.find(a => a.id == assignmentId);
    const maxPoints = assignment?.points || 100;
    
    if (submissions.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No Submissions Yet</h3><p>No students have submitted this assignment.</p></div>';
    } else {
      container.innerHTML = submissions.map(s => `
        <div class="content-item">
          <div class="content-header">
            <div>
              <div class="content-title">${s.student_name}</div>
              <div class="content-meta">${s.student_email} • Submitted: ${new Date(s.submitted_at).toLocaleString()}</div>
            </div>
            ${s.grade !== null && s.grade !== undefined ? 
              `<span class="status-badge status-graded">Grade: ${s.grade}/${maxPoints}</span>` : 
              `<span class="status-badge status-pending">Not Graded</span>`
            }
          </div>
          
          ${s.submission_text ? 
            `<div style="margin: 1rem 0; padding: 1rem; background: rgba(102, 126, 234, 0.05); border-radius: 8px; border-left: 4px solid var(--primary);">
              <strong>📝 Student Notes:</strong>
              <div style="margin-top: 0.5rem; white-space: pre-wrap; line-height: 1.6;">${s.submission_text}</div>
            </div>` : 
            ''
          }
          
          ${s.file_name ? 
            `<div style="margin: 1rem 0; padding: 1rem; background: rgba(102, 126, 234, 0.05); border-radius: 8px; border-left: 4px solid var(--primary);">
              <strong>📎 Attached File:</strong>
              <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: 600;">📄 ${s.file_name}</span>
                <button class="btn-small btn" onclick='downloadFile("${s.file_name}", "${s.file_data}")'>⬇️ Download</button>
              </div>
            </div>` : 
            ''
          }
          
          ${s.feedback ? 
            `<div style="margin: 1rem 0; padding: 1rem; background: rgba(16, 185, 129, 0.05); border-radius: 8px; border-left: 4px solid var(--success);">
              <strong>✅ Teacher Feedback:</strong>
              <div style="margin-top: 0.5rem; white-space: pre-wrap; line-height: 1.6;">${s.feedback}</div>
              ${s.graded_at ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--muted);">Graded: ${new Date(s.graded_at).toLocaleString()}</div>` : ''}
            </div>` : 
            ''
          }
          
          <div class="content-actions">
            <button class="btn btn-small" onclick='openGradeSubmission(${s.id}, ${assignmentId}, ${maxPoints}, "${s.student_name.replace(/"/g, '&quot;')}", ${s.grade || 0}, ${JSON.stringify(s.feedback || "").replace(/'/g, "&#39;")})'>
              ${s.grade !== null && s.grade !== undefined ? '✏️ Edit Grade' : '📝 Grade Assignment'}
            </button>
          </div>
        </div>
      `).join('');
    }
    
    openModal('viewSubmissionsModal');
  } catch (error) {
    console.error('Error loading submissions:', error);
    alert('❌ Failed to load submissions');
  }
}

function openGradeSubmission(submissionId, assignmentId, maxPoints, studentName, currentGrade, currentFeedback) {
  console.log('Opening grade modal:', { submissionId, assignmentId, maxPoints, studentName, currentGrade });
  
  // Store the submission ID and assignment ID
  document.getElementById('gradeSubmissionId').value = submissionId;
  document.getElementById('gradeAssignmentId').value = assignmentId;
  
  // Set max points display
  document.getElementById('maxPoints').textContent = maxPoints;
  const maxPoints2 = document.getElementById('maxPoints2');
  if (maxPoints2) maxPoints2.textContent = maxPoints;
  
  // Set grade input constraints and value
  const gradeInput = document.getElementById('gradeValue');
  gradeInput.max = maxPoints;
  gradeInput.min = 0;
  gradeInput.value = (currentGrade && currentGrade > 0) ? currentGrade : '';
  
  // Set feedback
  const feedbackTextarea = document.getElementById('gradeFeedback');
  feedbackTextarea.value = currentFeedback || '';
  
  // Update modal title
  document.querySelector('#gradeAssignmentModal .modal-header h3').textContent = `Grade Submission - ${studentName}`;
  
  // Close the submissions modal and open grading modal
  closeModal('viewSubmissionsModal');
  openModal('gradeAssignmentModal');
}

async function gradeAssignment(event) {
  event.preventDefault();
  
  const submissionId = document.getElementById('gradeSubmissionId').value;
  const assignmentId = document.getElementById('gradeAssignmentId').value;
  const grade = document.getElementById('gradeValue').value;
  const feedback = document.getElementById('gradeFeedback').value.trim();
  
  console.log('Grading submission:', { submissionId, assignmentId, grade, feedback });
  
  if (!submissionId || grade === '') {
    alert('❌ Please enter a grade');
    return;
  }
  
  const numGrade = parseInt(grade);
  const maxPoints = parseInt(document.getElementById('maxPoints').textContent);
  
  if (isNaN(numGrade)) {
    alert('❌ Please enter a valid number for the grade');
    return;
  }
  
  if (numGrade < 0 || numGrade > maxPoints) {
    alert(`❌ Grade must be between 0 and ${maxPoints}`);
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/assignments.php?action=grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        submission_id: parseInt(submissionId),
        grade: numGrade,
        feedback: feedback
      })
    });
    
    const data = await response.json();
    console.log('Grade response:', data);
    
    if (data.success) {
      closeModal('gradeAssignmentModal');
      alert('✅ Grade submitted successfully!');
      // Reload assignments and reopen submissions modal
      await loadAssignments();
      await viewSubmissions(assignmentId);
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error grading assignment:', error);
    alert('❌ Failed to grade assignment. Please try again.');
  }
}

// Helper function for file downloads
function downloadFile(fileName, fileData) {
  try {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error:', error);
    alert('❌ Failed to download file');
  }
}
// ==================== COMPLETE QUIZZES SECTION ====================

async function loadQuizzes() {
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=list&class_id=${currentClassId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    const quizzes = data.data.quizzes || [];
    const container = document.getElementById('quizzesList');
    const isTeacher = currentUser.role === 'teacher';
    
    if (quizzes.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>📝 No Quizzes</h3><p>No quizzes created yet.</p></div>';
      return;
    }
    
    container.innerHTML = quizzes.map(q => {
      const attempt = q.user_attempt;
      
      return `
        <div class="content-item">
          <div class="content-header">
            <div>
              <div class="content-title">${q.title}</div>
              <div class="content-meta">
                ${q.questions_count} questions 
                ${q.time_limit ? `• ${q.time_limit} minutes` : '• No time limit'}
              </div>
            </div>
            ${attempt ? 
              `<span class="status-badge status-graded">Score: ${attempt.score}/${q.questions_count}</span>` : 
              ''
            }
          </div>
          ${q.description ? `<div class="content-description">${q.description}</div>` : ''}
          <div class="content-actions">
            ${!isTeacher && !attempt ?
              `<button class="btn btn-small" onclick="startQuiz(${q.id})">▶️ Take Quiz</button>` : 
              ''
            }
            ${isTeacher ? 
              `<button class="btn btn-small" onclick="viewQuizResults(${q.id})">📊 Results (${q.attempts_count || 0})</button>
               <button class="btn-danger btn btn-small" onclick="deleteQuiz(${q.id})">🗑️ Delete</button>` : 
              ''
            }
            ${attempt ? 
              `<button class="btn-secondary btn btn-small" onclick="viewQuizAnswers(${q.id})">👀 Review Answers</button>` : 
              ''
            }
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading quizzes:', error);
    alert('❌ Failed to load quizzes');
  }
}

async function createQuiz(event) {
  event.preventDefault();
  
  const title = document.getElementById('quizTitle').value.trim();
  const description = document.getElementById('quizDescription').value.trim();
  const timeLimit = document.getElementById('quizTimeLimit').value || null;
  
  const questions = [];
  
  document.querySelectorAll('.quiz-question-item').forEach(item => {
    const questionText = item.querySelector('.question-text').value.trim();
    const questionType = item.querySelector('.question-type').value;
    
    if (!questionText) return;
    
    const question = {
      question_text: questionText,
      question_type: questionType,
      options: [],
      correct_answer: ''
    };
    
    if (questionType === 'multiple_choice') {
      const options = [];
      item.querySelectorAll('.option-input').forEach((input) => {
        const val = input.value.trim();
        if (val) options.push(val);
      });
      
      if (options.length < 2) {
        alert(`❌ Question "${questionText}" needs at least 2 options`);
        return;
      }
      
      question.options = options;
      const correctIndex = parseInt(item.querySelector('.correct-answer-select').value);
      question.correct_answer = correctIndex.toString();
    } else {
      question.correct_answer = item.querySelector('.short-answer-input').value.trim();
      if (!question.correct_answer) {
        alert(`❌ Please provide correct answer for "${questionText}"`);
        return;
      }
    }
    
    questions.push(question);
  });
  
  if (questions.length === 0) {
    alert('❌ Please add at least one question');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        class_id: currentClassId,
        title,
        description,
        time_limit: timeLimit,
        questions
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal('createQuizModal');
      document.getElementById('quizTitle').value = '';
      document.getElementById('quizDescription').value = '';
      document.getElementById('quizTimeLimit').value = '';
      document.getElementById('quizQuestionsList').innerHTML = '';
      questionCounter = 1;
      await loadQuizzes();
      alert('✅ Quiz created successfully!');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error creating quiz:', error);
    alert('❌ Failed to create quiz');
  }
}

function addQuizQuestion() {
  const container = document.getElementById('quizQuestionsList');
  const questionNum = questionCounter++;
  
  const questionDiv = document.createElement('div');
  questionDiv.className = 'quiz-question-item';
  questionDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h4>Question ${questionNum}</h4>
      <button type="button" class="btn-danger btn-small" onclick="this.parentElement.parentElement.remove(); questionCounter--;">✕ Remove</button>
    </div>
    <div class="form-group">
      <label>Question Text</label>
      <input type="text" class="form-control question-text" placeholder="Enter your question" required>
    </div>
    <div class="form-group">
      <label>Question Type</label>
      <select class="form-control question-type" onchange="toggleQuestionType(this)">
        <option value="multiple_choice">Multiple Choice</option>
        <option value="short_answer">Short Answer</option>
      </select>
    </div>
    <div class="multiple-choice-options">
      <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Options</label>
      <div style="margin-bottom: 0.5rem;">
        <input type="text" class="form-control option-input" placeholder="Option 1">
      </div>
      <div style="margin-bottom: 0.5rem;">
        <input type="text" class="form-control option-input" placeholder="Option 2">
      </div>
      <div style="margin-bottom: 0.5rem;">
        <input type="text" class="form-control option-input" placeholder="Option 3">
      </div>
      <div style="margin-bottom: 0.5rem;">
        <input type="text" class="form-control option-input" placeholder="Option 4">
      </div>
      <div class="form-group" style="margin-top: 1rem;">
        <label>Correct Answer</label>
        <select class="form-control correct-answer-select">
          <option value="0">Option 1</option>
          <option value="1">Option 2</option>
          <option value="2">Option 3</option>
          <option value="3">Option 4</option>
        </select>
      </div>
    </div>
    <div class="short-answer-option" style="display: none;">
      <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Correct Answer</label>
      <input type="text" class="form-control short-answer-input" placeholder="Enter the correct answer">
    </div>
  `;
  
  container.appendChild(questionDiv);
}

function toggleQuestionType(select) {
  const questionItem = select.closest('.quiz-question-item');
  const mcOptions = questionItem.querySelector('.multiple-choice-options');
  const saOption = questionItem.querySelector('.short-answer-option');
  
  if (select.value === 'multiple_choice') {
    mcOptions.style.display = 'block';
    saOption.style.display = 'none';
  } else {
    mcOptions.style.display = 'none';
    saOption.style.display = 'block';
  }
}

async function startQuiz(quizId) {
  currentQuizId = quizId;
  
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=get&quiz_id=${quizId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      alert('❌ ' + data.message);
      return;
    }
    
    const quiz = data.data.quiz;
    
    document.getElementById('takeQuizTitle').textContent = quiz.title;
    
    const questionsHtml = quiz.questions.map((q, idx) => `
      <div class="quiz-question" data-question-id="${q.id}">
        <div class="question-text">Question ${idx + 1}: ${q.question_text}</div>
        ${q.question_type === 'multiple_choice' ? 
          `<div class="quiz-options">
            ${q.options.map((opt, optIdx) => `
              <label class="quiz-option">
                <input type="radio" name="question_${q.id}" value="${optIdx}">
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>` : 
          `<input type="text" class="form-control quiz-short-answer" data-question-id="${q.id}" placeholder="Your answer" style="margin-top: 1rem;">`
        }
      </div>
    `).join('');
    
    document.getElementById('quizQuestionsDisplay').innerHTML = questionsHtml;
    
    // Start timer if applicable
    if (quiz.time_limit) {
      quizTimeRemaining = quiz.time_limit * 60;
      document.getElementById('quizTimer').style.display = 'block';
      updateQuizTimer();
      
      if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
      }
      
      quizTimerInterval = setInterval(() => {
        quizTimeRemaining--;
        updateQuizTimer();
        
        if (quizTimeRemaining <= 0) {
          clearInterval(quizTimerInterval);
          alert('⏰ Time is up! Submitting quiz...');
          submitQuiz();
        }
      }, 1000);
    } else {
      document.getElementById('quizTimer').style.display = 'none';
    }
    
    openModal('takeQuizModal');
  } catch (error) {
    console.error('Error starting quiz:', error);
    alert('❌ Failed to load quiz');
  }
}

function updateQuizTimer() {
  const minutes = Math.floor(quizTimeRemaining / 60);
  const seconds = quizTimeRemaining % 60;
  const timerEl = document.getElementById('quizTimer');
  if (timerEl) {
    timerEl.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (quizTimeRemaining <= 60) {
      timerEl.style.color = 'var(--danger)';
      timerEl.style.fontWeight = '700';
    }
  }
}

async function submitQuiz() {
  const answers = [];
  
  document.querySelectorAll('.quiz-question').forEach(card => {
    const questionId = card.dataset.questionId;
    const radioInput = card.querySelector(`input[name="question_${questionId}"]:checked`);
    const textInput = card.querySelector('.quiz-short-answer');
    
    let answer = '';
    if (radioInput) {
      answer = radioInput.value;
    } else if (textInput) {
      answer = textInput.value.trim();
    }
    
    answers.push({
      question_id: parseInt(questionId),
      answer: answer
    });
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        quiz_id: currentQuizId,
        answers: answers
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
      }
      closeModal('takeQuizModal');
      await loadQuizzes();
      alert(`✅ Quiz submitted! Score: ${data.data.score}/${data.data.total}`);
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error submitting quiz:', error);
    alert('❌ Failed to submit quiz');
  }
}

async function viewQuizResults(quizId) {
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=results&quiz_id=${quizId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    const results = data.data.results || [];
    const container = document.getElementById('quizResultsList');
    
    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No Results Yet</h3><p>No students have attempted this quiz.</p></div>';
    } else {
      container.innerHTML = results.map(r => `
        <div class="content-item">
          <div class="content-header">
            <div>
              <div class="content-title">${r.student_name}</div>
              <div class="content-meta">${r.student_email} • ${new Date(r.submitted_at).toLocaleString()}</div>
            </div>
            <span class="status-badge status-graded">Score: ${r.score}/${r.total_questions}</span>
          </div>
        </div>
      `).join('');
    }
    
    openModal('viewQuizResultsModal');
  } catch (error) {
    console.error('Error loading quiz results:', error);
    alert('❌ Failed to load results');
  }
}

async function viewQuizAnswers(quizId) {
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=review&quiz_id=${quizId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      alert('❌ ' + data.message);
      return;
    }
    
    const review = data.data.review;
    const container = document.getElementById('quizReviewContainer');
    
    container.innerHTML = review.questions.map((q, idx) => {
      const userAnswer = review.answers.find(a => a.question_id === q.id);
      const isCorrect = userAnswer && userAnswer.is_correct;
      
      return `
        <div class="quiz-question-card" style="padding: 1.5rem; margin-bottom: 1rem; border-radius: 12px; border: 2px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}; background: ${isCorrect ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'};">
          <h4 style="margin-bottom: 1rem;">Question ${idx + 1} ${isCorrect ? '✅' : '❌'}</h4>
          <p style="margin: 1rem 0; font-weight: 600;">${q.question_text}</p>
          ${q.question_type === 'multiple_choice' ? 
            `<div class="quiz-options" style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${q.options.map((opt, optIdx) => {
                const isUserAnswer = userAnswer && userAnswer.user_answer == optIdx;
                const isCorrectAnswer = q.correct_answer == optIdx;
                let style = 'padding: 12px; border-radius: 8px; border: 1px solid var(--border);';
                
                if (isCorrectAnswer) {
                  style += 'background: rgba(16, 185, 129, 0.1); border-color: var(--success);';
                } else if (isUserAnswer && !isCorrect) {
                  style += 'background: rgba(239, 68, 68, 0.1); border-color: var(--danger);';
                } else {
                  style += 'background: var(--card);';
                }
                
                return `
                  <div style="${style}">
                    <span>${opt}</span>
                    ${isCorrectAnswer ? ' <strong style="color: var(--success);">✓ Correct</strong>' : ''}
                    ${isUserAnswer ? ' <strong style="color: var(--primary);">← Your answer</strong>' : ''}
                  </div>
                `;
              }).join('')}
            </div>` : 
            `<div style="margin-top: 1rem;">
              <div style="padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; margin-bottom: 0.5rem;">
                <strong>Your answer:</strong> ${userAnswer ? userAnswer.user_answer : 'No answer'}
              </div>
              <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
                <strong>Correct answer:</strong> ${q.correct_answer}
              </div>
            </div>`
          }
        </div>
      `;
    }).join('');
    
    openModal('reviewQuizModal');
  } catch (error) {
    console.error('Error loading quiz review:', error);
    alert('❌ Failed to load quiz review');
  }
}

async function deleteQuiz(quizId) {
  if (!confirm('⚠️ Are you sure you want to delete this quiz? This will also delete all student attempts.')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/quizzes.php?action=delete&quiz_id=${quizId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      await loadQuizzes();
      alert('✅ Quiz deleted successfully');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('Error deleting quiz:', error);
    alert('❌ Failed to delete quiz');
  }
}

function loadGame() {
  const iframe = document.getElementById("gameFrame");
  iframe.src = "game.html?v=" + new Date().getTime(); // adds cache-busting
}

function showClassPage() {
  const section = document.getElementById("classSection");
  const iframe = document.getElementById("classFrame");

  // Show section
  section.style.display = "block";

  // Use the correct path
  iframe.src = "classpage/classpage.html?v=" + new Date().getTime();
}




console.log('✅ All script.js functions loaded successfully');
// ==================== SUBSCRIPTION POPUP FUNCTIONS ====================

let countdownInterval;
let remainingTime = 120; // 2 minutes in seconds

// Show timer immediately on page load
window.addEventListener('DOMContentLoaded', () => {
  const hasSubscription = localStorage.getItem('hasProSubscription');
  
  if (hasSubscription === 'true') {
    // User has subscription, update UI
    updateUIForProUser();
  } else {
    // User doesn't have subscription, show timer
    startSubscriptionTimer();
  }
});

function startSubscriptionTimer() {
  const timerElement = document.getElementById('subscriptionTimer');
  const timerDisplay = document.getElementById('timerDisplay');
  
  // Show timer
  timerElement.style.display = 'block';
  
  // Update timer every second
  countdownInterval = setInterval(() => {
    remainingTime--;
    
    // Format time as MM:SS
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Change color when time is running out (last 30 seconds)
    if (remainingTime <= 30) {
      timerDisplay.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
      timerDisplay.style.webkitBackgroundClip = 'text';
      timerDisplay.style.webkitTextFillColor = 'transparent';
      timerDisplay.style.backgroundClip = 'text';
    }
    
    // When timer reaches 0, show subscription popup
    if (remainingTime <= 0) {
      clearInterval(countdownInterval);
      showSubscriptionPopup();
    }
  }, 1000);
}

function showSubscriptionPopup() {
  const popup = document.getElementById('subscriptionPopup');
  const timerElement = document.getElementById('subscriptionTimer');
  
  // Hide timer
  timerElement.style.display = 'none';
  
  // Show popup with flex display for centering
  popup.style.display = 'flex';
  
  // Disable background scrolling
  document.body.style.overflow = 'hidden';
}

function closeSubscriptionPopup() {
  // This function is no longer used, but kept for compatibility
  // Users must either subscribe or logout
}

function remindMeLater() {
  // This function is no longer used
  // Users must either subscribe or logout
}

function logoutUser() {
  // Clear any session data
  sessionStorage.clear();
  
  // Show logout message
  alert('👋 You have been logged out. Subscribe to Pro to continue using Class-o-Connect!');
  
  // Redirect to login page
  window.location.href = 'login.html';
}

function initiateProPayment() {
  const baseAmount = 500; // ₹5 in paise
  const gst = Math.round(baseAmount * 0.18);
  const totalAmount = baseAmount + gst;
  
  const options = {
    "key": "rzp_live_RxSnj7G6zpicqV",
    "amount": totalAmount,
    "currency": "INR",
    "name": "Class-o-Connect",
    "description": "Pro Plan - Monthly Subscription (₹5)",
    "image": "https://via.placeholder.com/150",
    
    "prefill": {
      "name": "",
      "email": "",
      "contact": ""
    },
    
    "method": {
      "upi": true,
      "card": true,
      "netbanking": true,
      "wallet": true,
      "qr": true
    },
    
    "theme": {
      "color": "#667eea"
    },
    
    "handler": function (response) {
      // Store subscription status
      localStorage.setItem('hasProSubscription', 'true');
      localStorage.setItem('subscriptionPaymentId', response.razorpay_payment_id);
      localStorage.setItem('subscriptionDate', new Date().toISOString());
      
      // Hide popup
      const popup = document.getElementById('subscriptionPopup');
      popup.style.display = 'none';
      
      // Re-enable scrolling
      document.body.style.overflow = 'auto';
      
      // Clear the countdown interval if it exists
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      
      // Update UI for pro user
      updateUIForProUser();
      
      alert('✅ Payment Successful!\n\n' +
            'Payment ID: ' + response.razorpay_payment_id + '\n\n' +
            '🎉 Welcome to Pro Plan!\n\n' +
            'You now have unlimited access to Class-o-Connect. Enjoy your learning journey!');
      
      console.log('Payment Response:', response);
    },
    
    "modal": {
      "ondismiss": function() {
        console.log('Payment cancelled by user');
        alert('⚠️ Payment cancelled. Please subscribe to continue using Class-o-Connect or logout.');
      }
    }
  };
  
  const rzp = new Razorpay(options);
  
  rzp.on('payment.failed', function (response) {
    alert('❌ Payment Failed!\n\n' +
          'Error: ' + response.error.description + '\n\n' +
          'Please try again or contact support.');
    console.log('Payment Error:', response.error);
  });
  
  rzp.open();
}

function updateUIForProUser() {
  // Hide timer if visible
  const timerElement = document.getElementById('subscriptionTimer');
  if (timerElement) {
    timerElement.style.display = 'none';
  }
  
  // Add a Pro badge to the user profile
  const userChip = document.querySelector('.user-chip');
  if (userChip && !document.getElementById('proBadge')) {
    const proBadge = document.createElement('span');
    proBadge.id = 'proBadge';
    proBadge.style.cssText = 'background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-left: 8px;';
    proBadge.textContent = 'PRO';
    userChip.appendChild(proBadge);
  }
  
  // You can add more UI updates here for pro features
  console.log('✅ UI updated for Pro user');
}

console.log('✅ Subscription popup functions loaded successfully');