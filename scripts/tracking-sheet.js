let currentYear = "2026";
let rawParsedRows = [];

const YEAR_CONFIGS = {
  2026: {
    title: 2,
    start: 4,
    finish: 5,
    extra: 6,
    type: 8,
    daysSpent: 9,
    comment: 10, // Column K
  },
  2025: {
    title: 2,
    start: 3,
    finish: 4,
    extra: 5,
    type: 7, // Column H
    daysSpent: 8, // Column I
    comment: -1, // Column K
  },
  2024: {
    title: 1,
    start: -1,
    finish: 2,
    extra: 3,
    type: 4, // Column E
    daysSpent: -1,
    comment: -1, // Column K
  },
};

const COLUMNS = [
  { key: "title", label: "title", className: "col-title" },
  { key: "start", label: "start date", className: "col-date" },
  { key: "finish", label: "finish date", className: "col-date" },
  { key: "extra", label: "extra", className: "col-extra" },
  { key: "type", label: "type", className: "col-meta" },
  { key: "daysSpent", label: "days spent", className: "col-meta" },
];

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderNoteCell(note, comment) {
  const escapedNote = escapeHTML(note);
  if (!comment) return escapedNote;

  const escapedComment = escapeHTML(comment);
  const isLong = comment.length > 150 || comment.split("\n").length > 3;

  return `${escapedNote}<div class="comment-corner-mark"></div><div class="comment-popover"><div class="comment-popover-header">Comment</div><div class="comment-popover-body ${isLong ? "is-truncated" : ""}">${escapedComment}</div>${isLong ? `<button type="button" class="comment-expand-btn" onclick="toggleCommentExpand(this, event)">Show more</button>` : ""}</div>`;
}

function toggleCommentExpand(btn, event) {
  event.stopPropagation();
  const body = btn.previousElementSibling;
  if (body.classList.contains("is-truncated")) {
    body.classList.remove("is-truncated");
    btn.textContent = "Show less";
  } else {
    body.classList.add("is-truncated");
    btn.textContent = "Show more";
  }
}

function switchTab(year) {
  currentYear = year;
  document.body.dataset.year = year;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent === year);
  });
  loadSheetData(year);
}

function loadSheetData(year) {
  const container = document.getElementById("table-container");
  container.textContent = "Loading data...";

  fetch(`../trackingsheet-${year}.csv?v=` + Date.now())
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((csvData) => {
      Papa.parse(csvData, {
        complete: function (results) {
          rawParsedRows = results.data;
          renderTables();
        },
      });
    })
    .catch((error) => {
      console.error("Failed to load sheet data:", error);
      container.textContent = "";
      const errorMsg = document.createElement("p");
      errorMsg.style.color = "#ef4444";
      errorMsg.textContent = `Failed to load data for ${year}. Check connection or file availability.`;
      container.appendChild(errorMsg);
    });
}

function handleSearch() {
  renderTables();
}

function renderTables() {
  const year = currentYear;
  const cfg = YEAR_CONFIGS[year];
  const container = document.getElementById("table-container");
  const searchQuery = document
    .getElementById("search-input")
    .value.toLowerCase()
    .trim();
  const selectedType = document.getElementById("type-filter").value;

  if (!rawParsedRows || rawParsedRows.length === 0) return;

  let hasReachedData = false;
  const sections = [];
  let currentSection = { title: "", rows: [] };

  rawParsedRows.forEach((row) => {
    if (!hasReachedData) {
      if (row[cfg.title] && row[cfg.title].trim().toLowerCase() === "title") {
        hasReachedData = true;
      }
      return;
    }

    const titleText = row[cfg.title] ? row[cfg.title].trim() : "";

    if (
      !row ||
      row.every((cell) => !cell || cell.trim() === "") ||
      titleText.toLowerCase() === "x"
    ) {
      return;
    }

    if (titleText.endsWith(":")) {
      if (currentSection.rows.length > 0 || currentSection.title !== "") {
        sections.push(currentSection);
      }
      currentSection = { title: titleText, rows: [] };
      return;
    }

    currentSection.rows.push(row);
  });

  if (currentSection.rows.length > 0 || currentSection.title !== "") {
    sections.push(currentSection);
  }

  container.textContent = "";
  let totalMatches = 0;

  sections.forEach((sec) => {
    const filteredRows = sec.rows.filter((row) => {
      if (searchQuery) {
        const titleIdx = cfg.title;
        const matchesTitle =
          titleIdx !== -1 && row[titleIdx]
            ? row[titleIdx].toLowerCase().includes(searchQuery)
            : false;
        if (!matchesTitle) return false;
      }

      if (selectedType !== "All") {
        const typeIdx = cfg.type;
        if (typeIdx !== -1) {
          const rowType = row[typeIdx] ? row[typeIdx].trim().toLowerCase() : "";
          const filter = selectedType.toLowerCase();

          if (filter === "anime") {
            if (rowType !== "anime" && rowType !== "anime (film)") return false;
          } else if (filter === "film") {
            if (rowType !== "film" && rowType !== "anime (film)") return false;
          } else {
            if (rowType !== filter) return false;
          }
        }
      }

      return true;
    });

    if (filteredRows.length === 0) return;
    totalMatches += filteredRows.length;

    if (sec.title) {
      const h2 = document.createElement("h2");
      h2.className = "section-title";
      h2.textContent = sec.title;
      const secTitleLower = sec.title.toLowerCase();

      if (
        !searchQuery &&
        (secTitleLower.includes("started but not finished") ||
          secTitleLower.includes("probably dropped"))
      ) {
        h2.style.marginTop = "175px";
      }

      container.appendChild(h2);
    }

    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    const secTitleLower = sec.title ? sec.title.toLowerCase() : "";
    const hideHeader =
      secTitleLower.includes("started but not finished") ||
      secTitleLower.includes("(probably) dropped");

    if (!hideHeader) {
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      COLUMNS.forEach((col) => {
        if (cfg[col.key] !== -1) {
          const th = document.createElement("th");
          th.className = col.className;
          th.textContent = col.label;
          headerRow.appendChild(th);
        }
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    filteredRows.forEach((row) => {
      const tr = document.createElement("tr");

      const colAVal = row[0] ? row[0].trim().toLowerCase() : "";
      if (colAVal === "minor") {
        tr.classList.add("row-minor");
      } else if (colAVal === "major") {
        tr.classList.add("row-major");
      }

      if (cfg.title !== -1) {
        const td = document.createElement("td");
        td.className = "col-title";
        if (colAVal === "major") {
          td.classList.add("title-major");
        }
        td.textContent = row[cfg.title] ? row[cfg.title].trim() : "";
        tr.appendChild(td);
      }

      if (cfg.start !== -1) {
        const td = document.createElement("td");
        td.className = "col-date";
        const startVal = row[cfg.start] ? row[cfg.start].trim() : "";
        td.textContent = startVal === "" ? "→" : startVal;
        tr.appendChild(td);
      }

      if (cfg.finish !== -1) {
        const td = document.createElement("td");
        td.className = "col-date";
        td.textContent = row[cfg.finish] ? row[cfg.finish].trim() : "";
        tr.appendChild(td);
      }

      if (cfg.extra !== -1) {
        const td = document.createElement("td");
        td.className = "col-extra";
        const noteVal = row[cfg.extra] ? row[cfg.extra].trim() : "";
        const commentVal =
          cfg.comment !== -1 && row[cfg.comment] ? row[cfg.comment].trim() : "";

        if (commentVal) {
          td.innerHTML = renderNoteCell(noteVal, commentVal);
        } else {
          td.textContent = noteVal;
        }
        tr.appendChild(td);
      }

      if (cfg.type !== -1) {
        const td = document.createElement("td");
        td.className = "col-meta";
        td.textContent = row[cfg.type] ? row[cfg.type].trim() : "";
        tr.appendChild(td);
      }

      if (cfg.daysSpent !== -1) {
        const td = document.createElement("td");
        td.className = "col-meta";
        td.textContent = row[cfg.daysSpent] ? row[cfg.daysSpent].trim() : "";
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  });

  if (totalMatches === 0) {
    const noResults = document.createElement("p");
    noResults.className = "no-results";
    noResults.textContent = "No entries found matching criteria.";
    container.appendChild(noResults);
  }
}

function formatUTCToLocal(utcString) {
  const match = utcString
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return utcString;

  const [, day, month, year, hours, minutes] = match;
  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
  const dateObj = new Date(isoString);

  if (isNaN(dateObj.getTime())) return utcString;

  return dateObj.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

fetch("../trackingsheet-last-updated.txt?v=" + Date.now())
  .then((response) => response.text())
  .then((timestamp) => {
    document.getElementById("last-updated").textContent =
      `Last updated: ${formatUTCToLocal(timestamp)}`;
  })
  .catch(() => {
    document.getElementById("last-updated").style.display = "none";
  });

document.getElementById("type-filter").value = "All";
document.getElementById("search-input").value = "";

switchTab("2026");
