(() => {
  "use strict";

  // --- Supabase yapılandırması ---
  const SUPABASE_URL = "https://mcdbqsjsyaakixondyjg.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGJxc2pzeWFha2l4b25keWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTA2ODQsImV4cCI6MjA5NjE2NjY4NH0._y9FfIRnvfeZEgvpOhKxIl_fztXCEElqiDnI7n9ESMA";
  const REST = `${SUPABASE_URL}/rest/v1/todos`;
  const HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };

  // DOM
  const form = document.getElementById("todoForm");
  const input = document.getElementById("todoInput");
  const list = document.getElementById("todoList");
  const filters = document.getElementById("filters");
  const empty = document.getElementById("empty");
  const footer = document.getElementById("footer");
  const counter = document.getElementById("counter");
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const dateEl = document.getElementById("date");

  // State
  let todos = [];
  let filter = "all"; // all | active | completed

  // --- API yardımcıları ---
  async function api(path = "", options = {}) {
    const res = await fetch(`${REST}${path}`, {
      ...options,
      headers: { ...HEADERS, ...(options.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${res.status}: ${body}`);
    }
    // 204 No Content (DELETE/PATCH return=minimal) gövdesizdir
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
      body: JSON.stringify({ text }),
    });
    todos.unshift(created);
    render();
  }

  async function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const next = !todo.completed;
    todo.completed = next; // iyimser güncelleme
    render();
    try {
      await api(`?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ completed: next }),
      });
    } catch (err) {
      todo.completed = !next; // başarısızsa geri al
      render();
      alert(err.message);
    }
  }

  async function deleteTodo(id) {
    const backup = todos;
    todos = todos.filter((t) => t.id !== id); // iyimser
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
    const completedIds = todos.filter((t) => t.completed).map((t) => t.id);
    if (completedIds.length === 0) return;
    try {
      await api("?completed=eq.true", { method: "DELETE" });
      todos = todos.filter((t) => !t.completed);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  // --- Render ---
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

  // --- Events ---
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

  // --- Init ---
  dateEl.textContent = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  fetchTodos().catch((err) => {
    empty.hidden = false;
    empty.querySelector("p").textContent = "Bağlantı hatası: " + err.message;
  });
})();
