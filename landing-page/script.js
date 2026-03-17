const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/";
const LIFETIME_CHECKOUT_URL = "";

function $(selector) {
  return document.querySelector(selector);
}

function openUrlOrToast(url, title, msg) {
  if (url && url.trim().length > 0) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const toast = $("#toast");
  const toastTitle = $("#toastTitle");
  const toastMsg = $("#toastMsg");

  if (!toast || !toastTitle || !toastMsg) return;

  toastTitle.textContent = title;
  toastMsg.textContent = msg;
  toast.hidden = false;

  window.clearTimeout(openUrlOrToast._t);
  openUrlOrToast._t = window.setTimeout(() => {
    toast.hidden = true;
  }, 5200);
}

function scrollToSection(id) {
  const el = document.querySelector(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function wireCTAs() {
  const startBtns = ["#ctaTop", "#ctaHero", "#ctaFree", "#ctaMobile"]
    .map((s) => $(s))
    .filter(Boolean);

  for (const btn of startBtns) {
    btn.addEventListener("click", () => {
      openUrlOrToast(
        CHROME_WEB_STORE_URL,
        "Start Recording Free",
        'Set your Chrome Web Store URL in "landing-page/script.js".'
      );
    });
  }

  const lifetimeBtn = $("#ctaLifetime");
  if (lifetimeBtn) {
    lifetimeBtn.addEventListener("click", () => {
      openUrlOrToast(
        LIFETIME_CHECKOUT_URL,
        "Get Lifetime",
        'Set your checkout URL in "landing-page/script.js".'
      );
    });
  }
}

function wireNavSmoothScroll() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href || href === "#") return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    scrollToSection(href);

    const mobileNav = $("#mobileNav");
    const menuBtn = $("#menuBtn");
    if (mobileNav && menuBtn && !mobileNav.hidden) {
      mobileNav.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });
}

function wireMobileMenu() {
  const menuBtn = $("#menuBtn");
  const mobileNav = $("#mobileNav");
  if (!menuBtn || !mobileNav) return;

  menuBtn.addEventListener("click", () => {
    const nextHidden = !mobileNav.hidden ? true : false;
    mobileNav.hidden = nextHidden;
    menuBtn.setAttribute("aria-expanded", String(!nextHidden));
  });
}

function wireToastClose() {
  const toast = $("#toast");
  const close = $("#toastClose");
  if (!toast || !close) return;

  close.addEventListener("click", () => {
    toast.hidden = true;
  });
}

function setYear() {
  const y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

setYear();
wireCTAs();
wireNavSmoothScroll();
wireMobileMenu();
wireToastClose();
