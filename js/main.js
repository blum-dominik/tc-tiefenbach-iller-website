(function () {
  // Dark mode toggle
  const darkToggle = document.querySelector("[data-dark-toggle]");
  const html = document.documentElement;
  const savedTheme = localStorage.getItem("theme") || "";

  function updateDarkToggleButton(isDark) {
    if (!darkToggle) return;
    darkToggle.setAttribute("aria-pressed", String(isDark));
  }

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = savedTheme === "dark" || (savedTheme === "" && prefersDark);

  if (useDark) {
    html.setAttribute("data-theme", "dark");
    updateDarkToggleButton(true);
  } else {
    if (savedTheme === "light") {
      html.setAttribute("data-theme", "light");
    } else {
      html.removeAttribute("data-theme");
    }
    updateDarkToggleButton(false);
  }

  if (darkToggle) {
    darkToggle.addEventListener("click", function () {
      const isDark = html.getAttribute("data-theme") === "dark";
      if (isDark) {
        html.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
        updateDarkToggleButton(false);
      } else {
        html.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
        updateDarkToggleButton(true);
      }
    });
  }

  // Navigation toggle
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-primary-nav]");

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("is-open");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 959px)").matches) {
          nav.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if (revealItems.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );

    revealItems.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealItems.forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  const calendars = document.querySelectorAll("table");
  if (calendars.length > 0) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    calendars.forEach(function (table) {
      const eventRows = table.querySelectorAll("tbody tr[data-event-date]");
      if (eventRows.length === 0) {
        return;
      }

      let nextRows = [];
      let nextTime = null;

      eventRows.forEach(function (row) {
        row.classList.remove("next-event");

        const value = row.getAttribute("data-event-date");
        const parsed = value ? new Date(value) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) {
          return;
        }

        const parsedDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        if (parsedDate >= today) {
          if (nextTime === null || parsedDate < nextTime) {
            nextTime = parsedDate;
            nextRows = [row];
          } else if (parsedDate.getTime() === nextTime.getTime()) {
            nextRows.push(row);
          }
        }
      });

      nextRows.forEach(function (row) {
        row.classList.add("next-event");
      });
    });
  }
})();
