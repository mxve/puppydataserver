document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  const down_since_el = document.querySelector("[data-down-since]");
  if (down_since_el) {
    const d = new Date(down_since_el.dataset.downSince);
    down_since_el.textContent = d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  const modal = document.getElementById("invite-modal");
  if (!modal) return;

  document.querySelectorAll('[data-open-modal="invite"]').forEach((el) => {
    el.addEventListener("click", open_modal);
  });

  modal.querySelector(".modal-backdrop").addEventListener("click", close_modal);
  modal.querySelector(".modal-close").addEventListener("click", close_modal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("modal_open")) {
      close_modal();
    }
  });

  function open_modal() {
    modal.classList.add("modal_open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const input = modal.querySelector(".invite-form-input");
    if (input) setTimeout(() => input.focus(), 50);
  }

  function close_modal() {
    modal.classList.remove("modal_open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  const toast = document.getElementById("toast");
  if (toast) {
    setTimeout(() => {
      toast.style.transition = "opacity 0.4s";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  }
});
