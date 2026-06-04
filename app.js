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

  // --- State ---
  let session = loadSession(); // { access_token, refresh_token, user }
  let todos = [];
  let filter = "all";
  let mode = "login"; // login | signup

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
    todos = await api("?select=*&order=inserted_at.desc");
    render();
  }

  async function addTodo(text) {
    const [created] = await api("", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ text }), // user_id DB'de auth.uid() ile otomatik
    });
    todos.unshift(created);
    render();
  }

  async function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const next = !todo.completed;
    todo.completed = next;
    render();
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
    if (filter === "active") return todos.filter((t) => !t.completed);
    if (filter === "completed") return todos.filter((t) => t.completed);
    return todos;
  }

  function render() {
    const visible = getVisible();
    list.innerHTML = "";

    visible.forEach((todo) => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.completed ? " is-completed" : "");
      li.dataset.id = todo.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "todo-item__checkbox";
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      const span = document.createElement("span");
      span.className = "todo-item__text";
      span.textContent = todo.text;
      span.addEventListener("click", () => toggleTodo(todo.id));

      const del = document.createElement("button");
      del.className = "todo-item__delete";
      del.innerHTML = "&times;";
      del.setAttribute("aria-label", "Sil");
      del.addEventListener("click", () => deleteTodo(todo.id));

      li.append(checkbox, span, del);
      list.appendChild(li);
    });

    const hasTodos = todos.length > 0;
    empty.hidden = visible.length > 0;
    footer.hidden = !hasTodos;

    const remaining = todos.filter((t) => !t.completed).length;
    counter.textContent =
      remaining === 1 ? "1 görev kaldı" : `${remaining} görev kaldı`;
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
    input.value = "";
    input.focus();
    try {
      await addTodo(text);
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

  clearCompletedBtn.addEventListener("click", clearCompleted);

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
  setMode("login");
  if (session?.access_token) {
    showApp();
  } else {
    showAuth();
  }
})();
