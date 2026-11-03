window.addEventListener("beforeunload", () => {
  document.querySelectorAll(".comment-popover-body").forEach((el) => {
    el.scrollTop = 0;
  });
});

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
    comment: 10,
    id: 12,
    thumbnail: 13,
  },
  2025: {
    title: 2,
    start: 3,
    finish: 4,
    extra: 5,
    type: 7,
    daysSpent: 8,
    comment: 9,
    id: -1,
    thumbnail: -1,
  },
  2024: {
    title: 1,
    start: -1,
    finish: 2,
    extra: 3,
    type: 4,
    daysSpent: -1,
    comment: -1,
    id: -1,
    thumbnail: -1,
  },
};

const COLUMNS = [
  { key: "title", label: "title", className: "col-title" },
  { key: "type", label: "type", className: "col-meta" },
  { key: "start", label: "start date", className: "col-date" },
  { key: "finish", label: "finish date", className: "col-date" },
  { key: "daysSpent", label: "days taken", className: "col-meta" },
  { key: "extra", label: "extra", className: "col-extra" },
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

let progressLogSessionCounts = {};

function loadProgressLogSessions() {
  Papa.parse("../csv/progresslog.csv", {
    download: true,
    skipEmptyLines: true,
    complete: function (results) {
      progressLogSessionCounts = {};
      results.data.forEach((row) => {
        const colId = (row[0] || "").trim();
        const col1 = (row[1] || "").trim();
        const col2 = (row[2] || "").trim();

        if (col1.match(/^[A-Za-z]+\s+\d{4}$/)) return;
        if (
          !col2 ||
          col1.toLowerCase() === "date" ||
          col2.toLowerCase() === "title" ||
          colId.toLowerCase() === "id"
        )
          return;

        if (colId) {
          progressLogSessionCounts[colId] =
            (progressLogSessionCounts[colId] || 0) + 1;
        }
      });

      // Only trigger a re-render if the sheet data has already been parsed and loaded
      if (rawParsedRows && rawParsedRows.length > 0) {
        renderTables();
      }
    },
  });
}

loadProgressLogSessions();

function renderNoteCell(note, comment) {
  const escapedNote = escapeHTML(note);
  if (!comment) return escapedNote;

  const escapedComment = escapeHTML(comment);
  const isLong = comment.length > 350 || comment.split("\n").length > 3;

  return `${escapedNote}<div class="comment-corner-mark"></div><div class="comment-popover"><div class="comment-popover-header"><span>Comment</span><button type="button" class="comment-fullscreen-btn" onclick="openCommentModal(this, event)">⛶</button></div><div class="comment-popover-body ${isLong ? "is-truncated" : ""}">${escapedComment}</div>${isLong ? `<button type="button" class="comment-expand-btn" onclick="toggleCommentExpand(this, event)">Show more</button>` : ""}</div>`;
}

function toggleCommentExpand(btn, event) {
  event.stopPropagation();
  const body = btn.previousElementSibling;
  if (body.classList.contains("is-truncated")) {
    body.classList.remove("is-truncated");
    body.classList.add("is-expanded");
    btn.textContent = "Show less";
  } else {
    body.classList.remove("is-expanded");
    body.classList.add("is-truncated");
    btn.textContent = "Show more";
    body.scrollTop = 0;
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

  fetch(`../csv/trackingsheet-${year}.csv?v=` + Date.now())
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

  // Extract entries from "Started but not finished" that start with '!'
  let inProgressRows = [];
  sections.forEach((sec) => {
    if (
      sec.title &&
      sec.title.toLowerCase().includes("started but not finished")
    ) {
      sec.rows.forEach((row) => {
        const titleText = row[cfg.title] ? row[cfg.title].trim() : "";
        if (titleText.startsWith("!")) {
          inProgressRows.push(row);
        }
      });
    }
  });

  // Filter out the entire "Started but not finished" section
  const filteredSections = sections.filter((sec) => {
    const titleLower = sec.title ? sec.title.toLowerCase() : "";
    return !titleLower.includes("started but not finished");
  });

  container.textContent = "";
  let totalMatches = 0;

  filteredSections.forEach((sec, secIndex) => {
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

    // If this is the first section (Main table), inject and filter the in-progress rows at the top
    let rowsToRender = filteredRows;
    let applicableInProgress = [];
    if (secIndex === 0 && inProgressRows.length > 0) {
      applicableInProgress = inProgressRows.filter((row) => {
        // Apply search query filter
        if (searchQuery) {
          const titleIdx = cfg.title;
          const matchesTitle =
            titleIdx !== -1 && row[titleIdx]
              ? row[titleIdx].toLowerCase().includes(searchQuery)
              : false;
          if (!matchesTitle) return false;
        }

        // Apply type filter
        if (selectedType !== "All") {
          const typeIdx = cfg.type;
          if (typeIdx !== -1) {
            const rowType = row[typeIdx]
              ? row[typeIdx].trim().toLowerCase()
              : "";
            const filter = selectedType.toLowerCase();

            if (filter === "anime") {
              if (rowType !== "anime" && rowType !== "anime (film)")
                return false;
            } else if (filter === "film") {
              if (rowType !== "film" && rowType !== "anime (film)")
                return false;
            } else {
              if (rowType !== filter) return false;
            }
          }
        }

        return true;
      });
    }

    if (rowsToRender.length === 0 && applicableInProgress.length === 0) return;
    totalMatches += rowsToRender.length + applicableInProgress.length;

    if (sec.title) {
      const h2 = document.createElement("h2");
      h2.className = "section-title";
      h2.textContent = sec.title;
      container.appendChild(h2);
    }

    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    const secTitleLower = sec.title ? sec.title.toLowerCase() : "";
    const hideHeader = secTitleLower.includes("(probably) dropped");

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

    // Render "in progress" items first on the main table
    if (secIndex === 0) {
      applicableInProgress.forEach((row) => {
        tbody.appendChild(createRowElement(row, cfg, true));
      });
    }

    rowsToRender.forEach((row) => {
      tbody.appendChild(createRowElement(row, cfg, false));
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

  requestAnimationFrame(() => {
    container.querySelectorAll(".comment-popover-body").forEach((el) => {
      el.scrollTop = 0;
    });
  });
}

function createRowElement(row, cfg, isInProgress) {
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

    let titleText = row[cfg.title] ? row[cfg.title].trim() : "";
    if (isInProgress && titleText.startsWith("!")) {
      titleText = titleText.replace(/^!\s*/, ""); // Clean up the exclamation mark
    }

    const entryId = cfg.id !== -1 && row[cfg.id] ? row[cfg.id].trim() : "";
    const thumbnailUrl =
      cfg.thumbnail !== -1 && row[cfg.thumbnail]
        ? row[cfg.thumbnail].trim()
        : "";

    const wrapper = document.createElement("div");
    wrapper.className = "col-title-content";

    // Handle thumbnail or placeholder ONLY if the sheet config supports thumbnails (i.e. cfg.thumbnail !== -1)
    if (cfg.thumbnail !== -1) {
      if (entryId && !entryId.startsWith("X-") && thumbnailUrl) {
        const img = document.createElement("img");
        img.src = `../thumbs/${entryId}.png`;
        img.alt = "";
        img.className = "row-thumbnail" + (isInProgress ? " in-progress" : "");

        img.onerror = function () {
          this.onerror = null;
          this.src = thumbnailUrl;
        };
        wrapper.appendChild(img);
      } else if (thumbnailUrl) {
        const img = document.createElement("img");
        img.src = thumbnailUrl;
        img.alt = "";
        img.className = "row-thumbnail";
        wrapper.appendChild(img);
      } else {
        // Insert width spacer only for sheets that support thumbnails (like 2026)
        const placeholder = document.createElement("div");
        placeholder.className = "row-thumbnail-placeholder";
        wrapper.appendChild(placeholder);
      }
    }

    const textSpan = document.createElement("span");
    textSpan.textContent = titleText;
    wrapper.appendChild(textSpan);

    // Add IN PROGRESS badge if it's an active entry
    if (isInProgress) {
      const badge = document.createElement("span");
      badge.className = "in-progress-badge";
      badge.textContent = "IN PROGRESS";
      wrapper.appendChild(badge);
    }

    td.appendChild(wrapper);

    if (entryId && !entryId.startsWith("X-")) {
      const jumpBtn = document.createElement("a");
      jumpBtn.href = `../progress-log/?id=${entryId}`;
      jumpBtn.className = "progress-log-jump-btn";
      jumpBtn.textContent = "view log ↗";
      td.appendChild(jumpBtn);
    }

    tr.appendChild(td);
  }

  if (cfg.type !== -1) {
    const td = document.createElement("td");
    td.className = "col-meta";
    td.textContent = row[cfg.type] ? row[cfg.type].trim() : "";
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

  if (cfg.daysSpent !== -1) {
    const td = document.createElement("td");
    td.className = "col-meta";
    const daysVal = row[cfg.daysSpent] ? row[cfg.daysSpent].trim() : "";
    const entryId = cfg.id !== -1 && row[cfg.id] ? row[cfg.id].trim() : "";
    let sessionCount =
      entryId && !entryId.startsWith("X-")
        ? progressLogSessionCounts[entryId] || 0
        : 0;

    if (sessionCount > 0) {
      td.innerHTML = `${escapeHTML(daysVal)}<br>(${sessionCount} logged)`;
    } else {
      td.textContent = daysVal;
    }
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

  return tr;
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

function initCommentModal() {
  if (document.getElementById("comment-modal-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "comment-modal-overlay";
  overlay.className = "comment-modal-overlay";
  overlay.innerHTML = `
    <div class="comment-modal-box" onclick="event.stopPropagation()">
      <div class="comment-modal-header">
        <span id="comment-modal-title">Comment</span>
        <button type="button" class="comment-modal-close-btn" onclick="closeCommentModal()">✕</button>
      </div>
      <div id="comment-modal-body" class="comment-modal-body"></div>
    </div>
  `;
  overlay.addEventListener("click", closeCommentModal);
  document.body.appendChild(overlay);
}

function openCommentModal(btn, event) {
  event.stopPropagation();
  initCommentModal();
  const popover = btn.closest(".comment-popover");
  const bodyEl = popover.querySelector(".comment-popover-body");
  const headerSpan = popover.querySelector(".comment-popover-header span");

  const modalBody = document.getElementById("comment-modal-body");
  const modalTitle = document.getElementById("comment-modal-title");

  modalBody.innerHTML = bodyEl ? bodyEl.innerHTML : "";
  modalTitle.textContent = headerSpan ? headerSpan.textContent : "Comment";

  document.getElementById("comment-modal-overlay").classList.add("is-active");
  document.body.style.overflow = "hidden";
}

function closeCommentModal() {
  const overlay = document.getElementById("comment-modal-overlay");
  if (overlay) {
    overlay.classList.remove("is-active");
    document.body.style.overflow = "";
  }
}

window.openCommentModal = openCommentModal;
window.closeCommentModal = closeCommentModal;

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

const tableContainer = document.getElementById("table-container");

if (tableContainer) {
  let activePopover = null;
  let activeCell = null;

  function showPopover(cell) {
    const popover = cell.querySelector(".comment-popover");
    if (!popover) return;

    const popoverBody = popover.querySelector(
      ".comment-popover-body.is-truncated",
    );
    if (popoverBody) popoverBody.scrollTop = 0;

    popover.style.display = "block";
    const rect = cell.getBoundingClientRect();
    const popoverHeight = popover.offsetHeight;
    const windowHeight = window.innerHeight;

    popover.style.position = "fixed";
    popover.style.right = window.innerWidth - rect.right + "px";
    popover.style.left = "auto";
    popover.style.width = "300px";

    if (
      rect.bottom + popoverHeight > windowHeight - 10 &&
      rect.top > popoverHeight + 10
    ) {
      popover.style.top = rect.top - popoverHeight + "px";
    } else {
      popover.style.top = rect.bottom + "px";
    }

    popover.classList.add("is-active-fixed");
    activePopover = popover;
    activeCell = cell;
  }

  function hidePopover() {
    if (!activePopover) return;
    activePopover.classList.remove("is-active-fixed");
    activePopover.style.display = "";
    activePopover.style.position = "";
    activePopover.style.left = "";
    activePopover.style.right = "";
    activePopover.style.top = "";
    activePopover.style.width = "";
    activePopover = null;
    activeCell = null;
  }

  tableContainer.addEventListener("mouseover", (e) => {
    const cell = e.target.closest("td.col-extra");
    if (cell && activeCell !== cell) {
      hidePopover();
      showPopover(cell);
    }
  });

  tableContainer.addEventListener("mouseout", (e) => {
    const cell = e.target.closest("td.col-extra");
    const popover = e.target.closest(".comment-popover");
    const related = e.relatedTarget;

    if (cell || popover) {
      if (related) {
        if (activeCell && activeCell.contains(related)) return;
        if (activePopover && activePopover.contains(related)) return;
      }
      hidePopover();
    }
  });
}

function jumpToProgressLog(id) {
  window.location.href = `../progress-log/?id=${id}`;
}
window.jumpToProgressLog = jumpToProgressLog;
