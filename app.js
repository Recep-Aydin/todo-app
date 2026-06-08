(() => {
  "use strict";

  // --- Supabase yapılandırması ---
  const SUPABASE_URL = "https://mcdbqsjsyaakixondyjg.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGJxc2pzeWFha2l4b25keWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTA2ODQsImV4cCI6MjA5NjE2NjY4NH0._y9FfIRnvfeZEgvpOhKxIl_fztXCEElqiDnI7n9ESMA";
  const REST = `${SUPABASE_URL}/rest/v1/todos`;
  const AUTH = `${SUPABASE_URL}/auth/v1`;
  const SESSION_KEY = "sb_session";

  // --- DOM: auth ---
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");
  const authForm = document.getElementById("authForm");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authSubmit = document.getElementById("authSubmit");
  const authError = document.getElementById("authError");
  const authToggle = document.getElementById("authToggle");
  const authSubtitle = document.getElementById("authSubtitle");
  const authSwitchText = document.getElementById("authSwitchText");
  const userEmailEl = document.getElementById("userEmail");
  const logoutBtn = document.getElementById("logoutBtn");

  // --- DOM: todos ---
  const form = document.getElementById("todoForm");
  const input = document.getElementById("todoInput");
  const list = document.getElementById("todoList");
  const filters = document.getElementById("filters");
  const empty = document.getElementById("empty");
  const footer = document.getElementById("footer");
  const counter = document.getElementById("counter");
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const dateEl = document.getElementById("date");
  const dueInput = document.getElementById("todoDue");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const termNameEl = document.getElementById("termName");
  const termDefEl = document.getElementById("termDef");
  const suggestionsEl = document.getElementById("suggestions");
  const suggestRefresh = document.getElementById("suggestRefresh");
  const newsListEl = document.getElementById("newsList");
  const newsRefresh = document.getElementById("newsRefresh");
  const agendaText = document.getElementById("agendaText");
  const agendaDayEl = document.getElementById("agendaDay");
  const agendaBadge = document.getElementById("agendaBadge");
  const agendaStatus = document.getElementById("agendaStatus");
  const agendaPrev = document.getElementById("agendaPrev");
  const agendaNext = document.getElementById("agendaNext");
  const agendaToday = document.getElementById("agendaToday");
  const priorityInput = document.getElementById("todoPriority");
  const progressEl = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");
  const progressPct = document.getElementById("progressPct");
  const confettiEl = document.getElementById("confetti");

  // --- State ---
  let session = loadSession(); // { access_token, refresh_token, user }
  let todos = [];
  let filter = "all";
  let mode = "login"; // login | signup
  let search = "";
  let editingId = null;
  let draggingId = null;

  // =========================================================
  //  OTURUM (SESSION) YÖNETİMİ
  // =========================================================
  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  function saveSession(s) {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function refreshSession() {
    if (!session?.refresh_token) throw new Error("no-refresh");
    const res = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) throw new Error("refresh-failed");
    saveSession(await res.json());
  }

  // =========================================================
  //  KİMLİK DOĞRULAMA (AUTH) İSTEKLERİ
  // =========================================================
  async function authRequest(path, body) {
    const res = await fetch(`${AUTH}${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.msg || data.error_description || data.error || "İşlem başarısız");
    }
    return data;
  }

  async function signUp(email, password) {
    const data = await authRequest("/signup", { email, password });
    // Email onayı kapalı olduğundan signup doğrudan oturum döndürür
    if (data.access_token) {
      saveSession(data);
    } else {
      // Nadir durum: oturum yoksa hemen giriş yap
      await signIn(email, password);
    }
  }

  async function signIn(email, password) {
    const data = await authRequest("/token?grant_type=password", { email, password });
    saveSession(data);
  }

  async function signOut() {
    try {
      await fetch(`${AUTH}/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
    } catch {
      /* yoksay */
    }
    saveSession(null);
    todos = [];
    render(); // listeyi temizle
    setMode("login"); // çıkış sonrası giriş moduna dön
    showAuth();
  }

  // =========================================================
  //  TODO REST İSTEKLERİ (kullanıcı token'ı ile)
  // =========================================================
  async function api(path = "", options = {}, retry = true) {
    const res = await fetch(`${REST}${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    // Token süresi dolmuşsa bir kez yenile ve tekrar dene
    if (res.status === 401 && retry) {
      try {
        await refreshSession();
        return api(path, options, false);
      } catch {
        saveSession(null);
        showAuth();
        throw new Error("Oturum süresi doldu, tekrar giriş yapın.");
      }
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Supabase ${res.status}: ${t}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchTodos() {
    // position artan: küçük = üstte; eşitlik/boşlukta en yeni üstte
    todos = await api("?select=*&order=position.asc.nullslast,inserted_at.desc");
    render();
  }

  async function addTodo(text, dueDate, priority) {
    const payload = { text }; // user_id DB'de auth.uid() ile otomatik
    if (dueDate) payload.due_date = dueDate;
    payload.priority = priority || "medium";
    // Yeni görev en üste: mevcut en küçük pozisyonun bir altı
    const minPos = todos.length
      ? Math.min(...todos.map((t) => t.position ?? 0))
      : 0;
    payload.position = minPos - 1;
    const [created] = await api("", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    todos.unshift(created);
    render();
  }

  // Öncelik noktasına tıklayınca döngü: yüksek → orta → düşük → yüksek
  async function cyclePriority(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const order = ["high", "medium", "low"];
    const cur = order.indexOf(todo.priority || "medium");
    const next = order[(cur + 1) % order.length];
    const prev = todo.priority;
    todo.priority = next; // iyimser
    render();
    try {
      await api(`?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ priority: next }),
      });
    } catch (err) {
      todo.priority = prev;
      render();
      alert(err.message);
    }
  }

  // Sürükle-bırak ile yeni sıraya göre pozisyonu kalıcılaştır
  async function reorderTodo(draggedId, targetId, after) {
    if (draggedId == null || draggedId === targetId) return;
    const fromIdx = todos.findIndex((t) => t.id === draggedId);
    if (fromIdx < 0) return;
    const moved = todos[fromIdx];
    todos.splice(fromIdx, 1);
    let targetIdx = todos.findIndex((t) => t.id === targetId);
    if (targetIdx < 0) {
      todos.splice(fromIdx, 0, moved); // hedef bulunamadı, geri koy
      return;
    }
    if (after) targetIdx += 1;
    todos.splice(targetIdx, 0, moved);

    // Komşulara göre kesirli pozisyon hesapla (tek satır güncellemesi yeter)
    const prev = todos[targetIdx - 1];
    const next = todos[targetIdx + 1];
    let newPos;
    if (!prev) newPos = (next?.position ?? 0) - 1;
    else if (!next) newPos = (prev.position ?? 0) + 1;
    else newPos = ((prev.position ?? 0) + (next.position ?? 0)) / 2;
    moved.position = newPos;
    render();

    try {
      await api(`?id=eq.${moved.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ position: newPos }),
      });
    } catch (err) {
      alert(err.message);
      fetchTodos(); // hata: sunucudan tazele
    }
  }

  async function editTodo(id, newText) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const trimmed = newText.trim();
    if (!trimmed || trimmed === todo.text) return; // değişiklik yok
    const prev = todo.text;
    todo.text = trimmed; // iyimser
    render();
    try {
      await api(`?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ text: trimmed }),
      });
    } catch (err) {
      todo.text = prev;
      render();
      alert(err.message);
    }
  }

  async function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const next = !todo.completed;
    const recurring = next && todo.recurrence && todo.recurrence !== "none";

    if (recurring) {
      // Tekrarlı görev: tamamlanınca bir sonraki uygun güne yeniden planla
      const prevDue = todo.due_date;
      const nd = nextOccurrence(todo.recurrence);
      todo.due_date = nd;
      todo.completed = false; // aktif kalır, ileri tarihe taşınır
      render();
      fireConfetti();
      try {
        await api(`?id=eq.${id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ due_date: nd, completed: false }),
        });
      } catch (err) {
        todo.due_date = prevDue;
        render();
        alert(err.message);
      }
      return;
    }

    todo.completed = next;
    render();
    if (next) fireConfetti(); // tamamlandığında 🎉
    try {
      await api(`?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ completed: next }),
      });
    } catch (err) {
      todo.completed = !next;
      render();
      alert(err.message);
    }
  }

  // Tekrar türüne göre bir sonraki uygun günü hesapla (bugünden sonra)
  function nextOccurrence(type) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dow = d.getDay(); // 0=Paz, 6=Cmt
      const ok =
        type === "daily" ||
        (type === "weekday" && dow >= 1 && dow <= 5) ||
        (type === "weekend" && (dow === 0 || dow === 6));
      if (ok)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return null;
  }

  const RECUR_LABEL = {
    none: "Yok",
    daily: "Her gün",
    weekday: "Hafta içi",
    weekend: "Hafta sonu",
  };

  // 🔁 butonu: Yok → Her gün → Hafta içi → Hafta sonu → Yok
  async function cycleRecurrence(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const order = ["none", "daily", "weekday", "weekend"];
    const cur = order.indexOf(todo.recurrence || "none");
    const nextR = order[(cur + 1) % order.length];
    const prev = todo.recurrence;
    todo.recurrence = nextR;
    // Tekrar açıldıysa ve tarihi yoksa, bir sonraki uygun güne ata
    let dueChange = {};
    if (nextR !== "none" && !todo.due_date) {
      todo.due_date = nextOccurrence(nextR);
      dueChange = { due_date: todo.due_date };
    }
    render();
    try {
      await api(`?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ recurrence: nextR, ...dueChange }),
      });
    } catch (err) {
      todo.recurrence = prev;
      render();
      alert(err.message);
    }
  }

  async function deleteTodo(id) {
    const backup = todos;
    todos = todos.filter((t) => t.id !== id);
    render();
    try {
      await api(`?id=eq.${id}`, { method: "DELETE" });
    } catch (err) {
      todos = backup;
      render();
      alert(err.message);
    }
  }

  async function clearCompleted() {
    if (!todos.some((t) => t.completed)) return;
    try {
      await api("?completed=eq.true", { method: "DELETE" });
      todos = todos.filter((t) => !t.completed);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  // =========================================================
  //  RENDER
  // =========================================================
  function getVisible() {
    let result = todos;
    if (filter === "active") result = result.filter((t) => !t.completed);
    else if (filter === "completed") result = result.filter((t) => t.completed);
    if (search) {
      const q = search.toLocaleLowerCase("tr");
      result = result.filter((t) => t.text.toLocaleLowerCase("tr").includes(q));
    }
    return result;
  }

  // Son tarihi okunabilir biçime çevir + gecikme durumu
  function formatDue(dateStr) {
    const due = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / 86400000);
    let label;
    if (diffDays === 0) label = "Bugün";
    else if (diffDays === 1) label = "Yarın";
    else if (diffDays === -1) label = "Dün";
    else
      label = due.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    return { label, overdue: diffDays < 0 };
  }

  function render() {
    const visible = getVisible();
    // Sürükle-bırak yalnızca tam listede anlamlı (filtre yok + arama yok)
    const dragEnabled = filter === "all" && !search;
    list.innerHTML = "";

    visible.forEach((todo) => {
      const prio = todo.priority || "medium";
      const li = document.createElement("li");
      li.className =
        "todo-item prio-" + prio + (todo.completed ? " is-completed" : "");
      li.dataset.id = todo.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "todo-item__checkbox";
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      // Tıklanabilir öncelik noktası (döngü)
      const prioDot = document.createElement("button");
      prioDot.className = "todo-item__prio prio-" + prio;
      const prioLabel = { high: "Yüksek", medium: "Orta", low: "Düşük" }[prio];
      prioDot.title = "Öncelik: " + prioLabel + " (değiştirmek için tıkla)";
      prioDot.addEventListener("click", () => cyclePriority(todo.id));

      // İçerik kolonu (metin + son tarih)
      const content = document.createElement("div");
      content.className = "todo-item__content";

      if (editingId === todo.id) {
        // Düzenleme modu: input göster
        const edit = document.createElement("input");
        edit.className = "todo-item__edit";
        edit.value = todo.text;
        edit.maxLength = 200;
        const commit = () => {
          if (editingId !== todo.id) return; // çift tetiklenmeyi engelle (Enter + blur)
          const val = edit.value;
          editingId = null;
          editTodo(todo.id, val); // kendi render'ını yapar (değişiklik/hata durumunda)
          render(); // düzenleme modundan çık
        };
        edit.addEventListener("keydown", (e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            editingId = null;
            render();
          }
        });
        edit.addEventListener("blur", commit);
        content.appendChild(edit);
        li.append(checkbox, content);
        list.appendChild(li);
        setTimeout(() => {
          edit.focus();
          edit.select();
        }, 0);
        return;
      }

      const span = document.createElement("span");
      span.className = "todo-item__text";
      span.textContent = todo.text;
      span.title = "Tamamla (çift tıkla: düzenle)";
      span.addEventListener("click", () => toggleTodo(todo.id));
      span.addEventListener("dblclick", () => {
        editingId = todo.id;
        render();
      });
      content.appendChild(span);

      if (todo.due_date) {
        const { label, overdue } = formatDue(todo.due_date);
        const due = document.createElement("span");
        due.className = "todo-item__due" + (overdue && !todo.completed ? " is-overdue" : "");
        due.textContent = "📅 " + label;
        content.appendChild(due);
      }

      const recur = todo.recurrence || "none";
      if (recur !== "none") {
        const rb = document.createElement("span");
        rb.className = "todo-item__recur";
        rb.textContent = "🔁 " + RECUR_LABEL[recur];
        content.appendChild(rb);
      }

      // 🔁 Tekrar butonu
      const repeatBtn = document.createElement("button");
      repeatBtn.className =
        "todo-item__repeat" + (recur !== "none" ? " is-active" : "");
      repeatBtn.innerHTML = "🔁";
      repeatBtn.title = "Tekrar: " + RECUR_LABEL[recur] + " (değiştirmek için tıkla)";
      repeatBtn.addEventListener("click", () => cycleRecurrence(todo.id));

      const editBtn = document.createElement("button");
      editBtn.className = "todo-item__edit-btn";
      editBtn.innerHTML = "✏️";
      editBtn.title = "Düzenle";
      editBtn.addEventListener("click", () => {
        editingId = todo.id;
        render();
      });

      const del = document.createElement("button");
      del.className = "todo-item__delete";
      del.innerHTML = "&times;";
      del.setAttribute("aria-label", "Sil");
      del.addEventListener("click", () => deleteTodo(todo.id));

      // Sürükleme tutamacı + sürükle-bırak olayları
      const handle = document.createElement("span");
      handle.className = "todo-item__handle";
      handle.innerHTML = "&#x2630;"; // ☰
      handle.title = dragEnabled
        ? "Sürükleyerek sırala"
        : "Sıralama için filtreyi 'Tümü' yapın ve aramayı temizleyin";

      if (dragEnabled) {
        li.draggable = true;
        handle.style.cursor = "grab";

        li.addEventListener("dragstart", (e) => {
          draggingId = todo.id;
          li.classList.add("is-dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", todo.id); // Firefox için gerekli
        });
        li.addEventListener("dragend", () => {
          draggingId = null;
          list.querySelectorAll(".todo-item").forEach((el) =>
            el.classList.remove("is-dragging", "drop-above", "drop-below")
          );
        });
        li.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (draggingId == null || draggingId === todo.id) return;
          const rect = li.getBoundingClientRect();
          const after = e.clientY - rect.top > rect.height / 2;
          li.classList.toggle("drop-below", after);
          li.classList.toggle("drop-above", !after);
        });
        li.addEventListener("dragleave", () => {
          li.classList.remove("drop-above", "drop-below");
        });
        li.addEventListener("drop", (e) => {
          e.preventDefault();
          const rect = li.getBoundingClientRect();
          const after = e.clientY - rect.top > rect.height / 2;
          const dragged = draggingId;
          li.classList.remove("drop-above", "drop-below");
          reorderTodo(dragged, todo.id, after);
        });
      } else {
        handle.style.opacity = "0.25";
        handle.style.cursor = "not-allowed";
      }

      li.append(handle, prioDot, checkbox, content, repeatBtn, editBtn, del);
      list.appendChild(li);
    });

    renderProgress();

    const hasTodos = todos.length > 0;
    if (todos.length > 0 && visible.length === 0) {
      empty.hidden = false;
      empty.querySelector("p").textContent = search
        ? "Eşleşen görev yok 🔍"
        : "Bu görünümde görev yok";
    } else {
      empty.hidden = visible.length > 0;
      empty.querySelector("p").textContent = "Henüz görev yok 🎉";
    }
    footer.hidden = !hasTodos;

    const remaining = todos.filter((t) => !t.completed).length;
    counter.textContent =
      remaining === 1 ? "1 görev kaldı" : `${remaining} görev kaldı`;
  }

  // İlerleme çubuğu: tamamlanan / toplam
  function renderProgress() {
    const total = todos.length;
    if (total === 0) {
      progressEl.hidden = true;
      return;
    }
    const done = todos.filter((t) => t.completed).length;
    const pct = Math.round((done / total) * 100);
    progressEl.hidden = false;
    progressBar.style.width = pct + "%";
    progressPct.textContent = "%" + pct;
    progressBar.classList.toggle("is-complete", pct === 100);
  }

  // Konfeti patlaması (tamamlandığında)
  function fireConfetti() {
    const colors = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#22c55e", "#facc15"];
    const n = 80;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "confetti__piece";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", Math.random() * 200 - 100 + "px");
      p.style.setProperty("--dur", 1.2 + Math.random() * 1.2 + "s");
      p.style.animationDelay = Math.random() * 0.2 + "s";
      if (Math.random() < 0.5) p.style.borderRadius = "50%";
      confettiEl.appendChild(p);
      setTimeout(() => p.remove(), 2800);
    }
  }

  // =========================================================
  //  EKRAN GEÇİŞLERİ
  // =========================================================
  function showAuth() {
    appScreen.hidden = true;
    authScreen.hidden = false;
    authError.hidden = true;
    authPassword.value = "";
  }

  async function showApp() {
    authScreen.hidden = true;
    appScreen.hidden = false;
    userEmailEl.textContent = session?.user?.email || "";
    dateEl.textContent = new Date().toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    renderPanel(); // mühendis köşesini doldur
    try {
      await fetchTodos();
    } catch (err) {
      empty.hidden = false;
      empty.querySelector("p").textContent = "Hata: " + err.message;
    }
  }

  function setMode(next) {
    mode = next;
    authError.hidden = true;
    if (mode === "login") {
      authSubtitle.textContent = "Hesabına giriş yap";
      authSubmit.textContent = "Giriş Yap";
      authSwitchText.textContent = "Hesabın yok mu?";
      authToggle.textContent = "Kaydol";
      authPassword.autocomplete = "current-password";
    } else {
      authSubtitle.textContent = "Yeni hesap oluştur";
      authSubmit.textContent = "Kaydol";
      authSwitchText.textContent = "Zaten hesabın var mı?";
      authToggle.textContent = "Giriş Yap";
      authPassword.autocomplete = "new-password";
    }
  }

  // =========================================================
  //  OLAYLAR
  // =========================================================
  authToggle.addEventListener("click", () =>
    setMode(mode === "login" ? "signup" : "login")
  );

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;
    authError.hidden = true;
    authSubmit.disabled = true;
    authSubmit.textContent = mode === "login" ? "Giriş yapılıyor..." : "Kaydolunuyor...";
    try {
      if (mode === "signup") await signUp(email, password);
      else await signIn(email, password);
      await showApp();
    } catch (err) {
      authError.textContent = translateError(err.message);
      authError.hidden = false;
    } finally {
      authSubmit.disabled = false;
      setMode(mode);
    }
  });

  logoutBtn.addEventListener("click", signOut);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const due = dueInput.value || null;
    const priority = priorityInput.value || "medium";
    input.value = "";
    dueInput.value = "";
    priorityInput.value = "medium";
    input.focus();
    try {
      await addTodo(text, due, priority);
    } catch (err) {
      alert(err.message);
    }
  });

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filters__btn");
    if (!btn) return;
    filter = btn.dataset.filter;
    filters.querySelectorAll(".filters__btn").forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
    render();
  });

  searchInput.addEventListener("input", () => {
    search = searchInput.value.trim();
    render();
  });

  clearCompletedBtn.addEventListener("click", clearCompleted);

  // --- Tema ---
  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      themeToggle.textContent = "☀️";
    } else {
      document.documentElement.removeAttribute("data-theme");
      themeToggle.textContent = "🌙";
    }
  }

  themeToggle.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light";
    localStorage.setItem("theme", next);
    applyTheme(next);
  });

  // =========================================================
  //  MÜHENDİS KÖŞESİ (YAN PANEL)
  // =========================================================
  const TERMS = [
    { name: "Tork", def: "Bir cismi eksen etrafında döndüren kuvvet etkisi (N·m)." },
    { name: "Gerilme (Stress)", def: "Birim alana düşen iç kuvvet; σ = F/A." },
    { name: "Şekil Değiştirme (Strain)", def: "Birim uzunluktaki boyut değişimi; ε = ΔL/L." },
    { name: "Young Modülü", def: "Elastik bölgede gerilmenin şekil değiştirmeye oranı." },
    { name: "Reynolds Sayısı", def: "Akışın laminer mi türbülanslı mı olduğunu belirleyen boyutsuz sayı." },
    { name: "Entropi", def: "Bir sistemin düzensizlik ve erişilemez enerji ölçüsü." },
    { name: "Empedans", def: "Alternatif akım devrelerinde toplam direnç (Z)." },
    { name: "Ohm Yasası", def: "V = I·R; gerilim, akım ve direnç arasındaki ilişki." },
    { name: "Kirchhoff Yasaları", def: "Devrelerde akım (KCL) ve gerilim (KVL) korunum kuralları." },
    { name: "Fourier Dönüşümü", def: "Bir sinyali frekans bileşenlerine ayıran dönüşüm." },
    { name: "Laplace Dönüşümü", def: "Diferansiyel denklemleri cebirsel hale getiren dönüşüm." },
    { name: "Gradyan (∇f)", def: "Bir skaler alanın en hızlı artış yönünü veren vektör." },
    { name: "Diverjans", def: "Bir vektör alanının bir noktadan ne kadar 'yayıldığının' ölçüsü." },
    { name: "Rotasyonel (Curl)", def: "Bir vektör alanının dönme eğiliminin ölçüsü." },
    { name: "Verimlilik (η)", def: "Faydalı çıkış gücünün toplam giriş gücüne oranı." },
    { name: "Mukavemet", def: "Bir malzemenin yük altında kırılmadan dayanma kapasitesi." },
    { name: "Atalet Momenti", def: "Bir cismin dönmeye karşı direncini belirleyen büyüklük." },
    { name: "Bernoulli Denklemi", def: "Akışkanlarda basınç, hız ve yükseklik arası enerji korunumu." },
    { name: "PID Kontrol", def: "Hata üzerinden oransal-integral-türevsel geri besleme kontrolü." },
    { name: "Boyut Analizi", def: "Denklemlerin birim tutarlılığını kontrol etme yöntemi." },
    { name: "Süperpozisyon", def: "Doğrusal sistemlerde etkilerin ayrı ayrı toplanabilmesi." },
    { name: "Nyquist Kriteri", def: "Örnekleme frekansı, sinyal frekansının en az 2 katı olmalı." },
    { name: "Termal İletkenlik (k)", def: "Bir malzemenin ısıyı iletme yeteneğinin ölçüsü." },
    { name: "Kuvvet Çifti (Couple)", def: "Net kuvveti sıfır ama tork üreten, zıt yönlü kuvvet ikilisi." },
    { name: "Gerinim Enerjisi", def: "Şekil değiştiren bir cisimde depolanan elastik enerji." },
  ];

  const MINI_TASKS = [
    "30 dakika kesintisiz çalış (Pomodoro)",
    "Bir ders konusunu özetle (1 sayfa)",
    "5 türev/integral sorusu çöz",
    "Bir kavramı Feynman tekniğiyle anlat",
    "Python/MATLAB'da küçük bir grafik çiz",
    "Eski bir sınav sorusunu çöz",
    "Bir akademik makalenin özetini oku",
    "Formül kâğıdını güncelle",
    "10 soruluk mini quiz çöz",
    "Lab raporundan 1 paragraf yaz",
    "20 dakikalık bir ders videosu izle",
    "Birim dönüşümü alıştırması yap",
    "Devre / serbest cisim diyagramı çiz",
    "Teslim tarihlerini ve programı kontrol et",
    "Bir algoritma / kod problemi çöz",
    "Bir konuyu bir arkadaşına anlat",
  ];

  function dayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  let suggestSeed = dayOfYear();

  function renderTerm() {
    const t = TERMS[dayOfYear() % TERMS.length];
    termNameEl.textContent = t.name;
    termDefEl.textContent = t.def;
  }

  function renderSuggestions() {
    // Tohumdan başlayarak 4 farklı öneri seç
    const count = 4;
    const picks = [];
    for (let i = 0; i < count; i++) {
      picks.push(MINI_TASKS[(suggestSeed + i * 7) % MINI_TASKS.length]);
    }
    suggestionsEl.innerHTML = "";
    picks.forEach((text) => {
      const li = document.createElement("li");
      li.className = "suggestion";
      li.title = "Listeye ekle";

      const label = document.createElement("span");
      label.className = "suggestion__text";
      label.textContent = text;

      const add = document.createElement("span");
      add.className = "suggestion__add";
      add.textContent = "＋";

      li.append(label, add);
      li.addEventListener("click", async () => {
        if (li.classList.contains("is-added")) return;
        li.classList.add("is-added");
        add.textContent = "✓";
        try {
          await addTodo(text, null);
        } catch (err) {
          li.classList.remove("is-added");
          add.textContent = "＋";
          alert(err.message);
        }
      });
      suggestionsEl.appendChild(li);
    });
  }

  function renderPanel() {
    renderTerm();
    renderSuggestions();
    fetchScienceNews();
    loadAgenda(todayStr());
  }

  suggestRefresh.addEventListener("click", () => {
    suggestSeed = (suggestSeed + 4) % MINI_TASKS.length; // sonraki grup
    renderSuggestions();
  });

  // ----- Bilim Dünyası: güncel uzay & bilim haberleri -----
  const NEWS_API =
    "https://api.spaceflightnewsapi.net/v4/articles/?limit=5&ordering=-published_at";

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + " dk önce";
    if (diff < 86400) return Math.round(diff / 3600) + " saat önce";
    return Math.round(diff / 86400) + " gün önce";
  }

  function setNewsState(msg, withRetry) {
    newsListEl.innerHTML = "";
    const li = document.createElement("li");
    li.className = "news__state";
    li.textContent = msg + " ";
    if (withRetry) {
      const btn = document.createElement("button");
      btn.className = "news__retry";
      btn.textContent = "Tekrar dene";
      btn.addEventListener("click", fetchScienceNews);
      li.appendChild(btn);
    }
    newsListEl.appendChild(li);
  }

  let newsLoading = false;
  async function fetchScienceNews() {
    if (newsLoading) return;
    newsLoading = true;
    setNewsState("Yükleniyor…", false);
    try {
      const res = await fetch(NEWS_API, { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      const items = (data.results || []).slice(0, 5);
      if (items.length === 0) {
        setNewsState("Şu an haber bulunamadı.", true);
        return;
      }
      newsListEl.innerHTML = "";
      items.forEach((a) => {
        const li = document.createElement("li");
        li.className = "news__item";

        const link = document.createElement("a");
        link.className = "news__link";
        link.href = a.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = a.title;

        const meta = document.createElement("div");
        meta.className = "news__meta";
        meta.textContent = `${a.news_site || "Kaynak"} · ${timeAgo(a.published_at)}`;

        li.append(link, meta);
        newsListEl.appendChild(li);
      });
    } catch (err) {
      setNewsState("Haberler yüklenemedi.", true);
    } finally {
      newsLoading = false;
    }
  }

  newsRefresh.addEventListener("click", fetchScienceNews);

  // =========================================================
  //  GÜNLÜK AJANDA (SOL PANEL)
  // =========================================================
  const AGENDAS = `${SUPABASE_URL}/rest/v1/agendas`;
  let agendaDate = todayStr();
  let agendaSaveTimer = null;
  let agendaCurrentContent = "";

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function shiftDate(str, deltaDays) {
    const [y, m, d] = str.split("-").map(Number);
    const dt = new Date(y, m - 1, d + deltaDays);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function formatAgendaDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      weekday: "long",
    });
  }

  // agendas tablosu için kimlikli istek (tek seferlik 401 yenileme)
  async function agendaApi(path, options = {}, retry = true) {
    const res = await fetch(`${AGENDAS}${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (res.status === 401 && retry) {
      try {
        await refreshSession();
        return agendaApi(path, options, false);
      } catch {
        saveSession(null);
        showAuth();
        throw new Error("Oturum süresi doldu, tekrar giriş yapın.");
      }
    }
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Supabase ${res.status}: ${t}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function setAgendaStatus(msg, saved) {
    agendaStatus.textContent = msg;
    agendaStatus.classList.toggle("is-saved", !!saved);
  }

  async function loadAgenda(dateStr) {
    agendaDate = dateStr;
    const isToday = dateStr === todayStr();
    agendaDayEl.textContent = formatAgendaDate(dateStr);
    agendaBadge.hidden = !isToday;
    agendaNext.disabled = isToday; // bugünden ileri gidilemez
    agendaNext.style.opacity = isToday ? "0.3" : "";
    agendaText.disabled = true;
    setAgendaStatus("Yükleniyor…", false);
    try {
      const rows = await agendaApi(
        `?day=eq.${dateStr}&select=content`
      );
      agendaCurrentContent = rows && rows[0] ? rows[0].content : "";
      agendaText.value = agendaCurrentContent;
      setAgendaStatus("", false);
    } catch (err) {
      setAgendaStatus("Yüklenemedi", false);
    } finally {
      agendaText.disabled = false;
    }
  }

  async function saveAgenda() {
    const content = agendaText.value;
    if (content === agendaCurrentContent) return; // değişiklik yok
    setAgendaStatus("Kaydediliyor…", false);
    try {
      // upsert: (user_id, day) çakışırsa içeriği güncelle
      await agendaApi("?on_conflict=user_id,day", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          day: agendaDate,
          content,
          updated_at: new Date().toISOString(),
        }),
      });
      agendaCurrentContent = content;
      setAgendaStatus("Kaydedildi ✓", true);
    } catch (err) {
      setAgendaStatus("Kaydedilemedi", false);
    }
  }

  agendaText.addEventListener("input", () => {
    setAgendaStatus("Yazılıyor…", false);
    clearTimeout(agendaSaveTimer);
    agendaSaveTimer = setTimeout(saveAgenda, 700);
  });
  agendaText.addEventListener("blur", () => {
    clearTimeout(agendaSaveTimer);
    saveAgenda();
  });

  agendaPrev.addEventListener("click", () => {
    clearTimeout(agendaSaveTimer);
    saveAgenda();
    loadAgenda(shiftDate(agendaDate, -1));
  });
  agendaNext.addEventListener("click", () => {
    if (agendaDate === todayStr()) return;
    clearTimeout(agendaSaveTimer);
    saveAgenda();
    loadAgenda(shiftDate(agendaDate, 1));
  });
  agendaToday.addEventListener("click", () => {
    clearTimeout(agendaSaveTimer);
    saveAgenda();
    loadAgenda(todayStr());
  });

  function translateError(msg) {
    const m = (msg || "").toLowerCase();
    if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
    if (m.includes("already registered") || m.includes("already been registered"))
      return "Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.";
    if (m.includes("password should be")) return "Şifre en az 6 karakter olmalı.";
    if (m.includes("unable to validate email") || m.includes("invalid email"))
      return "Geçerli bir e-posta girin.";
    return msg;
  }

  // =========================================================
  //  BAŞLANGIÇ
  // =========================================================
  applyTheme(localStorage.getItem("theme") || "dark");
  setMode("login");
  if (session?.access_token) {
    showApp();
  } else {
    showAuth();
  }
})();
