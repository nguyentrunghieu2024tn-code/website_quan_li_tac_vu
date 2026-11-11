const statuses = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  done: "Hoàn thành"
};

const apiBase = "http://localhost:5000/api";
const columns = document.querySelectorAll(".column");
const loginForm = document.querySelector("#login-form");
const message = document.querySelector("#api-message");

let token = "";
let tasks = [];
let saving = false;

async function request(path, { method = "GET", body } = {}) {
  const headers = {};

  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || `API báo lỗi HTTP ${response.status}.`);
  }

  return result;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  const fields = new FormData(loginForm);

  button.disabled = true;
  message.textContent = "Đang đăng nhập và tải tác vụ…";

  try {
    const result = await request("/auth/login", {
      method: "POST",
      body: {
        email: fields.get("email"),
        password: fields.get("password")
      }
    });

    if (!result?.token) throw new Error("API đăng nhập chưa trả token.");
    token = result.token;

    const taskResult = await request("/tasks");
    if (!Array.isArray(taskResult?.data)) {
      throw new Error("API chưa trả danh sách tác vụ đúng định dạng.");
    }

    tasks = taskResult.data;
    render();
    loginForm.reset();
    loginForm.hidden = true;
    message.textContent = `Đã tải ${tasks.length} tác vụ.`;
  } catch (error) {
    token = "";
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

async function moveTask(id, status) {
  const task = tasks.find((item) => String(item.id) === String(id));
  if (!task || task.status === status) return;

  if (saving) {
    render();
    return;
  }

  saving = true;
  message.textContent = "Đang lưu trạng thái…";

  try {
    await request(`/tasks/${encodeURIComponent(task.id)}`, {
      method: "PUT",
      body: { status }
    });

    task.status = status;
    message.textContent = "Đã lưu trạng thái.";
  } catch (error) {
    message.textContent = `Lưu thất bại. ${error.message}`;
  } finally {
    saving = false;
    render();
  }
}

function createCard(task) {
  const card = document.createElement("article");
  card.className = "task";
  card.draggable = true;

  const title = document.createElement("p");
  title.textContent = task.title;

  const select = document.createElement("select");
  select.setAttribute("aria-label", `Đổi trạng thái của ${task.title}`);

  for (const [status, label] of Object.entries(statuses)) {
    select.add(new Option(label, status));
  }

  select.value = task.status;
  select.addEventListener("change", () => moveTask(task.id, select.value));

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
  });

  card.addEventListener("dragend", () => {
    columns.forEach((column) => column.classList.remove("is-over"));
  });

  card.append(title, select);
  return card;
}

function render() {
  document.getElementById("total-count").textContent = tasks.length;

  for (const column of columns) {
    const status = column.dataset.status;
    const columnTasks = tasks.filter((task) => task.status === status);

    document.getElementById(`${status}-count`).textContent = columnTasks.length;
    column.querySelector(".task-list").replaceChildren(
      ...columnTasks.map(createCard)
    );
  }
}

for (const column of columns) {
  column.addEventListener("dragover", (event) => {
    event.preventDefault();
    column.classList.add("is-over");
  });

  column.addEventListener("dragleave", (event) => {
    if (!column.contains(event.relatedTarget)) {
      column.classList.remove("is-over");
    }
  });

  column.addEventListener("drop", (event) => {
    event.preventDefault();
    column.classList.remove("is-over");
    moveTask(event.dataTransfer.getData("text/plain"), column.dataset.status);
  });
}

render();