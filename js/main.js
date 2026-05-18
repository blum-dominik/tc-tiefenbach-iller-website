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

  // Calendar buttons
  var calRows = document.querySelectorAll("tr[data-event-date]");
  if (calRows.length > 0) {
    // Expand month-break colspans to cover the new Kalender column
    document.querySelectorAll("tr.month-break td[colspan]").forEach(function (td) {
      var n = parseInt(td.getAttribute("colspan"), 10);
      if (!isNaN(n)) { td.setAttribute("colspan", String(n + 1)); }
    });

    function pad2(n) { return String(n).padStart(2, "0"); }

    function calText(td) {
      if (!td) { return ""; }
      return td.innerText.trim().replace(/\n/g, " ");
    }

    function icsDate(d, allDay) {
      var y = d.getFullYear();
      var mo = pad2(d.getMonth() + 1);
      var dy = pad2(d.getDate());
      if (allDay) { return y + mo + dy; }
      return y + mo + dy + "T" + pad2(d.getHours()) + pad2(d.getMinutes()) + "00";
    }

    function icsDateUTC(d) {
      return d.getUTCFullYear() +
        pad2(d.getUTCMonth() + 1) +
        pad2(d.getUTCDate()) + "T" +
        pad2(d.getUTCHours()) +
        pad2(d.getUTCMinutes()) + "00Z";
    }

    function icsEsc(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
    }

    calRows.forEach(function (row) {
      var dateStr = row.getAttribute("data-event-date");
      var start = dateStr ? new Date(dateStr) : null;
      var cells = row.querySelectorAll("td");
      var tdCal = document.createElement("td");
      tdCal.className = "cal-actions";

      if (!start || isNaN(start.getTime())) {
        row.appendChild(tdCal);
        return;
      }

      var isMatch = !!(row.closest && row.closest("table") && row.closest("table").id === "events-calendar");
      var timeText = calText(cells[2]);
      var allDay = timeText === "\u2013" || timeText === "-" || timeText === "";

      var title, location, description;
      if (isMatch) {
        var team = calText(cells[1]);
        var opponent = calText(cells[4]);
        title = team + (opponent ? " vs. " + opponent : "");
        location = calText(cells[3]);
        description = "TC Tiefenbach/Iller \u2013 Spieltag";
      } else {
        title = calText(cells[1]);
        location = calText(cells[3]) || "Anlage TC Tiefenbach/Iller";
        description = calText(cells[4]);
      }

      var end = new Date(start);
      var endDateStr = row.getAttribute("data-event-end-date");
      if (endDateStr) {
        end = new Date(endDateStr);
        if (endDateStr.indexOf("T") === -1) {
          end.setDate(end.getDate() + 1); // All-day: DTEND is exclusive (day after last day)
        }
      } else if (allDay) {
        end.setDate(end.getDate() + 1);
      } else {
        end.setHours(end.getHours() + 2);
      }

      var startFmt = icsDate(start, allDay);
      var endFmt = icsDate(end, allDay);

      var googleUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
        "&text=" + encodeURIComponent(title) +
        "&dates=" + startFmt + "/" + endFmt +
        "&details=" + encodeURIComponent(description) +
        "&location=" + encodeURIComponent(location);

      var uid = icsDate(start, false) +
        "-" + title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) +
        "@tc-tiefenbach-iller.de";

      var icsLines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TC Tiefenbach-Iller//Terminplan//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:" + uid,
        "DTSTAMP:" + icsDateUTC(new Date()),
        allDay ? "DTSTART;VALUE=DATE:" + startFmt : "DTSTART:" + startFmt,
        allDay ? "DTEND;VALUE=DATE:" + endFmt : "DTEND:" + endFmt,
        "SUMMARY:" + icsEsc(title),
        "DESCRIPTION:" + icsEsc(description),
        "LOCATION:" + icsEsc(location),
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");

      var blob = new Blob([icsLines], { type: "text/calendar;charset=utf-8" });
      var icsUrl = URL.createObjectURL(blob);
      var fileName = title.replace(/[^\wäöüÄÖÜß\s]/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".ics";

      var wrap = document.createElement("div");
      wrap.className = "btn-cal-wrap";

      var gBtn = document.createElement("a");
      gBtn.className = "btn-cal btn-cal-google";
      gBtn.href = googleUrl;
      gBtn.target = "_blank";
      gBtn.rel = "noopener noreferrer";
      gBtn.textContent = "Google";
      gBtn.setAttribute("aria-label", "In Google Kalender speichern: " + title);

      var iBtn = document.createElement("a");
      iBtn.className = "btn-cal btn-cal-ics";
      iBtn.href = icsUrl;
      iBtn.download = fileName;
      iBtn.textContent = "iCal";
      iBtn.setAttribute("aria-label", "Als iCal-Datei herunterladen: " + title);

      wrap.appendChild(gBtn);
      wrap.appendChild(iBtn);
      tdCal.appendChild(wrap);
      row.appendChild(tdCal);
    });
  }
})();
