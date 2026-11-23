(() => {
  "use strict";

  const STORAGE_KEY = "gatherwell-event-manager-v1";
  const THEME_KEY = "gatherwell-theme";
  const submissionStatuses = ["Received", "Under Review", "Shortlisted", "Selected", "Rejected"];
  const volunteerStatuses = ["Active", "On Leave", "Inactive"];
  const taskStatuses = ["To Do", "In Progress", "Done"];
  const priorities = ["Low", "Medium", "High"];
  const defaultData = { submissions: [], volunteers: [], tasks: [] };
  let data;
  let activeTab = "dashboard";
  let submissionsView = "table";
  let toastTimer;

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const localDateTime = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  const formatDate = (value, includeTime = false) => {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return new Intl.DateTimeFormat(undefined, includeTime
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", year: "numeric" }).format(date);
  };
  const initials = (value) => String(value || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("");
  const statusClass = (value) => `status-${String(value).toLowerCase().replace(/\s+/g, "-")}`;
  const normalized = (value) => String(value || "").trim().toLowerCase();
  const findVolunteer = (volunteerId) => data.volunteers.find((person) => person.id === volunteerId);
  const taskCount = (volunteerId) => data.tasks.filter((task) => task.assigneeId === volunteerId && task.status !== "Done").length;

  function makeSamples() {
    const day = (delta) => {
      const date = new Date();
      date.setDate(date.getDate() + delta);
      return localDateTime(date);
    };
    const people = [
      { id: id(), name: "Maya Chen", phone: "+1 415 555 0134", role: "Registration", team: "Front of House", availability: "Full day", status: "Active", attendance: null, isSample: true },
      { id: id(), name: "Jordan Lee", phone: "+1 415 555 0186", role: "Logistics", team: "Operations", availability: "Morning", status: "Active", attendance: null, isSample: true },
      { id: id(), name: "Aarav Patel", phone: "+1 415 555 0119", role: "Judging Support", team: "Program", availability: "Full day", status: "Active", attendance: null, isSample: true },
      { id: id(), name: "Sofia Garcia", phone: "+1 415 555 0162", role: "Media", team: "Communications", availability: "Afternoon", status: "On Leave", attendance: null, isSample: true },
      { id: id(), name: "Noah Wilson", phone: "+1 415 555 0191", role: "Logistics", team: "Operations", availability: "Full day", status: "Active", attendance: null, isSample: true }
    ];
    const submissions = [
      { id: id(), participant: "Northstar Labs", contact: "northstar@example.com", college: "Westlake University", event: "Innovation Challenge", link: "https://github.com/", submittedAt: day(-1), status: "Selected", score: 94, notes: "Clear problem statement and a polished demo.", isSample: true },
      { id: id(), participant: "Maya Chen", contact: "maya@example.com", college: "Pacific College", event: "Design Sprint", link: "https://www.figma.com/", submittedAt: day(-2), status: "Shortlisted", score: 87, notes: "Strong research; review the final prototype.", isSample: true },
      { id: id(), participant: "GreenLoop", contact: "+1 415 555 0122", college: "Westlake University", event: "Innovation Challenge", link: "https://drive.google.com/", submittedAt: day(-3), status: "Under Review", score: 79, notes: "Interesting sustainability angle.", isSample: true },
      { id: id(), participant: "Pixel Pioneers", contact: "team@example.com", college: "City Tech", event: "Design Sprint", link: "https://www.figma.com/", submittedAt: day(-4), status: "Received", score: 0, notes: "", isSample: true },
      { id: id(), participant: "Code for Care", contact: "+1 415 555 0107", college: "North Valley College", event: "Community Track", link: "https://github.com/", submittedAt: day(-5), status: "Rejected", score: 54, notes: "Needs a clearer delivery plan.", isSample: true }
    ];
    const tasks = [
      { id: id(), title: "Confirm registration desk setup", description: "Check signage, badges, and the check-in devices.", assigneeId: people[0].id, dueAt: day(1), priority: "High", status: "To Do", isSample: true },
      { id: id(), title: "Brief judging panel", description: "Share the rubric and room assignments with judges.", assigneeId: people[2].id, dueAt: day(2), priority: "High", status: "In Progress", isSample: true },
      { id: id(), title: "Test room microphones", description: "Run an audio check in the main hall.", assigneeId: people[1].id, dueAt: day(-1), priority: "Medium", status: "To Do", isSample: true },
      { id: id(), title: "Prepare social media schedule", description: "Collect speaker quotes and event-day photos.", assigneeId: people[3].id, dueAt: day(3), priority: "Low", status: "Done", isSample: true },
      { id: id(), title: "Collect sponsor welcome kits", description: "Pick up the boxes from the loading area.", assigneeId: "", dueAt: day(0), priority: "Medium", status: "To Do", isSample: true }
    ];
    return { submissions, volunteers: people, tasks };
  }

  function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const samples = makeSamples();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
      return samples;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.submissions) || !Array.isArray(parsed.volunteers) || !Array.isArray(parsed.tasks)) {
        throw new Error("Stored event data has an unexpected format.");
      }
      return parsed;
    } catch (error) {
      console.error("Could not read saved event data.", error);
      showToast("Saved data could not be read. Export or clear browser storage to recover.", true);
      return { submissions: [], volunteers: [], tasks: [] };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Could not save event data.", error);
      showToast("Could not save data. Check available browser storage.", true);
    }
  }

  function showToast(message, error = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function heading(title, description, buttonText = "", action = "") {
    return `<div class="page-heading"><div><p class="eyebrow">YOUR EVENT, AT A GLANCE</p><h1>${title}</h1><p>${description}</p></div>${buttonText ? `<button class="button button-primary" data-action="${action}" type="button">＋ ${buttonText}</button>` : ""}</div>`;
  }

  function emptyState(title, message) {
    return `<div class="empty-state"><strong>${title}</strong>${message}</div>`;
  }

  function renderDashboard() {
    const counts = Object.fromEntries(submissionStatuses.map((status) => [status, data.submissions.filter((item) => item.status === status).length]));
    const today = new Date().toDateString();
    const present = data.volunteers.filter((person) => person.attendance && new Date(person.attendance).toDateString() === today).length;
    const done = data.tasks.filter((task) => task.status === "Done").length;
    const now = new Date();
    const openTasks = data.tasks.filter((task) => task.status !== "Done");
    const overdue = openTasks.filter((task) => task.dueAt && new Date(task.dueAt) < now).length;
    const deadlines = openTasks.filter((task) => task.dueAt).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).slice(0, 5);
    const unassigned = openTasks.filter((task) => !task.assigneeId);
    const statusCards = submissionStatuses.map((status) => `<div class="status-count"><strong>${counts[status]}</strong><span>${status}</span></div>`).join("");
    const deadlineRows = deadlines.length ? deadlines.map((task) => {
      const person = findVolunteer(task.assigneeId);
      const isOverdue = new Date(task.dueAt) < now;
      return `<div class="list-row"><span class="list-avatar">${escapeHtml(initials(task.title))}</span><div class="list-main"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(person ? person.name : "Unassigned")}</small></div><div class="row-meta"><strong class="${isOverdue ? "overdue-text" : ""}">${isOverdue ? "Overdue" : formatDate(task.dueAt, true)}</strong>${escapeHtml(task.priority)} priority</div></div>`;
    }).join("") : emptyState("No upcoming deadlines", "Create a task to keep your event moving.");
    const unassignedRows = unassigned.length ? unassigned.map((task) => `<div class="list-row"><span class="list-avatar">!</span><div class="list-main"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.description || "No description")}</small></div><div class="row-meta"><strong>${formatDate(task.dueAt, true)}</strong><span class="status-badge ${statusClass(task.status)}">${escapeHtml(task.status)}</span></div></div>`).join("") : emptyState("Everyone is assigned", "There are no unassigned open tasks.");

    $("#view").innerHTML = `${heading("Dashboard", "A clear view of everything happening around your event.")}
      <div class="stats-grid">
        <article class="stat-card"><div class="stat-top"><span>Total submissions</span><span class="stat-icon">▤</span></div><div class="stat-number">${data.submissions.length}</div><div class="stat-caption">${counts["Under Review"]} waiting for review</div></article>
        <article class="stat-card"><div class="stat-top"><span>Volunteers present</span><span class="stat-icon">♧</span></div><div class="stat-number">${present}<span style="font-size:15px;color:var(--muted);font-weight:500"> / ${data.volunteers.length}</span></div><div class="stat-caption">Checked in today</div></article>
        <article class="stat-card"><div class="stat-top"><span>Tasks completed</span><span class="stat-icon">✓</span></div><div class="stat-number">${done}<span style="font-size:15px;color:var(--muted);font-weight:500"> / ${data.tasks.length}</span></div><div class="stat-caption">${openTasks.length} still pending</div></article>
        <article class="stat-card"><div class="stat-top"><span>Overdue tasks</span><span class="stat-icon" style="color:var(--red)">◷</span></div><div class="stat-number">${overdue}</div><div class="stat-caption">Need your attention</div></article>
      </div>
      <div class="dashboard-grid">
        <div><section class="panel"><div class="panel-heading"><div><h2>Submission pipeline</h2><p>Where each entry stands right now</p></div><button class="text-link" data-action="go-submissions">View all →</button></div><div class="status-counts">${statusCards}</div></section>
          <section class="panel"><div class="panel-heading"><div><h2>Next deadlines</h2><p>Upcoming tasks that need a nudge</p></div><button class="text-link" data-action="go-tasks">View board →</button></div>${deadlineRows}</section></div>
        <div><section class="panel"><div class="panel-heading"><div><h2>Unassigned tasks</h2><p>These tasks still need an owner</p></div><span class="column-count">${unassigned.length}</span></div>${unassignedRows}</section>
          <section class="panel"><div class="panel-heading"><div><h2>Workspace data</h2><p>Manage your local sample records</p></div></div><p style="color:var(--muted);font-size:11px;line-height:1.6;margin:0">Your event information is stored only in this browser. Download a JSON backup before switching devices or clearing browser data.</p><div class="sample-actions"><button class="button button-small button-danger" data-action="clear-samples">Clear sample data</button></div></section></div>
      </div>`;
  }

  function renderSubmissions() {
    const search = normalized($("#submission-search")?.value);
    const statusFilter = $("#submission-status")?.value || "";
    const eventFilter = $("#submission-event")?.value || "";
    const sort = $("#submission-sort")?.value || "date-desc";
    const events = [...new Set(data.submissions.map((item) => item.event).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const duplicateNames = new Set();
    const nameCounts = new Map();
    data.submissions.forEach((item) => {
      const name = normalized(item.participant);
      if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    });
    nameCounts.forEach((count, name) => { if (count > 1) duplicateNames.add(name); });
    let rows = data.submissions.filter((item) => {
      const matchesSearch = !search || [item.participant, item.contact, item.college, item.event].some((value) => normalized(value).includes(search));
      return matchesSearch && (!statusFilter || item.status === statusFilter) && (!eventFilter || item.event === eventFilter);
    });
    rows = [...rows].sort((a, b) => sort === "score-desc"
      ? Number(b.score || 0) - Number(a.score || 0)
      : sort === "score-asc" ? Number(a.score || 0) - Number(b.score || 0)
        : sort === "date-asc" ? new Date(a.submittedAt) - new Date(b.submittedAt)
          : new Date(b.submittedAt) - new Date(a.submittedAt));
    const tableRows = rows.map((item) => {
      const dupe = duplicateNames.has(normalized(item.participant));
      const statusOptions = submissionStatuses.map((status) => `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`).join("");
      return `<tr><td class="primary-cell"><strong>${escapeHtml(item.participant)}</strong>${dupe ? `<span class="duplicate-flag">Duplicate participant</span>` : ""}<small>${escapeHtml(item.college || "No college")}</small></td><td>${escapeHtml(item.event || "—")}</td><td><a href="${escapeHtml(safeUrl(item.link))}" target="_blank" rel="noopener noreferrer">${item.link ? "Open link ↗" : "—"}</a></td><td><select class="control inline-select" data-status-id="${escapeHtml(item.id)}" aria-label="Change status for ${escapeHtml(item.participant)}">${statusOptions}</select></td><td><strong>${Number(item.score) || 0}</strong></td><td>${formatDate(item.submittedAt, true)}</td><td class="actions-cell"><button data-action="edit-submission" data-id="${escapeHtml(item.id)}">Edit</button><button data-action="delete-submission" data-id="${escapeHtml(item.id)}">Delete</button></td></tr>`;
    }).join("");
    $("#view").innerHTML = `${heading("Submissions", "Review entries, keep track of scores, and find your standouts.", "Add submission", "add-submission")}
      <div class="toolbar"><div class="search-box"><input class="control" id="submission-search" type="search" placeholder="Search participant, college, event..." value="${escapeHtml($("#submission-search")?.value || "")}"></div>
        <select class="control" id="submission-status" aria-label="Filter by status"><option value="">All statuses</option>${submissionStatuses.map((s) => `<option ${statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <select class="control" id="submission-event" aria-label="Filter by event"><option value="">All events</option>${events.map((event) => `<option ${eventFilter === event ? "selected" : ""}>${escapeHtml(event)}</option>`).join("")}</select>
        <select class="control" id="submission-sort" aria-label="Sort submissions"><option value="date-desc" ${sort === "date-desc" ? "selected" : ""}>Newest first</option><option value="date-asc" ${sort === "date-asc" ? "selected" : ""}>Oldest first</option><option value="score-desc" ${sort === "score-desc" ? "selected" : ""}>Highest score</option><option value="score-asc" ${sort === "score-asc" ? "selected" : ""}>Lowest score</option></select>
        <div class="segmented"><button class="segment ${submissionsView === "table" ? "active" : ""}" data-action="submission-table">Table</button><button class="segment ${submissionsView === "leaderboard" ? "active" : ""}" data-action="submission-leaderboard">Leaderboard</button></div>
      </div>
      <section class="table-panel"><div class="table-scroll">${submissionsView === "leaderboard" ? renderLeaderboard(rows) : `<table><thead><tr><th>Participant / team</th><th>Event / round</th><th>Submission</th><th>Status</th><th>Score</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${tableRows || `<tr><td colspan="7">${emptyState("No submissions found", "Try changing your search or filters.")}</td></tr>`}</tbody></table>`}</div></section>
      <div class="sample-actions"><button class="button button-small" data-action="export-submissions">Export submissions CSV</button><button class="button button-small button-danger" data-action="clear-samples">Clear sample data</button></div>`;
  }

  function renderLeaderboard(rows) {
    const ranked = [...rows].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return ranked.length ? `<table><thead><tr><th>Rank</th><th>Participant / team</th><th>Event / round</th><th>Status</th><th>Score</th><th>Judge notes</th><th>Actions</th></tr></thead><tbody>${ranked.map((item, index) => `<tr><td><span class="leaderboard-rank">${index + 1}</span></td><td class="primary-cell"><strong>${escapeHtml(item.participant)}</strong><small>${escapeHtml(item.college || "No college")}</small></td><td>${escapeHtml(item.event || "—")}</td><td><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td><strong>${Number(item.score) || 0}</strong></td><td>${escapeHtml(item.notes || "—")}</td><td class="actions-cell"><button data-action="edit-submission" data-id="${escapeHtml(item.id)}">Edit</button><button data-action="delete-submission" data-id="${escapeHtml(item.id)}">Delete</button></td></tr>`).join("")}</tbody></table>` : emptyState("No submissions to rank", "Add a submission to start your leaderboard.");
  }

  function renderVolunteers() {
    const search = normalized($("#volunteer-search")?.value);
    const roleFilter = $("#volunteer-role")?.value || "";
    const teamFilter = $("#volunteer-team")?.value || "";
    const statusFilter = $("#volunteer-status")?.value || "";
    const roles = [...new Set(data.volunteers.map((p) => p.role).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const teams = [...new Set(data.volunteers.map((p) => p.team).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const today = new Date().toDateString();
    const people = data.volunteers.filter((person) => normalized(person.name).includes(search)
      && (!roleFilter || person.role === roleFilter) && (!teamFilter || person.team === teamFilter) && (!statusFilter || person.status === statusFilter));
    const rows = people.map((person) => {
      const checked = person.attendance && new Date(person.attendance).toDateString() === today;
      const phone = String(person.phone || "").replace(/[^\d+]/g, "");
      return `<tr><td><div class="volunteer-name"><span class="volunteer-avatar">${escapeHtml(initials(person.name))}</span><div class="primary-cell"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.availability || "Availability not set")}</small></div></div></td><td>${escapeHtml(person.role || "—")}</td><td>${escapeHtml(person.team || "—")}</td><td><span class="status-badge ${statusClass(person.status)}">${escapeHtml(person.status)}</span></td><td><div class="contact-links">${phone ? `<a href="tel:${escapeHtml(phone)}">Call</a><a href="https://wa.me/${escapeHtml(phone.replace(/\D/g, ""))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : "—"}</div></td><td><strong>${taskCount(person.id)}</strong><span style="color:var(--muted)"> open</span></td><td><button class="button button-small attendance-button ${checked ? "checked-in" : ""}" data-action="check-in" data-id="${escapeHtml(person.id)}">${checked ? "✓ Present" : "Check in"}</button>${checked ? `<small style="display:block;margin-top:4px;color:var(--muted)">${formatDate(person.attendance, true)}</small>` : ""}</td><td class="actions-cell"><button data-action="edit-volunteer" data-id="${escapeHtml(person.id)}">Edit</button><button data-action="delete-volunteer" data-id="${escapeHtml(person.id)}">Delete</button></td></tr>`;
    }).join("");
    $("#view").innerHTML = `${heading("Volunteers", "Your people make the event happen. Keep your crew in sync.", "Add volunteer", "add-volunteer")}
      <div class="toolbar"><div class="search-box"><input class="control" id="volunteer-search" type="search" placeholder="Search by name..." value="${escapeHtml($("#volunteer-search")?.value || "")}"></div>
        <select class="control" id="volunteer-role" aria-label="Filter by role"><option value="">All roles</option>${roles.map((role) => `<option ${roleFilter === role ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}</select>
        <select class="control" id="volunteer-team" aria-label="Filter by team"><option value="">All teams</option>${teams.map((team) => `<option ${teamFilter === team ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}</select>
        <select class="control" id="volunteer-status" aria-label="Filter by status"><option value="">All statuses</option>${volunteerStatuses.map((s) => `<option ${statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <section class="table-panel"><div class="table-scroll"><table><thead><tr><th>Volunteer</th><th>Role</th><th>Assigned team</th><th>Status</th><th>Contact</th><th>Tasks</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="8">${emptyState("No volunteers found", "Try changing your search or filters.")}</td></tr>`}</tbody></table></div></section>
      <div class="sample-actions"><button class="button button-small" data-action="export-volunteers">Export volunteers CSV</button><button class="button button-small button-danger" data-action="clear-samples">Clear sample data</button></div>`;
  }

  function renderTasks() {
    const now = new Date();
    const columns = taskStatuses.map((status) => {
      const tasks = data.tasks.filter((task) => task.status === status).sort((a, b) => {
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt) - new Date(b.dueAt);
      });
      const cards = tasks.map((task) => {
        const person = findVolunteer(task.assigneeId);
        const isOverdue = task.status !== "Done" && task.dueAt && new Date(task.dueAt) < now;
        const nextStatus = taskStatuses[(taskStatuses.indexOf(task.status) + 1) % taskStatuses.length];
        return `<article class="task-card ${isOverdue ? "overdue" : ""}"><div class="task-card-top"><span class="priority-badge priority-${String(task.priority).toLowerCase()}">${escapeHtml(task.priority)} priority</span><div class="task-controls"><button data-action="edit-task" data-id="${escapeHtml(task.id)}">Edit</button><button data-action="delete-task" data-id="${escapeHtml(task.id)}">Delete</button></div></div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description || "No description")}</p><div class="task-assignee"><span class="volunteer-avatar" style="width:23px;height:23px;flex-basis:23px">${person ? escapeHtml(initials(person.name)) : "?"}</span>${escapeHtml(person ? person.name : "Unassigned")}</div><div class="task-bottom"><span class="due-label ${isOverdue ? "overdue-text" : ""}">${isOverdue ? "OVERDUE · " : ""}${formatDate(task.dueAt, true)}</span><button class="button button-small" data-action="move-task" data-id="${escapeHtml(task.id)}">${status === "Done" ? "Reopen" : `Move to ${nextStatus}`}</button></div></article>`;
      }).join("");
      return `<section class="kanban-column"><div class="column-heading"><strong>${status}</strong><span class="column-count">${tasks.length}</span></div>${cards || emptyState("Nothing here yet", "Tasks in this stage appear here.")}</section>`;
    }).join("");
    $("#view").innerHTML = `${heading("Tasks", "Small steps, clearly owned. Keep every detail moving.", "Add task", "add-task")}<div class="kanban-board">${columns}</div><div class="sample-actions"><button class="button button-small button-danger" data-action="clear-samples">Clear sample data</button></div>`;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch (_) {
      return "#";
    }
  }

  function render() {
    const names = { dashboard: "Dashboard", submissions: "Submissions", volunteers: "Volunteers", tasks: "Tasks" };
    $("#current-tab-name").textContent = names[activeTab];
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === activeTab));
    if (activeTab === "dashboard") renderDashboard();
    if (activeTab === "submissions") renderSubmissions();
    if (activeTab === "volunteers") renderVolunteers();
    if (activeTab === "tasks") renderTasks();
  }

  function field(label, name, value = "", options = {}) {
    const required = options.required ? "required" : "";
    const cls = `field${options.full ? " full" : ""}`;
    let control;
    if (options.select) {
      control = `<select class="form-control" name="${name}" ${required}>${options.placeholder ? `<option value="">${options.placeholder}</option>` : ""}${options.select.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        return `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
      }).join("")}</select>`;
    } else if (options.textarea) {
      control = `<textarea class="form-control" name="${name}" ${required} ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}>${escapeHtml(value)}</textarea>`;
    } else {
      control = `<input class="form-control" type="${options.type || "text"}" name="${name}" value="${escapeHtml(value)}" ${required} ${options.min !== undefined ? `min="${options.min}"` : ""} ${options.max !== undefined ? `max="${options.max}"` : ""} ${options.step ? `step="${options.step}"` : ""} ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}>`;
    }
    return `<div class="${cls}"><label>${label}${options.required ? " *" : ""}</label>${control}</div>`;
  }

  function openForm(kind, record = null) {
    const editing = Boolean(record);
    const title = `${editing ? "Edit" : "Add"} ${kind}`;
    let fields = "";
    if (kind === "submission") {
      fields = field("Participant or team name", "participant", record?.participant || "", { required: true })
        + field("Contact (phone or email)", "contact", record?.contact || "")
        + field("College", "college", record?.college || "")
        + field("Event or round", "event", record?.event || "")
        + field("Submission link", "link", record?.link || "", { type: "url", full: true })
        + field("Submitted date and time", "submittedAt", record?.submittedAt || localDateTime(), { type: "datetime-local", required: true })
        + field("Status", "status", record?.status || "Received", { select: submissionStatuses })
        + field("Score (0-100)", "score", record?.score ?? 0, { type: "number", min: 0, max: 100, step: 1 })
        + field("Judge notes", "notes", record?.notes || "", { textarea: true, full: true });
    } else if (kind === "volunteer") {
      fields = field("Name", "name", record?.name || "", { required: true })
        + field("Phone", "phone", record?.phone || "", { type: "tel" })
        + field("Role", "role", record?.role || "")
        + field("Assigned team", "team", record?.team || "")
        + field("Availability", "availability", record?.availability || "")
        + field("Status", "status", record?.status || "Active", { select: volunteerStatuses });
    } else {
      const volunteers = data.volunteers.map((person) => ({ value: person.id, label: person.name }));
      fields = field("Task title", "title", record?.title || "", { required: true })
        + field("Due date and time", "dueAt", record?.dueAt || "", { type: "datetime-local" })
        + field("Description", "description", record?.description || "", { textarea: true, full: true })
        + field("Assigned volunteer", "assigneeId", record?.assigneeId || "", { select: volunteers, placeholder: "Unassigned" })
        + field("Priority", "priority", record?.priority || "Medium", { select: priorities })
        + field("Status", "status", record?.status || "To Do", { select: taskStatuses });
    }
    $("#modal-title").textContent = title;
    const form = $("#record-form");
    form.dataset.kind = kind;
    form.dataset.id = record?.id || "";
    form.innerHTML = `<div class="form-grid">${fields}</div><div class="form-actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${editing ? "Save changes" : `Add ${kind}`}</button></div>`;
    $("#modal").hidden = false;
    $("input, select, textarea", form)?.focus();
  }

  function closeForm() {
    $("#modal").hidden = true;
    $("#record-form").innerHTML = "";
  }

  function deleteRecord(type, recordId) {
    const collection = type === "submission" ? data.submissions : type === "volunteer" ? data.volunteers : data.tasks;
    const item = collection.find((entry) => entry.id === recordId);
    if (!item || !window.confirm(`Delete "${item.participant || item.name || item.title}"? This cannot be undone.`)) return;
    if (type === "volunteer") {
      data.tasks.forEach((task) => { if (task.assigneeId === recordId) task.assigneeId = ""; });
    }
    const index = collection.findIndex((entry) => entry.id === recordId);
    collection.splice(index, 1);
    save();
    render();
    showToast(`${type[0].toUpperCase()}${type.slice(1)} deleted.`);
  }

  function clearSamples() {
    const sampleCount = ["submissions", "volunteers", "tasks"].reduce((total, key) => total + data[key].filter((item) => item.isSample).length, 0);
    if (!sampleCount) {
      showToast("There is no sample data to clear.");
      return;
    }
    if (!window.confirm(`Remove ${sampleCount} sample records? Your records will not be affected.`)) return;
    data.submissions = data.submissions.filter((item) => !item.isSample);
    const removedVolunteers = new Set(data.volunteers.filter((item) => item.isSample).map((person) => person.id));
    data.volunteers = data.volunteers.filter((item) => !item.isSample);
    data.tasks = data.tasks.filter((item) => !item.isSample);
    data.tasks.forEach((task) => { if (removedVolunteers.has(task.assigneeId)) task.assigneeId = ""; });
    save();
    render();
    showToast("Sample data cleared.");
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function download(filename, contents, type) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv(kind) {
    const rows = kind === "submissions"
      ? [["Participant or team", "Contact", "College", "Event or round", "Submission link", "Submitted at", "Status", "Score", "Judge notes"], ...data.submissions.map((item) => [item.participant, item.contact, item.college, item.event, item.link, item.submittedAt, item.status, item.score, item.notes])]
      : [["Name", "Phone", "Role", "Assigned team", "Availability", "Status", "Attendance timestamp", "Open task count"], ...data.volunteers.map((person) => [person.name, person.phone, person.role, person.team, person.availability, person.status, person.attendance, taskCount(person.id)])];
    const csv = "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    download(`${kind}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    showToast(`${kind === "submissions" ? "Submissions" : "Volunteers"} CSV exported.`);
  }

  function exportBackup() {
    const backup = { app: "gatherwell-event-manager", version: 1, exportedAt: new Date().toISOString(), data };
    download(`gatherwell-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
    showToast("JSON backup exported.");
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed?.data || parsed;
      if (!imported || !Array.isArray(imported.submissions) || !Array.isArray(imported.volunteers) || !Array.isArray(imported.tasks)) {
        throw new Error("The selected file is not a valid Gatherwell backup.");
      }
      if (!window.confirm("Import this backup and replace all current submissions, volunteers, and tasks?")) return;
      data = {
        submissions: imported.submissions,
        volunteers: imported.volunteers,
        tasks: imported.tasks
      };
      save();
      render();
      showToast("Backup imported successfully.");
    } catch (error) {
      console.error("Could not import backup.", error);
      showToast(error instanceof SyntaxError ? "That file is not valid JSON." : error.message || "Could not import this backup.", true);
    } finally {
      $("#backup-file").value = "";
    }
  }

  function onAction(action, recordId) {
    if (action === "add-submission") openForm("submission");
    if (action === "add-volunteer") openForm("volunteer");
    if (action === "add-task") openForm("task");
    if (action === "edit-submission") openForm("submission", data.submissions.find((item) => item.id === recordId));
    if (action === "edit-volunteer") openForm("volunteer", findVolunteer(recordId));
    if (action === "edit-task") openForm("task", data.tasks.find((item) => item.id === recordId));
    if (action === "delete-submission") deleteRecord("submission", recordId);
    if (action === "delete-volunteer") deleteRecord("volunteer", recordId);
    if (action === "delete-task") deleteRecord("task", recordId);
    if (action === "clear-samples") clearSamples();
    if (action === "submission-table") { submissionsView = "table"; render(); }
    if (action === "submission-leaderboard") { submissionsView = "leaderboard"; render(); }
    if (action === "export-submissions") exportCsv("submissions");
    if (action === "export-volunteers") exportCsv("volunteers");
    if (action === "close-modal") closeForm();
    if (action === "go-submissions") { activeTab = "submissions"; render(); }
    if (action === "go-tasks") { activeTab = "tasks"; render(); }
    if (action === "check-in") {
      const person = findVolunteer(recordId);
      if (person) {
        const checkedToday = person.attendance && new Date(person.attendance).toDateString() === new Date().toDateString();
        person.attendance = checkedToday ? null : new Date().toISOString();
        save();
        render();
        showToast(checkedToday ? `${person.name} check-in cleared.` : `${person.name} checked in.`);
      }
    }
    if (action === "move-task") {
      const task = data.tasks.find((item) => item.id === recordId);
      if (task) {
        task.status = task.status === "Done" ? "To Do" : taskStatuses[(taskStatuses.indexOf(task.status) + 1) % taskStatuses.length];
        save();
        render();
        showToast(`Task moved to ${task.status}.`);
      }
    }
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      activeTab = tab.dataset.tab;
      render();
      return;
    }
    const actionElement = event.target.closest("[data-action]");
    if (actionElement) onAction(actionElement.dataset.action, actionElement.dataset.id);
  });

  document.addEventListener("input", (event) => {
    if (["submission-search", "volunteer-search"].includes(event.target.id)) {
      const position = event.target.selectionStart;
      const idValue = event.target.id;
      render();
      const replacement = $(`#${idValue}`);
      replacement?.focus();
      replacement?.setSelectionRange(position, position);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-status-id]")) {
      const item = data.submissions.find((entry) => entry.id === target.dataset.statusId);
      if (item) { item.status = target.value; save(); render(); showToast("Submission status updated."); }
      return;
    }
    if (target.id.startsWith("submission-") || target.id.startsWith("volunteer-")) {
      render();
    }
  });

  $("#record-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const kind = form.dataset.kind;
    const collection = kind === "submission" ? data.submissions : kind === "volunteer" ? data.volunteers : data.tasks;
    const existing = collection.find((item) => item.id === form.dataset.id);
    const record = { ...existing, ...values, id: existing?.id || id(), isSample: existing?.isSample || false };
    if (kind === "submission") {
      record.score = Math.max(0, Math.min(100, Number(values.score) || 0));
      record.link = values.link ? safeUrl(values.link) === "#" ? "" : safeUrl(values.link) : "";
    }
    if (existing) Object.assign(existing, record);
    else collection.push(record);
    save();
    closeForm();
    render();
    showToast(`${kind[0].toUpperCase()}${kind.slice(1)} ${existing ? "updated" : "added"}.`);
  });

  $("#modal-close").addEventListener("click", closeForm);
  $("#modal").addEventListener("click", (event) => { if (event.target === $("#modal")) closeForm(); });
  $("#export-backup").addEventListener("click", exportBackup);
  $("#import-backup").addEventListener("click", () => $("#backup-file").click());
  $("#backup-file").addEventListener("change", (event) => importBackup(event.target.files[0]));
  $("#theme-toggle").addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    $("#theme-label").textContent = dark ? "Light mode" : "Dark mode";
    $("#theme-icon").textContent = dark ? "☀" : "☾";
  });

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    $("#theme-label").textContent = "Light mode";
    $("#theme-icon").textContent = "☀";
  }
  data = loadData();
  render();
})();
